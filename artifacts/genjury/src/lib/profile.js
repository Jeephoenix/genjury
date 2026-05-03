// ──────────────────────────────────────────────────────────────────────────────
// Player profile — name + avatar + ENS.
//
// When a wallet is connected, the canonical profile comes from the server
// (permanent, unique username linked to wallet address). localStorage is used
// as a fast cache and as the identity for non-connected users.
//
// Priority for display names: server username > ENS name > truncated address.
// ──────────────────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'genjury_profile_v1'

const DEFAULT_COLORS = [
  '#a259ff', '#7fff6e', '#ff8a00', '#3eddff',
  '#ffce54', '#ff5d8f', '#5dffd4', '#ff6b6b',
]

function randomColor() {
  return DEFAULT_COLORS[Math.floor(Math.random() * DEFAULT_COLORS.length)]
}

function defaultProfile() {
  const n = Math.floor(Math.random() * 9000) + 1000
  return {
    name:        `Player ${n}`,
    avatarUrl:   '',
    color:       randomColor(),
    claimed:     false,   // true once a permanent identity is registered
    ensName:     null,    // ENS name (mainnet reverse lookup), if any
  }
}

let _cache = null
const _listeners = new Set()

function read() {
  if (_cache) return _cache
  if (typeof window === 'undefined') {
    _cache = defaultProfile()
    return _cache
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      _cache = {
        name:      String(parsed.name || '').slice(0, 24) || defaultProfile().name,
        avatarUrl: String(parsed.avatarUrl || '').slice(0, 400000),
        color:     String(parsed.color || '') || randomColor(),
        claimed:   !!parsed.claimed,
        ensName:   parsed.ensName ? String(parsed.ensName) : null,
      }
      return _cache
    }
  } catch {}
  _cache = defaultProfile()
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(_cache)) } catch {}
  return _cache
}

function notify() {
  for (const fn of _listeners) {
    try { fn(_cache) } catch {}
  }
}

export function getProfile() {
  return read()
}

export function setProfile(patch) {
  const cur = read()
  const next = {
    name: typeof patch.name === 'string'
      ? patch.name.slice(0, 24).trim() || cur.name
      : cur.name,
    avatarUrl: typeof patch.avatarUrl === 'string'
      ? patch.avatarUrl
      : cur.avatarUrl,
    color: typeof patch.color === 'string' && patch.color
      ? patch.color
      : cur.color,
    claimed: patch.claimed !== undefined ? !!patch.claimed : cur.claimed,
    ensName: patch.ensName !== undefined ? (patch.ensName || null) : cur.ensName,
  }
  _cache = next
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch {}
  notify()
  return next
}

// Called after a successful server-side identity claim.
export function applyServerProfile(serverProfile) {
  const cur = read()
  const next = {
    name:      serverProfile.username || cur.name,
    avatarUrl: serverProfile.avatarUrl || cur.avatarUrl,
    color:     serverProfile.color    || cur.color,
    claimed:   true,
    ensName:   cur.ensName,  // preserve locally cached ENS name
  }
  _cache = next
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch {}
  notify()
  return next
}

// Called after ENS reverse lookup resolves.
export function applyEnsName(ensName) {
  const cur = read()
  if (cur.ensName === ensName) return cur  // no change
  const next = { ...cur, ensName: ensName || null }
  _cache = next
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch {}
  notify()
  return next
}

export function subscribeProfile(fn) {
  _listeners.add(fn)
  return () => _listeners.delete(fn)
}

// Convenience for chat/contract: a stable display name.
export function displayName(address) {
  const p = read()
  if (p.name) return p.name
  if (address) return `${address.slice(0, 6)}…${address.slice(-4)}`
  return 'Player'
}
