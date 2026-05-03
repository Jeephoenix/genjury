// api/profile/check.js — GET /api/profile/check?username=
// Returns { available: true/false, error?: string }
// Checks uniqueness against DB (Neon) or in-memory map.

const _mem = new Map() // username_lower -> address (fallback when no DB)

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

function validateUsername(raw) {
  const u = (raw || '').trim()
  if (u.length < 5)  return { ok: false, error: 'At least 5 characters required.' }
  if (u.length > 24) return { ok: false, error: 'Max 24 characters.' }
  if (!/^[\w\s\-]+$/.test(u)) return { ok: false, error: 'Letters, numbers, spaces, _ or - only.' }
  return { ok: true, value: u }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET') return res.status(405).end()

  const val = validateUsername(req.query.username)
  if (!val.ok) return res.status(200).json({ available: false, error: val.error })

  const lower = val.value.toLowerCase()

  try {
    if (USE_DB) {
      const db = await getSQL()
      await ensureSchema()
      const rows = await db`SELECT 1 FROM player_profiles WHERE username_lower = ${lower} LIMIT 1`
      return res.status(200).json({ available: rows.length === 0 })
    }
    return res.status(200).json({ available: !_mem.has(lower) })
  } catch (e) {
    console.error('[profile/check]', e)
    return res.status(500).json({ error: 'server error' })
  }
}
