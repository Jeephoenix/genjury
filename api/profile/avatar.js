// api/profile/avatar.js — PATCH /api/profile/avatar
// Body: { address, avatarUrl }
// Updates avatar for an existing profile. Username stays locked forever.

const _mem = new Map() // address -> profile (fallback when no DB)

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
    await db`
      CREATE TABLE IF NOT EXISTS player_profiles (
        address        TEXT PRIMARY KEY,
        username       TEXT NOT NULL,
        username_lower TEXT NOT NULL,
        avatar_url     TEXT NOT NULL DEFAULT '',
        color          TEXT NOT NULL DEFAULT '#a259ff',
        registered_at  TIMESTAMPTZ DEFAULT now(),
        CONSTRAINT player_profiles_username_lower_uniq UNIQUE (username_lower)
      )
    `
  })().catch(e => { dbReady = null; throw e })
  return dbReady
}

function parseBody(req) {
  if (!req.body) return {}
  if (typeof req.body === 'string') { try { return JSON.parse(req.body) } catch { return {} } }
  return req.body
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*')
  res.setHeader('Access-Control-Allow-Methods', 'PATCH, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'PATCH') return res.status(405).end()

  const { address, avatarUrl } = parseBody(req)
  if (!address) return res.status(400).json({ error: 'address required' })

  const addr = address.toLowerCase().trim()
  const av   = String(avatarUrl || '').slice(0, 400000)

  try {
    if (USE_DB) {
      const db = await getSQL()
      await ensureSchema()
      const rows = await db`UPDATE player_profiles SET avatar_url = ${av} WHERE address = ${addr} RETURNING username`
      if (!rows.length) return res.status(404).json({ error: 'Profile not found.' })
      return res.status(200).json({ ok: true })
    }

    const p = _mem.get(addr)
    if (!p) return res.status(404).json({ error: 'Profile not found.' })
    _mem.set(addr, { ...p, avatar_url: av })
    return res.status(200).json({ ok: true })
  } catch (e) {
    console.error('[profile/avatar]', e)
    return res.status(500).json({ error: 'server error' })
  }
}
