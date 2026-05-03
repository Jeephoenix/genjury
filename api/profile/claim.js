// api/profile/claim.js — POST /api/profile/claim
// Body: { address, username, avatarUrl?, color? }
// Returns { ok: true, username } or 400/409/503 with { error }
//
// Requires DATABASE_URL (Neon Postgres). Without it the endpoint returns 503
// so the client never shows a false "permanent" success to the user.

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

function validateUsername(raw) {
  const u = (raw || '').trim()
  if (u.length < 5)  return { ok: false, error: 'At least 5 characters required.' }
  if (u.length > 24) return { ok: false, error: 'Max 24 characters.' }
  if (!/^[\w\s\-]+$/.test(u)) return { ok: false, error: 'Letters, numbers, spaces, _ or - only.' }
  return { ok: true, value: u }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).end()

  // Hard requirement — never fake a permanent identity without a real DB.
  if (!USE_DB) {
    return res.status(503).json({
      error: 'Identity registry is not configured. The DATABASE_URL environment variable is missing — add a Neon Postgres database to your Vercel project settings.',
    })
  }

  const { address, username, avatarUrl = '', color = '#a259ff' } = parseBody(req)

  if (!address || typeof address !== 'string')
    return res.status(400).json({ error: 'address required' })

  const addr = address.toLowerCase().trim()
  const val  = validateUsername(username)
  if (!val.ok) return res.status(400).json({ error: val.error })

  const uname = val.value
  const lower = uname.toLowerCase()
  const av    = String(avatarUrl || '').slice(0, 400000)
  const col   = String(color    || '#a259ff').slice(0, 32)

  try {
    const db = await getSQL()
    await ensureSchema()

    // Check if this wallet already has a claimed identity
    const existing = await db`SELECT username FROM player_profiles WHERE address = ${addr} LIMIT 1`
    if (existing.length) {
      return res.status(409).json({
        error: 'This wallet already has a claimed identity.',
        username: existing[0].username,
      })
    }

    // Check if username is taken
    const taken = await db`SELECT 1 FROM player_profiles WHERE username_lower = ${lower} LIMIT 1`
    if (taken.length) {
      return res.status(409).json({ error: 'Username already taken. Choose a different name.' })
    }

    await db`
      INSERT INTO player_profiles (address, username, username_lower, avatar_url, color)
      VALUES (${addr}, ${uname}, ${lower}, ${av}, ${col})
    `
    return res.status(200).json({ ok: true, username: uname })

  } catch (e) {
    const msg  = String(e?.message || '').toLowerCase()
    const code = e?.code
    const isConflict = msg.includes('unique') || code === '23505' || msg.includes('already')
    if (isConflict) {
      return res.status(409).json({ error: 'Username already taken. Choose a different name.' })
    }
    console.error('[profile/claim] DB error:', e?.message || e)
    return res.status(500).json({ error: 'Database error — please try again shortly.' })
  }
}
