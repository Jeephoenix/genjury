import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL)

// One-time table create (cheap to run; IF NOT EXISTS).
let ready
async function ensureSchema() {
  if (ready) return ready
  ready = sql`
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
  return ready
}

export default async function handler(req, res) {
  try {
    await ensureSchema()

    if (req.method === 'GET') {
      const room  = String(req.query.room  || '')
      const since = Number(req.query.since || 0)
      if (!room) return res.status(400).json({ error: 'room required' })

      const rows = await sql`
        SELECT id, author_id, author_name, avatar, color, text, kind, ts
        FROM chat_messages
        WHERE room_code = ${room} AND ts > ${since}
        ORDER BY ts ASC
        LIMIT 100
      `
      return res.status(200).json({ messages: rows })
    }

    if (req.method === 'POST') {
      const { roomCode, msg } = req.body || {}
      if (!roomCode || !msg?.text || !msg?.authorId) {
        return res.status(400).json({ error: 'bad payload' })
      }
      const text = String(msg.text).slice(0, 280)
      const kind = msg.kind === 'objection' ? 'objection' : 'taunt'
      const ts   = Number(msg.ts) || Date.now()
      const id   = String(msg.id)

      await sql`
        INSERT INTO chat_messages
          (id, room_code, author_id, author_name, avatar, color, text, kind, ts)
        VALUES
          (${id}, ${roomCode}, ${msg.authorId}, ${msg.authorName},
           ${msg.avatar || ''}, ${msg.color || ''}, ${text}, ${kind}, ${ts})
        ON CONFLICT (id) DO NOTHING
      `
      return res.status(200).json({ ok: true })
    }

    res.setHeader('Allow', 'GET, POST')
    return res.status(405).end()
  } catch (e) {
    console.error(e)
    return res.status(500).json({ error: 'server error' })
  }
}
