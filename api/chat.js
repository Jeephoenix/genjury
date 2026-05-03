// api/chat.js — Vercel Serverless Function (CommonJS)
// Uses module.exports — compatible with Node.js default CJS mode.
// No top-level external imports. Neon loaded lazily only if DATABASE_URL is set.

const _mem          = new Map()   // room -> messages[]
const _memReactions = new Map()   // msgId -> { emoji: [userId] }
const _memMembers   = new Map()   // room -> Set<userId>
const _memHosts     = new Map()   // room -> hostUserId

function isMember(room, userId) {
  const members = _memMembers.get(room)
  return members ? members.has(String(userId).toLowerCase()) : false
}

function addMember(room, userId, isHost) {
  const uid = String(userId).toLowerCase()
  if (!_memMembers.has(room)) _memMembers.set(room, new Set())
  _memMembers.get(room).add(uid)
  if (isHost && !_memHosts.has(room)) _memHosts.set(room, uid)
}

function memGet(room, since) {
  return (_mem.get(room) || [])
    .filter(m => m.ts > since)
    .slice(-100)
    .map(m => ({ ...m, reactions: _memReactions.get(m.id) || {} }))
}

function memPost(roomCode, msg) {
  const msgs = _mem.get(roomCode) || []
  if (!msgs.some(m => m.id === msg.id)) {
    msgs.push({
      id:          String(msg.id),
      author_id:   String(msg.authorId   || ''),
      author_name: String(msg.authorName || 'Player'),
      avatar:      String(msg.avatar     || ''),
      color:       String(msg.color      || ''),
      text:        String(msg.text       || '').slice(0, 280),
      kind:        msg.kind === 'objection' ? 'objection' : 'taunt',
      ts:          Number(msg.ts) || Date.now(),
      reply_to:    msg.replyTo ? JSON.stringify(msg.replyTo) : null,
    })
    if (msgs.length > 500) msgs.splice(0, msgs.length - 500)
    _mem.set(roomCode, msgs)
  }
}

function memClearRoom(room) {
  _mem.delete(room)
  _memMembers.delete(room)
  _memHosts.delete(room)
  // keep reactions in place briefly — they'll be orphaned automatically
}

const USE_DB = !!process.env.DATABASE_URL
let sql     = null
let dbReady = null

async function getSQL() {
  if (sql) return sql
  const { neon } = await import('@neondatabase/serverless')
  sql = neon(process.env.DATABASE_URL)
  return sql
}

async function ensureSchema() {
  if (dbReady) return dbReady
  dbReady = (async () => {
    const db = await getSQL()
    await db`CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY, room_code TEXT NOT NULL, author_id TEXT NOT NULL,
      author_name TEXT NOT NULL DEFAULT 'Player', avatar TEXT DEFAULT '',
      color TEXT DEFAULT '', text TEXT NOT NULL,
      kind TEXT NOT NULL DEFAULT 'taunt', ts BIGINT NOT NULL,
      reply_to TEXT DEFAULT NULL,
      created_at TIMESTAMPTZ DEFAULT now()
    )`
    await db`ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS reply_to TEXT DEFAULT NULL`
    await db`CREATE INDEX IF NOT EXISTS chat_room_ts_idx ON chat_messages (room_code, ts)`
    await db`CREATE TABLE IF NOT EXISTS chat_reactions (
      msg_id TEXT NOT NULL, emoji TEXT NOT NULL, user_id TEXT NOT NULL,
      PRIMARY KEY (msg_id, emoji, user_id)
    )`
    await db`CREATE TABLE IF NOT EXISTS chat_members (
      room_code TEXT NOT NULL, user_id TEXT NOT NULL, is_host BOOLEAN DEFAULT FALSE,
      joined_at TIMESTAMPTZ DEFAULT now(),
      PRIMARY KEY (room_code, user_id)
    )`
  })().catch(e => { dbReady = null; throw e })
  return dbReady
}

