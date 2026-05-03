// ──────────────────────────────────────────────────────────────────────────────
// Player profile — name + avatar persisted to localStorage.
//
// This is the single source of truth for the user's display identity across
// the app: chat, joining rooms, the Profile page, etc. It is *separate* from
// the wallet address, which remains the on-chain identity.
//
// The profile is auto-seeded on first read with a friendly default so a user
// who never opens the Profile page still gets a usable identity for chat /
// joining a room with one click.
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
    name: `Player ${n}`,
    avatarUrl: '',          // optional data URL or remote URL
    color: randomColor(),
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
        name: String(parsed.name || '').slice(0, 24) || defaultProfile().name,
        avatarUrl: String(parsed.avatarUrl || '').slice(0, 200000),
        color: String(parsed.color || '') || randomColor(),
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
  }
  _cache = next
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch {}
  notify()
  return next
}

export function subscribeProfile(fn) {
  _listeners.add(fn)
  return () => _listeners.delete(fn)
}

// Convenience for chat/contract: a stable display name. Falls back to a short
// version of the wallet address if the profile name is somehow empty.
export function displayName(address) {
  const p = read()
  if (p.name) return p.name
  if (address) return `${address.slice(0, 6)}…${address.slice(-4)}`
  return 'Player'
}
