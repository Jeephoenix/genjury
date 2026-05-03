// api/faucet.js — Vercel serverless proxy for debug_fundAccount
//
// The browser cannot call the GenLayer Studio RPC directly from production
// (CORS + the default studionet URL is localhost:4000). This endpoint runs
// server-side where GENLAYER_RPC is a private env var pointing at the real
// node, so the browser only ever talks to /api/faucet.
//
// Required env var (set in Vercel dashboard):
//   GENLAYER_RPC=https://studio.genlayer.com/api    (or wherever your node is)
//
// Optional:
//   GENLAYER_NETWORK=studionet   (only studionet/localnet allowed to fund)

const ALLOWED_NETWORKS = ['studionet', 'localnet']
const MAX_AMOUNT_HEX = '0x56BC75E2D63100000' // 100 GEN in wei

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const rpc = process.env.GENLAYER_RPC
  if (!rpc) {
    return res.status(503).json({
      error: 'GENLAYER_RPC env var is not configured on the server.',
    })
  }

  const network = (process.env.GENLAYER_NETWORK || 'studionet').toLowerCase()
  if (!ALLOWED_NETWORKS.includes(network)) {
    return res.status(403).json({
      error: 'Faucet is only available on studionet and localnet.',
    })
  }

  let body
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
  } catch {
    return res.status(400).json({ error: 'Invalid JSON body' })
  }

  const address = body?.address
  if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
    return res.status(400).json({ error: 'Invalid or missing address' })
  }

  const amount = body?.amount || MAX_AMOUNT_HEX

  try {
    const upstream = await fetch(rpc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'debug_fundAccount',
        params: [address, amount],
      }),
    })

    const data = await upstream.json()

    if (data?.error) {
      const msg = data.error.message || JSON.stringify(data.error)
      return res.status(502).json({ error: `RPC error: ${msg}` })
    }

    return res.status(200).json({ result: data?.result ?? null })
  } catch (err) {
    return res.status(502).json({
      error: `Failed to reach GenLayer RPC: ${err?.message || 'Unknown error'}`,
    })
  }
}
