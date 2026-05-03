// ──────────────────────────────────────────────────────────────────────────────
// Player profile — per-wallet localStorage store.
//
// IMPORTANT: Each wallet address gets its own isolated localStorage key so
// that switching wallets never bleeds one user's identity into another.
//
// Priority for display names: server username > ENS name > truncated address.
// A random name is never assigned — callers fall back to address truncation.
// ──────────────────────────────────────────────────────────────────────────────

const STORAGE_PREFIX = 'genjury_profile_v2_'  // v2 = per-address; v1 was shared

const DEFAULT_COLORS = [
  '#a259ff', '#7fff6e', '#ff8a00', '#3eddff',
  '#ffce54', '#ff5d8f', '#5dffd4', '#ff6b6b',
]

function randomColor() {
  return DEFAULT_COLORS[Math.floor(Math.random() * DEFAULT_COLORS.length)]
}

function blankProfile() {
  return {
    name:      '',        // intentionally empty — display falls back to address
    avatarUrl: '',
    color:     randomColor(),
    claimed:   false,
    ensName:   null,
  }
}

// ── State ─────────────────────────────────────────────────────────────────────

let _currentAddress = null   // lowercase wallet address, or null when disconnected
let _cache          = null   // the loaded profile for _currentAddress
const _listeners    = new Set()

// ── Internal helpers ──────────────────────────────────────────────────────────

function storageKey(address) {
  return `${STORAGE_PREFIX}${address.toLowerCase()}`
}

function loadFromStorage(address) {
  try {
    const raw = localStorage.getItem(storageKey(address))
    if (!raw) return null
    const p = JSON.parse(raw)
    return {
      name:      String(p.name      || '').slice(0, 24),
      avatarUrl: String(p.avatarUrl || '').slice(0, 400000),
      color:     String(p.color     || '') || randomColor(),
      claimed:   !!p.claimed,
      ensName:   p.ensName ? String(p.ensName) : null,
    }
  } catch {
    return null
  }
}

function saveToStorage(address, profile) {
  try {
    localStorage.setItem(storageKey(address), JSON.stringify(profile))
  } catch {}
}

function notify() {
  for (const fn of _listeners) { try { fn(_cache) } catch {} }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Call this whenever a wallet connects or switches.
 * Loads (or creates) the per-address profile and notifies subscribers.
 */
export function initProfileForAddress(address) {
  if (!address) { clearProfileCache(); return }
  const addr = address.toLowerCase()
  if (_currentAddress === addr && _cache !== null) return  // already loaded
  _currentAddress = addr
  _cache = loadFromStorage(addr) || blankProfile()
  if (!loadFromStorage(addr)) saveToStorage(addr, _cache)
  notify()
}

/**
 * Call this when the wallet disconnects.
 * Clears in-memory cache so getProfile() returns a blank guest state.
 */
export function clearProfileCache() {
  _currentAddress = null
  _cache = null
  notify()
}

/**
 * Returns the profile for the currently connected wallet.
 * Returns a blank profile when no wallet is connected — never bleeds
 * a previous wallet's data into the disconnected state.
 */
export function getProfile() {
  return _cache ?? blankProfile()
}

export function setProfile(patch) {
  if (!_currentAddress) return blankProfile()
  const cur = _cache ?? blankProfile()
  const next = {
    name: typeof patch.name === 'string'
      ? patch.name.slice(0, 24).trim()
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
  saveToStorage(_currentAddress, next)
  notify()
  return next
}

/**
 * Called after a successful server-side identity claim or server profile fetch.
 * Writes the verified identity into the current wallet's profile slot.
 */
export function applyServerProfile(serverProfile) {
  if (!_currentAddress) return blankProfile()
  const cur = _cache ?? blankProfile()
  const next = {
    name:      serverProfile.username || cur.name,
    avatarUrl: serverProfile.avatarUrl || cur.avatarUrl,
    color:     serverProfile.color    || cur.color,
    claimed:   true,
    ensName:   cur.ensName,
  }
  _cache = next
  saveToStorage(_currentAddress, next)
  notify()
  return next
}

/**
 * Called after ENS reverse lookup resolves.
 */
export function applyEnsName(ensName) {
  if (!_currentAddress) return blankProfile()
  const cur = _cache ?? blankProfile()
  if (cur.ensName === ensName) return cur
  const next = { ...cur, ensName: ensName || null }
  _cache = next
  saveToStorage(_currentAddress, next)
  notify()
  return next
}

export function subscribeProfile(fn) {
  _listeners.add(fn)
  return () => _listeners.delete(fn)
}

/**
 * Returns the best available display name for the given address.
 * Priority: server username → ENS (from profile) → truncated address.
 * Never returns a random word like "Genhero".
 */
export function displayName(address) {
  const p = _cache
  if (p?.name)  return p.name
  if (p?.ensName) return p.ensName
  if (address)  return `${address.slice(0, 6)}…${address.slice(-4)}`
  return 'Player'
}
