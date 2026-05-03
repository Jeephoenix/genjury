// api/profile/[address].js — GET /api/profile/:address
// Returns the profile for a wallet address, or 404 if not claimed.

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

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET') return res.status(405).end()

  const addr = String(req.query.address || '').toLowerCase().trim()
  if (!addr) return res.status(400).json({ error: 'address required' })

  try {
    if (USE_DB) {
      const db = await getSQL()
      await ensureSchema()
      const rows = await db`
        SELECT address, username, avatar_url, color, registered_at
        FROM player_profiles WHERE address = ${addr} LIMIT 1
      `
      if (!rows.length) return res.status(404).json({ error: 'not found' })
      const r = rows[0]
      return res.status(200).json({
        address:      r.address,
        username:     r.username,
        avatarUrl:    r.avatar_url,
        color:        r.color,
        registeredAt: r.registered_at,
      })
    }

    const p = _mem.get(addr)
    if (!p) return res.status(404).json({ error: 'not found' })
    return res.status(200).json({
      address:   p.address,
      username:  p.username,
      avatarUrl: p.avatar_url,
      color:     p.color,
    })
  } catch (e) {
    console.error('[profile/address]', e)
    return res.status(500).json({ error: 'server error' })
  }
}
