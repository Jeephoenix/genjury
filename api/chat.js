/**
 * Vercel Serverless Function — /api/chat
 * Handles GET (fetch messages), POST (send message), PATCH (toggle reaction)
 *
 * In-memory store is used when DATABASE_URL is not set.
 * NOTE: Vercel serverless functions are stateless; in-memory data resets on
 * cold starts. For persistent chat, set DATABASE_URL (Neon / Supabase etc.).
 */

// ── In-memory fallback ──────────────────────────────────────────────────────
const _mem = new Map()          // roomCode → message[]
const _memReactions = new Map() // msgId    → { emoji: userId[] }

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

// ── DB helpers (only used when DATABASE_URL is present) ─────────────────────
let _db = null
async function getDb() {
  if (_db) return _db
  const { drizzle }    = await import('drizzle-orm/neon-http')
  const { neon }       = await import('@neondatabase/serverless')
  const { chatMessages, chatReactions } = await import('@workspace/db')
  const sql = neon(process.env.DATABASE_URL)
  _db = { db: drizzle(sql), chatMessages, chatReactions }
  return _db
}

const USE_DB = !!process.env.DATABASE_URL

// ── CORS headers ─────────────────────────────────────────────────────────────
function cors(res) {
  res.setHeader('Access-Control-Allow-Origin',  '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

// ── Handler ──────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(204).end()

  // ── GET /api/chat?room=...&since=... ──────────────────────────────────────
  if (req.method === 'GET') {
    const room  = String(req.query.room  || '')
    const since = Number(req.query.since || 0)
    if (!room) return res.status(400).json({ error: 'room required' })

    if (USE_DB) {
      try {
        const { db, chatMessages, chatReactions } = await getDb()
        const { eq, gt, and, inArray } = await import('drizzle-orm')
        const rows = await db
          .select()
          .from(chatMessages)
          .where(and(eq(chatMessages.roomCode, room), gt(chatMessages.ts, since)))
          .orderBy(chatMessages.ts)
          .limit(100)

        let messages = rows
        if (rows.length) {
          const msgIds = rows.map(r => r.id)
          const rxRows = await db.select().from(chatReactions).where(inArray(chatReactions.msgId, msgIds))
          const rxMap  = {}
          for (const rx of rxRows) {
            if (!rxMap[rx.msgId])         rxMap[rx.msgId] = {}
            if (!rxMap[rx.msgId][rx.emoji]) rxMap[rx.msgId][rx.emoji] = []
            rxMap[rx.msgId][rx.emoji].push(rx.userId)
          }
          messages = rows.map(r => ({ ...r, reactions: rxMap[r.id] || {} }))
        }
        return res.status(200).json({ messages })
      } catch (e) {
        console.error('chat GET db error', e)
        return res.status(500).json({ error: 'server error' })
      }
    }

    return res.status(200).json({ messages: memGet(room, since) })
  }

  // ── POST /api/chat ────────────────────────────────────────────────────────
  if (req.method === 'POST') {
    const { roomCode, msg } = req.body || {}
    if (!roomCode || !msg?.text || !msg?.authorId) {
      return res.status(400).json({ error: 'bad payload' })
    }

    if (USE_DB) {
      try {
        const { db, chatMessages } = await getDb()
        await db.insert(chatMessages).values({
          id:         String(msg.id),
          roomCode,
          authorId:   msg.authorId,
          authorName: msg.authorName,
          avatar:     msg.avatar  || '',
          color:      msg.color   || '',
          text:       String(msg.text).slice(0, 280),
          kind:       msg.kind === 'objection' ? 'objection' : 'taunt',
          ts:         Number(msg.ts) || Date.now(),
        }).onConflictDoNothing()
        return res.status(200).json({ ok: true })
      } catch (e) {
        console.error('chat POST db error', e)
        return res.status(500).json({ error: 'server error' })
      }
    }

    memPost(roomCode, msg)
    return res.status(200).json({ ok: true })
  }

  // ── PATCH /api/chat (toggle reaction) ─────────────────────────────────────
  if (req.method === 'PATCH') {
    const { roomCode, msgId, emoji, userId } = req.body || {}
    const VALID = ['👍', '🔥', '⚖️']
    if (!roomCode || !msgId || !emoji || !userId || !VALID.includes(emoji)) {
      return res.status(400).json({ error: 'bad payload' })
    }

    if (USE_DB) {
      try {
        const { db, chatReactions } = await getDb()
        const { eq, and }  = await import('drizzle-orm')
        const existing = await db.select().from(chatReactions)
          .where(and(eq(chatReactions.msgId, msgId), eq(chatReactions.emoji, emoji), eq(chatReactions.userId, userId)))

        if (existing.length) {
          await db.delete(chatReactions).where(
            and(eq(chatReactions.msgId, msgId), eq(chatReactions.emoji, emoji), eq(chatReactions.userId, userId))
          )
        } else {
          await db.insert(chatReactions).values({ msgId, emoji, userId }).onConflictDoNothing()
        }

        const all       = await db.select().from(chatReactions).where(eq(chatReactions.msgId, msgId))
        const reactions = {}
        for (const r of all) {
          if (!reactions[r.emoji]) reactions[r.emoji] = []
          reactions[r.emoji].push(r.userId)
        }
        return res.status(200).json({ ok: true, reactions })
      } catch (e) {
        console.error('chat PATCH db error', e)
        return res.status(500).json({ error: 'server error' })
      }
    }

    // In-memory reaction toggle
    const cur   = { ...(_memReactions.get(msgId) || {}) }
    const users = cur[emoji] ? [...cur[emoji]] : []
    const idx   = users.indexOf(userId)
    if (idx >= 0) { users.splice(idx, 1) } else { users.push(userId) }
    if (users.length) { cur[emoji] = users } else { delete cur[emoji] }
    _memReactions.set(msgId, cur)
    return res.status(200).json({ ok: true, reactions: cur })
  }

  return res.status(405).json({ error: 'method not allowed' })
}
