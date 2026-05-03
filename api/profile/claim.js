// api/profile/claim.js — POST /api/profile/claim
// Body: { address, username, avatarUrl?, color? }
// Returns { ok: true, username } or 400/409 with { error }

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
    if (USE_DB) {
      const db = await getSQL()
      await ensureSchema()

      // Check address already claimed
      const existing = await db`SELECT username FROM player_profiles WHERE address = ${addr} LIMIT 1`
      if (existing.length) {
        return res.status(409).json({ error: 'This wallet already has a claimed identity.', username: existing[0].username })
      }

      try {
        await db`
          INSERT INTO player_profiles (address, username, username_lower, avatar_url, color)
          VALUES (${addr}, ${uname}, ${lower}, ${av}, ${col})
        `
      } catch (e) {
        // Unique constraint violation on username_lower
        if (e?.message?.toLowerCase().includes('unique') || e?.code === '23505') {
          return res.status(409).json({ error: 'Username already taken. Choose a different name.' })
        }
        throw e
      }
      return res.status(200).json({ ok: true, username: uname })
    }

    // In-memory fallback
    if (_mem.has(addr)) {
      return res.status(409).json({ error: 'This wallet already has a claimed identity.', username: _mem.get(addr).username })
    }
    for (const [, p] of _mem) {
      if (p.username_lower === lower) {
        return res.status(409).json({ error: 'Username already taken. Choose a different name.' })
      }
    }
    _mem.set(addr, { address: addr, username: uname, username_lower: lower, avatar_url: av, color: col })
    return res.status(200).json({ ok: true, username: uname })
  } catch (e) {
    console.error('[profile/claim]', e)
    return res.status(500).json({ error: 'server error', detail: String(e?.message || e) })
  }
}