async function dbIsMember(db, room, userId) {
  const rows = await db`
    SELECT 1 FROM chat_members WHERE room_code = ${room} AND user_id = ${String(userId).toLowerCase()} LIMIT 1
  `
  return rows.length > 0
}

function parseReplyTo(raw) {
  if (!raw) return null
  try { return typeof raw === 'string' ? JSON.parse(raw) : raw } catch { return null }
}

function parseBody(req) {
  if (!req.body) return {}
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body) } catch { return {} }
  }
  return req.body
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(204).end()

  try {
    // ── POST: register member OR send message ──────────────────────────
    if (req.method === 'POST') {
      const body = parseBody(req)

      // Register a room member (called on join/create)
      if (body.action === 'join') {
        const { roomCode, userId, isHost } = body
        if (!roomCode || !userId) return res.status(400).json({ error: 'bad payload' })
        const uid = String(userId).toLowerCase()
        if (USE_DB) {
          const db = await getSQL()
          await ensureSchema()
          await db`
            INSERT INTO chat_members (room_code, user_id, is_host)
            VALUES (${roomCode}, ${uid}, ${!!isHost})
            ON CONFLICT (room_code, user_id) DO NOTHING
          `
        } else {
          addMember(roomCode, uid, !!isHost)
        }
        return res.status(200).json({ ok: true })
      }

      // Send a chat message
      const { roomCode, msg } = body
      if (!roomCode || !msg?.text || !msg?.authorId)
        return res.status(400).json({ error: 'bad payload' })

      const uid = String(msg.authorId).toLowerCase()

      if (USE_DB) {
        const db = await getSQL()
        await ensureSchema()
        // Only members can post
        const member = await dbIsMember(db, roomCode, uid)
        if (!member) return res.status(403).json({ error: 'not a member of this room' })
        await db`INSERT INTO chat_messages
          (id, room_code, author_id, author_name, avatar, color, text, kind, ts, reply_to)
          VALUES (${String(msg.id)}, ${roomCode}, ${uid},
            ${msg.authorName || 'Player'}, ${msg.avatar || ''}, ${msg.color || ''},
            ${String(msg.text).slice(0, 280)},
            ${msg.kind === 'objection' ? 'objection' : 'taunt'},
            ${Number(msg.ts) || Date.now()},
            ${msg.replyTo ? JSON.stringify(msg.replyTo) : null})
          ON CONFLICT (id) DO NOTHING`
      } else {
        if (!isMember(roomCode, uid)) return res.status(403).json({ error: 'not a member of this room' })
        memPost(roomCode, msg)
      }
      return res.status(200).json({ ok: true })
    }

    // ── GET: fetch messages (members only) ─────────────────────────────
    if (req.method === 'GET') {
      const room   = String(req.query.room   || '')
      const since  = Number(req.query.since  || 0)
      const userId = String(req.query.userId || '').toLowerCase()
      if (!room) return res.status(400).json({ error: 'room required' })

      if (USE_DB) {
        const db = await getSQL()
        await ensureSchema()
        if (userId) {
          const member = await dbIsMember(db, room, userId)
          if (!member) return res.status(403).json({ error: 'not a member of this room' })
        }
        const rows = await db`
          SELECT id, author_id, author_name, avatar, color, text, kind, ts, reply_to
          FROM chat_messages WHERE room_code = ${room} AND ts > ${since}
          ORDER BY ts ASC LIMIT 100
        `
        let messages = rows
        if (rows.length) {
          const msgIds = rows.map(r => r.id)
          const rxRows = await db`SELECT msg_id, emoji, user_id FROM chat_reactions WHERE msg_id = ANY(${msgIds})`
          const rxMap = {}
          for (const rx of rxRows) {
            if (!rxMap[rx.msg_id]) rxMap[rx.msg_id] = {}
            if (!rxMap[rx.msg_id][rx.emoji]) rxMap[rx.msg_id][rx.emoji] = []
            rxMap[rx.msg_id][rx.emoji].push(rx.user_id)
          }
          messages = rows.map(r => ({
            ...r,
            reactions: rxMap[r.id] || {},
            reply_to:  parseReplyTo(r.reply_to),
          }))
        }
        return res.status(200).json({ messages })
      }

      if (userId && !isMember(room, userId)) {
        return res.status(403).json({ error: 'not a member of this room' })
      }
      return res.status(200).json({ messages: memGet(room, since) })
    }

    // ── PATCH: toggle reaction (members only) ──────────────────────────
    if (req.method === 'PATCH') {
      const { roomCode, msgId, emoji, userId } = parseBody(req)
      const VALID = ['👍', '🔥', '⚖️']
      if (!roomCode || !msgId || !emoji || !userId || !VALID.includes(emoji))
        return res.status(400).json({ error: 'bad payload' })

      const uid = String(userId).toLowerCase()

      if (USE_DB) {
        const db = await getSQL()
        await ensureSchema()
        const member = await dbIsMember(db, roomCode, uid)
        if (!member) return res.status(403).json({ error: 'not a member of this room' })
        const exists = await db`SELECT 1 FROM chat_reactions WHERE msg_id=${msgId} AND emoji=${emoji} AND user_id=${uid}`
        if (exists.length) {
          await db`DELETE FROM chat_reactions WHERE msg_id=${msgId} AND emoji=${emoji} AND user_id=${uid}`
        } else {
          await db`INSERT INTO chat_reactions (msg_id,emoji,user_id) VALUES (${msgId},${emoji},${uid}) ON CONFLICT DO NOTHING`
        }
        const all = await db`SELECT emoji, user_id FROM chat_reactions WHERE msg_id=${msgId}`
        const reactions = {}
        for (const r of all) {
          if (!reactions[r.emoji]) reactions[r.emoji] = []
          reactions[r.emoji].push(r.user_id)
        }
        return res.status(200).json({ ok: true, reactions })
      }

      if (!isMember(roomCode, uid)) return res.status(403).json({ error: 'not a member of this room' })
      const cur   = { ...(_memReactions.get(msgId) || {}) }
      const users = cur[emoji] ? [...cur[emoji]] : []
      const idx   = users.indexOf(uid)
      if (idx >= 0) { users.splice(idx, 1) } else { users.push(uid) }
      if (users.length) { cur[emoji] = users } else { delete cur[emoji] }
      _memReactions.set(msgId, cur)
      return res.status(200).json({ ok: true, reactions: cur })
    }

    // ── DELETE: wipe room chat history + membership ────────────────────
    if (req.method === 'DELETE') {
      const room   = String(req.query.room   || '')
      const userId = String(req.query.userId || '').toLowerCase()
      if (!room || !userId) return res.status(400).json({ error: 'bad payload' })

      if (USE_DB) {
        const db = await getSQL()
        await ensureSchema()
        // Only members may trigger a wipe (host check is enforced client-side)
        const member = await dbIsMember(db, room, userId)
        if (!member) return res.status(403).json({ error: 'not a member of this room' })
        // Delete all messages (reactions cascade via msg_id scoped query)
        const msgIds = await db`SELECT id FROM chat_messages WHERE room_code = ${room}`
        if (msgIds.length) {
          const ids = msgIds.map(r => r.id)
          await db`DELETE FROM chat_reactions WHERE msg_id = ANY(${ids})`
        }
        await db`DELETE FROM chat_messages WHERE room_code = ${room}`
        await db`DELETE FROM chat_members   WHERE room_code = ${room}`
        return res.status(200).json({ ok: true })
      }

      if (!isMember(room, userId)) return res.status(403).json({ error: 'not a member of this room' })
      memClearRoom(room)
      return res.status(200).json({ ok: true })
    }

    res.setHeader('Allow', 'GET, POST, PATCH, DELETE')
    return res.status(405).end()
  } catch (e) {
    console.error('[chat api]', e)
    return res.status(500).json({ error: 'server error', detail: String(e?.message || e) })
  }
}
