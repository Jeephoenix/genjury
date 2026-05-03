// ENS reverse-lookup utility.
//
// Uses the Cloudflare Ethereum JSON-RPC endpoint to call the ENS public
// resolver on mainnet — no new dependencies needed (viem is already bundled
// via genlayer-js).
//
// Priority for display names: server username > ENS name > truncated address.

import { createPublicClient, http } from 'viem'
import { mainnet } from 'viem/chains'

const ENS_RPC = 'https://cloudflare-eth.com'
const STORAGE_KEY = 'genjury_ens_cache_v1'

// In-memory cache: address (lower) → ensName | null
const _cache = new Map()
const _pending = new Map()
const _listeners = new Set()

// Persist to localStorage so we don't re-fetch on page reload
;(function initPersisted() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const obj = JSON.parse(raw)
    for (const [k, v] of Object.entries(obj)) {
      _cache.set(k, v)
    }
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
    _client = createPublicClient({
      chain: mainnet,
      transport: http(ENS_RPC),
    })
  }
  return _client
}

// Synchronous cache read — use this in render paths.
export function getCachedEnsName(address) {
  if (!address) return null
  const v = _cache.get(address.toLowerCase())
  return v ?? null
}

// Async reverse lookup. Returns the ENS name or null.
// Deduplicates concurrent calls for the same address.
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
      if (result) notify()
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

// Batch-lookup multiple addresses. Returns { [address]: ensName | null }.
// Already-cached addresses are returned synchronously from the result.
export async function batchLookupEns(addresses) {
  if (!addresses?.length) return {}
  const unique = [...new Set(addresses.map(a => String(a).toLowerCase()).filter(Boolean))]
  const result = {}
  const toFetch = []

  for (const addr of unique) {
    if (_cache.has(addr)) {
      result[addr] = _cache.get(addr)
    } else {
      toFetch.push(addr)
    }
  }

  if (!toFetch.length) return result

  await Promise.all(toFetch.map(async (addr) => {
    result[addr] = await lookupEnsName(addr)
  }))

  return result
}
