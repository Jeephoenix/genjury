// api/profile/batch.js — GET /api/profile/batch?addresses=addr1,addr2,...
// Returns { [lowercaseAddress]: { username?, avatarUrl?, color?, ensName? } }
// Accepts up to 50 addresses per request; silently ignores extras.
// ensName is included from the server-side ens_cache table when available.

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
    await db`
      CREATE TABLE IF NOT EXISTS ens_cache (
        address    TEXT PRIMARY KEY,
        ens_name   TEXT NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT now()
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

  const raw = String(req.query.addresses || '')
  const addresses = raw
    .split(',')
    .map(a => a.trim().toLowerCase())
    .filter(a => a.startsWith('0x') && a.length >= 10)
    .slice(0, 50)

  if (!addresses.length) return res.status(200).json({})

  if (!USE_DB) {
    return res.status(200).json({})
  }

  try {
    const db = await getSQL()
    await ensureSchema()

    // Left join ens_cache so ENS names come back alongside profile data in
    // a single round-trip, even for addresses that haven't claimed a username.
    const rows = await db`
      SELECT
        COALESCE(p.address, e.address) AS address,
        p.username,
        p.avatar_url,
        p.color,
        e.ens_name
      FROM player_profiles p
      FULL OUTER JOIN ens_cache e ON e.address = p.address
      WHERE COALESCE(p.address, e.address) = ANY(${addresses})
    `
    const result = {}
    for (const r of rows) {
      const entry = {}
      if (r.username)  entry.username  = r.username
      if (r.avatar_url) entry.avatarUrl = r.avatar_url
      if (r.color)     entry.color     = r.color
      if (r.ens_name)  entry.ensName   = r.ens_name
      if (Object.keys(entry).length) result[r.address] = entry
    }
    return res.status(200).json(result)
  } catch (e) {
    console.error('[profile/batch]', e)
    return res.status(500).json({})
  }
}
