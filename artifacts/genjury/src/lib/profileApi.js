// API client for the persistent player profile registry.
// The registry is stored server-side, keyed by wallet address.
// Username claims are one-time and permanent.

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
// Returns null if not found, or the profile object.
export async function fetchServerProfile(address) {
  if (!address) return null
  const key = address.toLowerCase()
  try {
    const r = await fetch(`${BASE}/${encodeURIComponent(key)}`)
    if (r.status === 404) return null
    if (!r.ok) throw new Error('fetch failed')
    const data = await r.json()
    _cache[key] = data
    notify()
    return data
  } catch {
    return null
  }
}

// Check availability of a username. Returns { available, error? }
export async function checkUsername(username) {
  if (!username || username.trim().length < 5) {
    return { available: false, error: 'At least 5 characters required.' }
  }
  try {
    const r = await fetch(`${BASE}/check?username=${encodeURIComponent(username.trim())}`)
    if (!r.ok) throw new Error('check failed')
    return await r.json()
  } catch {
    return { available: false, error: 'Could not verify — try again.' }
  }
}

// Claim a permanent identity. Returns { ok, username } or throws.
export async function claimIdentity(address, username, avatarUrl = '', color = '#a259ff') {
  const r = await fetch(`${BASE}/claim`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ address: address.toLowerCase(), username: username.trim(), avatarUrl, color }),
  })
  const data = await r.json()
  if (!r.ok) throw new Error(data.error || 'Claim failed.')
  const key = address.toLowerCase()
  _cache[key] = { address: key, username: data.username, avatarUrl, color }
  notify()
  return data
}

// Update avatar only (username stays locked forever).
export async function updateAvatar(address, avatarUrl) {
  const r = await fetch(`${BASE}/avatar`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ address: address.toLowerCase(), avatarUrl }),
  })
  const data = await r.json()
  if (!r.ok) throw new Error(data.error || 'Update failed.')
  const key = address.toLowerCase()
  if (_cache[key]) _cache[key] = { ..._cache[key], avatarUrl }
  notify()
  return data
}

// Synchronous cache lookup (may be null if not yet fetched).
export function getCachedServerProfile(address) {
  if (!address) return null
  return _cache[address.toLowerCase()] || null
}
