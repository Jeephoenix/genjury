// ENS reverse-lookup utility.
//
// Uses the Cloudflare Ethereum JSON-RPC endpoint to call the ENS public
// resolver on mainnet — no new dependencies needed (viem is already bundled
// via genlayer-js).
//
// After a successful mainnet lookup the result is reported to the server-side
// cache (POST /api/profile/ens) so subsequent clients skip the RPC call and
// read the cached name from the batch endpoint instead.
//
// Priority for display names: server username > ENS name > truncated address.

import { createPublicClient, http } from 'viem'
import { mainnet } from 'viem/chains'

const ENS_RPC    = 'https://cloudflare-eth.com'
const STORAGE_KEY = 'genjury_ens_cache_v1'
const BASE        = '/api/profile'

// In-memory cache: address (lower) → ensName | null
const _cache   = new Map()
const _pending = new Map()
const _listeners = new Set()

// Persist to localStorage so we don't re-fetch on page reload
;(function initPersisted() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const obj = JSON.parse(raw)
    for (const [k, v] of Object.entries(obj)) _cache.set(k, v)
  } catch {}
})()

function persist() {
  try {
    const obj = {}
    for (const [k, v] of _cache) obj[k] = v
    localStorage.setItem(STORAGE_KEY, JSON.stringify(obj))
  } catch {}
}

function notify() {
  for (const fn of _listeners) { try { fn() } catch {} }
}

export function subscribeEns(fn) {
  _listeners.add(fn)
  return () => _listeners.delete(fn)
}

let _client = null
function getClient() {
  if (!_client) {
    _client = createPublicClient({ chain: mainnet, transport: http(ENS_RPC) })
  }
  return _client
}

// Report an ENS name to the server cache (fire-and-forget).
function reportToServer(address, ensName) {
  try {
    fetch(`${BASE}/ens`, {
      method:  'POST',
      headers: { 'content-type': 'application/json' },
      body:    JSON.stringify({ address, ensName }),
    }).catch(() => {})
  } catch {}
}

// Synchronous cache read — use this in render paths.
export function getCachedEnsName(address) {
  if (!address) return null
  const v = _cache.get(address.toLowerCase())
  return v ?? null
}

// Seed the in-memory cache from server-side data returned by the batch
// endpoint. Called by profileApi after a batch fetch so ENS names are
// available synchronously in the same tick.
export function seedEnsCache(map) {
  if (!map) return
  let changed = false
  for (const [addr, name] of Object.entries(map)) {
    if (name && !_cache.has(addr)) {
      _cache.set(addr, name)
      changed = true
    }
  }
  if (changed) { persist(); notify() }
}

// Async reverse lookup. Returns the ENS name or null.
// 1. Checks in-memory cache first (populated from localStorage or server batch)
// 2. Falls back to mainnet RPC lookup
// 3. On success, writes to local cache + reports to server
export async function lookupEnsName(address) {
  if (!address) return null
  const key = address.toLowerCase()

  if (_cache.has(key)) return _cache.get(key)
  if (_pending.has(key)) return _pending.get(key)

  const promise = (async () => {
    try {
      const client = getClient()
      const name = await client.getEnsName({ address: key })
      const result = name || null
      _cache.set(key, result)
      persist()
      if (result) {
        notify()
        reportToServer(key, result)
      }
      return result
    } catch {
      _cache.set(key, null)
      return null
    } finally {
      _pending.delete(key)
    }
  })()

  _pending.set(key, promise)
  return promise
}

// Batch-lookup multiple addresses.
// Returns { [address]: ensName | null }.
// Addresses already in cache are returned immediately; the rest are fetched
// from the server cache first, then fall back to mainnet RPC for any still
// missing. This avoids redundant mainnet calls for names already resolved by
// any other client.
export async function batchLookupEns(addresses) {
  if (!addresses?.length) return {}
  const unique = [...new Set(addresses.map(a => String(a).toLowerCase()).filter(Boolean))]
  const result = {}
  const missing = []

  for (const addr of unique) {
    if (_cache.has(addr)) {
      result[addr] = _cache.get(addr)
    } else {
      missing.push(addr)
    }
  }

  if (!missing.length) return result

  // Check server cache first
  const serverMissing = []
  try {
    const resp = await fetch(
      `${BASE}/ens?addresses=${encodeURIComponent(missing.join(','))}`
    )
    if (resp.ok) {
      const data = await resp.json()
      for (const addr of missing) {
        if (data[addr] !== undefined) {
          result[addr] = data[addr]
          _cache.set(addr, data[addr])
        } else {
          serverMissing.push(addr)
        }
      }
      if (Object.keys(data).length) { persist(); notify() }
    } else {
      serverMissing.push(...missing)
    }
  } catch {
    serverMissing.push(...missing)
  }

  // For addresses still not found in server cache, do mainnet RPC lookup
  if (serverMissing.length) {
    await Promise.all(serverMissing.map(async (addr) => {
      result[addr] = await lookupEnsName(addr)
    }))
  }

  return result
}
