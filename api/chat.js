// ─────────────────────────────────────────────────────────────────────────────
  // api/chat.js — Vercel serverless handler for room chat
  //
  // Storage strategy:
  //   1. If DATABASE_URL is set → Neon PostgreSQL (persistent, production-grade)
  //   2. Otherwise → module-level in-memory Map (works on single warm instances;
  //      fine for dev / preview; data resets on cold start)
  // ─────────────────────────────────────────────────────────────────────────────
  import { neon } from '@neondatabase/serverless'

  // ── Neon (production) ─────────────────────────────────────────────────────────
  const USE_DB = !!process.env.DATABASE_URL
  const sql    = USE_DB ? neon(process.env.DATABASE_URL) : null
  let   dbReady = null

  async function ensureSchema() {
    if (!USE_DB) return
    if (dbReady) return dbReady
    dbReady = sql`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id          TEXT PRIMARY KEY,
        room_code   TEXT NOT NULL,
        author_id   TEXT NOT NULL,
        author_name TEXT NOT NULL,
        avatar      TEXT,
        color       TEXT,
        text        TEXT NOT NULL,
        kind        TEXT NOT NULL DEFAULT 'taunt',
        ts          BIGINT NOT NULL,
        created_at  TIMESTAMPTZ DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS chat_room_ts_idx
        ON chat_messages (room_code, ts);
    `
    return dbReady
  }

  // ── In-memory fallback (dev / preview without a DB) ──────────────────────────
  // Map<roomCode, Array<row>>  — capped at 500 msgs per room.
  // NOTE: Each Vercel function instance has its own Map; scale-out = separate
  // in-memory stores. Acceptable for dev; use DATABASE_URL for production.
  const _mem = new Map()

  function memGet(room, since) {
    return (_mem.get(room) || []).filter(m => m.ts > since).slice(-100)
  }

  function memPost(roomCode, msg) {
    const msgs = _mem.get(roomCode) || []
    if (!msgs.some(m => m.id === msg.id)) {
      msgs.push({
        id:          String(msg.id),
        author_id:   String(msg.authorId  || ''),
        author_name: String(msg.authorName || 'Player'),
        avatar:      String(msg.avatar    || ''),
        color:       String(msg.color     || ''),
        text:        String(msg.text      || '').slice(0, 280),
        kind:        msg.kind === 'objection' ? 'objection' : 'taunt',
        ts:          Number(msg.ts) || Date.now(),
      })
      if (msgs.length > 500) msgs.splice(0, msgs.length - 500)
      _mem.set(roomCode, msgs)
    }
  }

  // ── Handler ───────────────────────────────────────────────────────────────────
  export default async function handler(req, res) {
    // Allow Vite dev proxy requests from localhost
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    if (req.method === 'OPTIONS') return res.status(204).end()

    try {
      if (req.method === 'GET') {
        const room  = String(req.query.room  || '')
        const since = Number(req.query.since || 0)
        if (!room) return res.status(400).json({ error: 'room required' })

        if (USE_DB) {
          await ensureSchema()
          const rows = await sql`
            SELECT id, author_id, author_name, avatar, color, text, kind, ts
            FROM chat_messages
            WHERE room_code = ${room} AND ts > ${since}
            ORDER BY ts ASC
            LIMIT 100
          `
          return res.status(200).json({ messages: rows })
        }
        return res.status(200).json({ messages: memGet(room, since) })
      }

      if (req.method === 'POST') {
        const body = typeof req.body === 'string'
          ? (() => { try { return JSON.parse(req.body) } catch { return {} } })()
          : (req.body || {})
        const { roomCode, msg } = body
        if (!roomCode || !msg?.text || !msg?.authorId) {
          return res.status(400).json({ error: 'bad payload' })
        }

        if (USE_DB) {
          await ensureSchema()
          const text = String(msg.text).slice(0, 280)
          const kind = msg.kind === 'objection' ? 'objection' : 'taunt'
          const ts   = Number(msg.ts) || Date.now()
          await sql`
            INSERT INTO chat_messages
              (id, room_code, author_id, author_name, avatar, color, text, kind, ts)
            VALUES
              (${String(msg.id)}, ${roomCode}, ${msg.authorId}, ${msg.authorName},
               ${msg.avatar || ''}, ${msg.color || ''}, ${text}, ${kind}, ${ts})
            ON CONFLICT (id) DO NOTHING
          `
        } else {
          memPost(roomCode, msg)
        }
        return res.status(200).json({ ok: true })
      }

      res.setHeader('Allow', 'GET, POST')
      return res.status(405).end()
    } catch (e) {
      console.error('[chat api]', e)
      return res.status(500).json({ error: 'server error', detail: String(e.message) })
    }
  }
  