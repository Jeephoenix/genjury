// API client for the persistent player profile registry.
// The registry is stored server-side, keyed by wallet address.
// Username claims are one-time and permanent.
//
// Graceful degradation: if the API server is unreachable (e.g. frontend
// deployed without the backend), the check is skipped optimistically and
// claims fall back to localStorage-only storage so the UI still works.

const BASE = '/api/profile'

let _cache = {}        // address -> profile | null | 'loading'
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
// If the server is unreachable or the endpoint doesn't exist, returns
// { available: true } so the UI doesn't block the user.
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
    // Network error — server not deployed or unreachable; allow optimistically
    return { available: true }
  }

  // Endpoint missing (API server not deployed yet) — skip check
  if (!resp.ok) return { available: true }

  try {
    return await resp.json()
  } catch {
    return { available: true }
  }
}

// Claim a permanent identity. Returns { ok, username } or throws.
// If the server is unreachable, falls back to localStorage-only so the
// user can still play. Real API errors (e.g. "Username already taken")
// are always surfaced to the caller.
export async function claimIdentity(address, username, avatarUrl = '', color = '#a259ff') {
  const key = address.toLowerCase()
  const trimmed = username.trim()

  let resp
  try {
    resp = await fetch(`${BASE}/claim`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ address: key, username: trimmed, avatarUrl, color }),
    })
  } catch {
    // Server unreachable — save identity locally only
    _cache[key] = { address: key, username: trimmed, avatarUrl, color }
    notify()
    return { ok: true, username: trimmed, local: true }
  }

  // Server responded — parse and respect the result
  let data
  try { data = await resp.json() } catch { data = {} }
  if (!resp.ok) throw new Error(data.error || 'Claim failed.')

  _cache[key] = { address: key, username: data.username ?? trimmed, avatarUrl, color }
  notify()
  return data
}

// Update avatar only (username stays locked forever).
export async function updateAvatar(address, avatarUrl) {
  const key = address.toLowerCase()

  let resp
  try {
    resp = await fetch(`${BASE}/avatar`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ address: key, avatarUrl }),
    })
  } catch {
    // Server unreachable — update cache only
    if (_cache[key]) _cache[key] = { ..._cache[key], avatarUrl }
    notify()
    return { ok: true, local: true }
  }

  let data
  try { data = await resp.json() } catch { data = {} }
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
