// api/chat.js — Vercel Serverless Function
//
// IMPORTANT: Zero top-level external imports.
// Any external package (neon) is loaded lazily via dynamic import ONLY when
// DATABASE_URL is set. This guarantees the function boots on cold start even
// with no database configured (pure in-memory fallback).

// ── In-memory fallback ────────────────────────────────────────────────────────
const _mem          = new Map()  // roomCode → msg[]
const _memReactions = new Map()  // msgId    → { emoji: userId[] }

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
    })
    if (msgs.length > 500) msgs.splice(0, msgs.length - 500)
    _mem.set(roomCode, msgs)
  }
}

// ── Neon DB (only when DATABASE_URL is configured) ────────────────────────────
const USE_DB = !!process.env.DATABASE_URL
let sql      = null
let dbReady  = null

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
    await db`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id          TEXT PRIMARY KEY,
        room_code   TEXT NOT NULL,
        author_id   TEXT NOT NULL,
        author_name TEXT NOT NULL DEFAULT 'Player',
        avatar      TEXT DEFAULT '',
        color       TEXT DEFAULT '',
        text        TEXT NOT NULL,
        kind        TEXT NOT NULL DEFAULT 'taunt',
        ts          BIGINT NOT NULL,
        created_at  TIMESTAMPTZ DEFAULT now()
      )
    `
    await db`CREATE INDEX IF NOT EXISTS chat_room_ts_idx ON chat_messages (room_code, ts)`
    await db`
      CREATE TABLE IF NOT EXISTS chat_reactions (
        msg_id  TEXT NOT NULL,
        emoji   TEXT NOT NULL,
        user_id TEXT NOT NULL,
        PRIMARY KEY (msg_id, emoji, user_id)
      )
    `
  })().catch(e => { dbReady = null; throw e })
  return dbReady
}

function parseBody(req) {
  if (!req.body) return {}
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body) } catch { return {} }
  }
  return req.body
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(204).end()

  try {

    if (req.method === 'GET') {
      const room  = String(req.query.room  || '')
      const since = Number(req.query.since || 0)
      if (!room) return res.status(400).json({ error: 'room required' })

      if (USE_DB) {
        const db = await getSQL()
        await ensureSchema()
        const rows = await db`
          SELECT id, author_id, author_name, avatar, color, text, kind, ts
          FROM   chat_messages
          WHERE  room_code = ${room} AND ts > ${since}
          ORDER  BY ts ASC
          LIMIT  100
        `
        let messages = rows
        if (rows.length) {
          const msgIds = rows.map(r => r.id)
          const rxRows = await db`
            SELECT msg_id, emoji, user_id FROM chat_reactions
            WHERE  msg_id = ANY(${msgIds})
          `
          const rxMap = {}
          for (const rx of rxRows) {
            if (!rxMap[rx.msg_id])           rxMap[rx.msg_id] = {}
            if (!rxMap[rx.msg_id][rx.emoji]) rxMap[rx.msg_id][rx.emoji] = []
            rxMap[rx.msg_id][rx.emoji].push(rx.user_id)
          }
          messages = rows.map(r => ({ ...r, reactions: rxMap[r.id] || {} }))
        }
        return res.status(200).json({ messages })
      }

      return res.status(200).json({ messages: memGet(room, since) })
    }

    if (req.method === 'POST') {
      const { roomCode, msg } = parseBody(req)
      if (!roomCode || !msg?.text || !msg?.authorId) {
        return res.status(400).json({ error: 'bad payload' })
      }
      if (USE_DB) {
        const db   = await getSQL()
        await ensureSchema()
        const text = String(msg.text).slice(0, 280)
        const kind = msg.kind === 'objection' ? 'objection' : 'taunt'
        const ts   = Number(msg.ts) || Date.now()
        await db`
          INSERT INTO chat_messages
            (id, room_code, author_id, author_name, avatar, color, text, kind, ts)
          VALUES
            (${String(msg.id)}, ${roomCode}, ${msg.authorId}, ${msg.authorName || 'Player'},
             ${msg.avatar || ''}, ${msg.color || ''}, ${text}, ${kind}, ${ts})
          ON CONFLICT (id) DO NOTHING
        `
      } else {
        memPost(roomCode, msg)
      }
      return res.status(200).json({ ok: true })
    }

    if (req.method === 'PATCH') {
      const { roomCode, msgId, emoji, userId } = parseBody(req)
      const VALID = ['👍', '🔥', '⚖️']
      if (!roomCode || !msgId || !emoji || !userId || !VALID.includes(emoji)) {
        return res.status(400).json({ error: 'bad payload' })
      }
      if (USE_DB) {
        const db = await getSQL()
        await ensureSchema()
        const exists = await db`
          SELECT 1 FROM chat_reactions
          WHERE msg_id = ${msgId} AND emoji = ${emoji} AND user_id = ${userId}
        `
        if (exists.length) {
          await db`DELETE FROM chat_reactions WHERE msg_id = ${msgId} AND emoji = ${emoji} AND user_id = ${userId}`
        } else {
          await db`INSERT INTO chat_reactions (msg_id, emoji, user_id) VALUES (${msgId}, ${emoji}, ${userId}) ON CONFLICT DO NOTHING`
        }
        const all       = await db`SELECT emoji, user_id FROM chat_reactions WHERE msg_id = ${msgId}`
        const reactions = {}
        for (const r of all) {
          if (!reactions[r.emoji]) reactions[r.emoji] = []
          reactions[r.emoji].push(r.user_id)
        }
        return res.status(200).json({ ok: true, reactions })
      }
      const cur   = { ...(_memReactions.get(msgId) || {}) }
      const users = cur[emoji] ? [...cur[emoji]] : []
      const idx   = users.indexOf(userId)
      if (idx >= 0) { users.splice(idx, 1) } else { users.push(userId) }
      if (users.length) { cur[emoji] = users } else { delete cur[emoji] }
      _memReactions.set(msgId, cur)
      return res.status(200).json({ ok: true, reactions: cur })
    }

    res.setHeader('Allow', 'GET, POST, PATCH')
    return res.status(405).end()

  } catch (e) {
    console.error('[chat api]', e)
    return res.status(500).json({ error: 'server error', detail: String(e?.message || e) })
  }
}
