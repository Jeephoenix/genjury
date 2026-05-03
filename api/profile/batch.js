// api/profile/batch.js — GET /api/profile/batch?addresses=addr1,addr2,...
// Returns { [lowercaseAddress]: { username, avatarUrl, color } }
// Accepts up to 50 addresses per request; silently ignores extras.

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

  const raw = String(req.query.addresses || '')
  const addresses = raw
    .split(',')
    .map(a => a.trim().toLowerCase())
    .filter(a => a.startsWith('0x') && a.length >= 10)
    .slice(0, 50)

  if (!addresses.length) return res.status(200).json({})

  if (!USE_DB) {
    // No DB — return empty map; clients fall back to contract names
    return res.status(200).json({})
  }

  try {
    const db = await getSQL()
    await ensureSchema()
    const rows = await db`
      SELECT address, username, avatar_url, color
      FROM player_profiles
      WHERE address = ANY(${addresses})
    `
    const result = {}
    for (const r of rows) {
      result[r.address] = {
        username:  r.username,
        avatarUrl: r.avatar_url,
        color:     r.color,
      }
    }
    return res.status(200).json(result)
  } catch (e) {
    console.error('[profile/batch]', e)
    return res.status(500).json({})
  }
}
