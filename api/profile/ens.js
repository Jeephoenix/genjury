// api/profile/ens.js
//
// GET  /api/profile/ens?addresses=addr1,addr2,...
//   Returns { [lowercaseAddress]: ensName } for addresses that have a cached
//   ENS name. Addresses without a cache entry are omitted.
//
// POST /api/profile/ens
//   Body: { address: string, ensName: string }
//   Upserts the ENS name for the given address into the server-side cache.
//   Returns { ok: true } on success.
//   Anyone who resolves an ENS name client-side should report it here so that
//   subsequent clients skip the mainnet RPC call.

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
      CREATE TABLE IF NOT EXISTS ens_cache (
        address    TEXT PRIMARY KEY,
        ens_name   TEXT NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT now()
      )
    `
  })().catch(e => { dbReady = null; throw e })
  return dbReady
}

function isValidAddress(a) {
  return typeof a === 'string' && /^0x[0-9a-f]{40}$/i.test(a.trim())
}

function isValidEnsName(name) {
  if (typeof name !== 'string') return false
  const trimmed = name.trim()
  return trimmed.length >= 3 && trimmed.length <= 255 && trimmed.includes('.')
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(204).end()

  // ── GET: batch lookup from cache ──────────────────────────────────────────
  if (req.method === 'GET') {
    const raw = String(req.query.addresses || '')
    const addresses = raw
      .split(',')
      .map(a => a.trim().toLowerCase())
      .filter(isValidAddress)
      .slice(0, 100)

    if (!addresses.length) return res.status(200).json({})
    if (!USE_DB)            return res.status(200).json({})

    try {
      const db = await getSQL()
      await ensureSchema()
      const rows = await db`
        SELECT address, ens_name
        FROM ens_cache
        WHERE address = ANY(${addresses})
      `
      const result = {}
      for (const r of rows) result[r.address] = r.ens_name
      return res.status(200).json(result)
    } catch (e) {
      console.error('[profile/ens GET]', e)
      return res.status(500).json({})
    }
  }

  // ── POST: store ENS name ───────────────────────────────────────────────────
  if (req.method === 'POST') {
    let body = req.body || {}
    if (typeof body === 'string') { try { body = JSON.parse(body) } catch { body = {} } }

    const address = String(body.address || '').trim().toLowerCase()
    const ensName = String(body.ensName || '').trim()

    if (!isValidAddress(address))
      return res.status(400).json({ error: 'Invalid address.' })
    if (!isValidEnsName(ensName))
      return res.status(400).json({ error: 'Invalid ENS name.' })

    if (!USE_DB) return res.status(200).json({ ok: true })

    try {
      const db = await getSQL()
      await ensureSchema()
      await db`
        INSERT INTO ens_cache (address, ens_name, updated_at)
        VALUES (${address}, ${ensName}, now())
        ON CONFLICT (address) DO UPDATE
          SET ens_name   = EXCLUDED.ens_name,
              updated_at = now()
      `
      return res.status(200).json({ ok: true })
    } catch (e) {
      console.error('[profile/ens POST]', e)
      return res.status(500).json({ error: 'Server error.' })
    }
  }

  return res.status(405).end()
}
