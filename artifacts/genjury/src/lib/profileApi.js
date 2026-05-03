// API client for the persistent player profile registry.
// The registry is stored server-side in Neon Postgres, keyed by wallet address.
// Username claims are one-time and permanent.
//
// Error philosophy: claims must succeed server-side or fail loudly.
// We never silently fall back to localStorage-only for claims — that would
// give users a false sense of permanence. The server returns 503 when
// DATABASE_URL is not configured, and we surface that clearly.

import { seedEnsCache } from './ens'

const BASE = '/api/profile'

let _cache = {}        // address -> profile | null
const _listeners = new Set()

function notify() {
  for (const fn of _listeners) { try { fn() } catch {} }
}

export function subscribeProfileApi(fn) {
  _listeners.add(fn)
  return () => _listeners.delete(fn)
}

// Fetch the server profile for a given address.
// Returns null if not found or if the server is unreachable.
export async function fetchServerProfile(address) {
  if (!address) return null
  const key = address.toLowerCase()
  let resp
  try {
    resp = await fetch(`${BASE}/${encodeURIComponent(key)}`)
  } catch {
    return null
  }
  if (resp.status === 404) return null
  if (!resp.ok) return null
  try {
    const data = await resp.json()
    _cache[key] = data
    // Seed ENS cache if the server returned an ENS name for this address
    if (data.ensName) seedEnsCache({ [key]: data.ensName })
    notify()
    return data
  } catch {
    return null
  }
}

// Check availability of a username.
export async function checkUsername(username) {
  const trimmed = (username || '').trim()
  if (trimmed.length < 5) {
    return { available: false, error: 'At least 5 characters required.' }
  }
  if (!/^[\w\s\-]{5,24}$/.test(trimmed)) {
    return { available: false, error: 'Letters, numbers, spaces, _ or - only.' }
  }

  let resp
  try {
    resp = await fetch(`${BASE}/check?username=${encodeURIComponent(trimmed)}`)
  } catch {
    return { available: true }
  }

  if (resp.status === 503 || resp.status >= 500) {
    let data = {}
    try { data = await resp.json() } catch {}
    return {
      available: false,
      error: data.error || 'Identity registry unavailable — try again shortly.',
    }
  }

  if (!resp.ok) return { available: false, error: 'Could not verify availability.' }

  try {
    return await resp.json()
  } catch {
    return { available: true }
  }
}

// Claim a permanent identity.
export async function claimIdentity(address, username, avatarUrl = '', color = '#a259ff') {
  const key     = address.toLowerCase()
  const trimmed = username.trim()

  let resp
  try {
    resp = await fetch(`${BASE}/claim`, {
      method:  'POST',
      headers: { 'content-type': 'application/json' },
      body:    JSON.stringify({ address: key, username: trimmed, avatarUrl, color }),
    })
  } catch {
    throw new Error('Could not reach the identity server. Check your connection and try again.')
  }

  let data = {}
  try { data = await resp.json() } catch {}

  if (resp.status === 503) {
    throw new Error(
      data.error ||
      'Identity registry is not set up. A Neon Postgres database needs to be connected to the Vercel project.'
    )
  }

  if (resp.status === 409) {
    if (data.username) {
      _cache[key] = { address: key, username: data.username, avatarUrl, color }
      notify()
    }
    throw new Error(data.error || 'Username already taken.')
  }

  if (resp.status >= 400 && resp.status < 500) {
    throw new Error(data.error || 'Invalid claim request.')
  }

  if (!resp.ok) {
    throw new Error(data.error || 'Server error — please try again in a moment.')
  }

  _cache[key] = {
    address:   key,
    username:  data.username ?? trimmed,
    avatarUrl: avatarUrl,
    color:     color,
  }
  notify()
  return data
}

// Update avatar only (username stays locked forever).
export async function updateAvatar(address, avatarUrl) {
  const key = address.toLowerCase()

  let resp
  try {
    resp = await fetch(`${BASE}/avatar`, {
      method:  'PATCH',
      headers: { 'content-type': 'application/json' },
      body:    JSON.stringify({ address: key, avatarUrl }),
    })
  } catch {
    throw new Error('Could not reach the server. Check your connection and try again.')
  }

  let data = {}
  try { data = await resp.json() } catch {}
  if (!resp.ok) throw new Error(data.error || 'Update failed.')

  if (_cache[key]) _cache[key] = { ..._cache[key], avatarUrl }
  notify()
  return data
}

// Synchronous cache lookup.
export function getCachedServerProfile(address) {
  if (!address) return null
  return _cache[address.toLowerCase()] || null
}

// Batch-resolve wallet addresses to their server-registered usernames + ENS names.
// Returns { [lowercaseAddress]: username } for addresses that have claimed an identity.
// Also seeds the ENS cache from server data as a side-effect, so batchLookupEns
// avoids redundant mainnet RPC calls for addresses the server already knows about.
export async function resolveUsernames(addresses) {
  if (!addresses || !addresses.length) return {}
  const unique = [...new Set(addresses.map(a => String(a).toLowerCase()))]

  const result = {}
  const missing = []
  for (const addr of unique) {
    if (_cache[addr]?.username) {
      result[addr] = _cache[addr].username
    } else {
      missing.push(addr)
    }
  }
  if (!missing.length) return result

  try {
    const resp = await fetch(`${BASE}/batch?addresses=${encodeURIComponent(missing.join(','))}`)
    if (!resp.ok) return result
    const data = await resp.json()

    // Collect ENS names returned by the batch endpoint to seed the ENS cache
    const ensMap: Record<string, string> = {}

    for (const [addr, prof] of Object.entries(data || {})) {
      const p = prof as any
      if (p?.username) {
        result[addr] = p.username
        _cache[addr] = p
      }
      if (p?.ensName) ensMap[addr] = p.ensName
    }

    if (Object.keys(ensMap).length) seedEnsCache(ensMap)
    if (Object.keys(data).length) notify()
  } catch {}

  return result
}
