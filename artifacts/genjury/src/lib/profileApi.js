// API client for the persistent player profile registry.
// The registry is stored server-side in Neon Postgres, keyed by wallet address.
// Username claims are one-time and permanent.
//
// Error philosophy: claims must succeed server-side or fail loudly.
// We never silently fall back to localStorage-only for claims — that would
// give users a false sense of permanence. The server returns 503 when
// DATABASE_URL is not configured, and we surface that clearly.

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
    notify()
    return data
  } catch {
    return null
  }
}

// Check availability of a username.
// Returns { available: true/false, error?: string }.
// If the server is unreachable (network error), optimistically allows the
// user to proceed — the claim step will catch real conflicts.
// 4xx/5xx responses from a reachable server are always respected.
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
    // Genuine network error (offline, DNS failure) — allow optimistically
    return { available: true }
  }

  // 503 = DB not configured; 5xx = server error
  if (resp.status === 503 || resp.status >= 500) {
    let data = {}
    try { data = await resp.json() } catch {}
    return {
      available: false,
      error: data.error || 'Identity registry unavailable — try again shortly.',
    }
  }

  // Non-2xx (e.g. 404) from a deployed but misconfigured server
  if (!resp.ok) return { available: false, error: 'Could not verify availability.' }

  try {
    return await resp.json()
  } catch {
    return { available: true }
  }
}

// Claim a permanent identity. Returns { ok, username } or throws.
// Never silently falls back to localStorage — the claim MUST be persisted
// server-side or the user gets a real error explaining why.
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
    // Network error — user is offline or server is completely down
    throw new Error('Could not reach the identity server. Check your connection and try again.')
  }

  let data = {}
  try { data = await resp.json() } catch {}

  // 503 = DATABASE_URL not configured on the server
  if (resp.status === 503) {
    throw new Error(
      data.error ||
      'Identity registry is not set up. A Neon Postgres database needs to be connected to the Vercel project.'
    )
  }

  // 409 = conflict (username taken OR wallet already claimed)
  if (resp.status === 409) {
    // If the wallet already claimed, load the existing profile
    if (data.username) {
      _cache[key] = { address: key, username: data.username, avatarUrl, color }
      notify()
    }
    throw new Error(data.error || 'Username already taken.')
  }

  // Other 4xx = validation / bad request
  if (resp.status >= 400 && resp.status < 500) {
    throw new Error(data.error || 'Invalid claim request.')
  }

  // 5xx = server/DB error (transient)
  if (!resp.ok) {
    throw new Error(data.error || 'Server error — please try again in a moment.')
  }

  // Success — update cache and notify subscribers
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

// Synchronous cache lookup (may be null if not yet fetched).
export function getCachedServerProfile(address) {
  if (!address) return null
  return _cache[address.toLowerCase()] || null
}
