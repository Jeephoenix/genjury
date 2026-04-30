// ──────────────────────────────────────────────────────────────────────────────
// "Joined rooms" registry — every contract address the user has joined or
// created, plus the env-configured house room. Lets the user re-open a game
// without retyping a contract address, and powers the "Open rounds" lists on
// Home / Games / Mistrial.
//
// Stored in localStorage as an array of:
//   { address, lastSeenAt, isHost, label? }
// Most-recently-touched first. Capped to keep the registry small.
// ──────────────────────────────────────────────────────────────────────────────

import { getDefaultContractAddress } from './genlayer'

const STORAGE_KEY = 'genjury_joined_rooms_v1'
const MAX_ROOMS   = 25

const _listeners = new Set()

function safeRead() {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    if (!Array.isArray(arr)) return []
    return arr
      .filter((r) => r && /^0x[0-9a-f]{40}$/i.test(r.address || ''))
      .map((r) => ({
        address:    String(r.address).toLowerCase(),
        lastSeenAt: Number(r.lastSeenAt) || 0,
        isHost:     !!r.isHost,
        label:      r.label ? String(r.label).slice(0, 32) : '',
      }))
  } catch {
    return []
  }
}

function safeWrite(arr) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr))
  } catch {}
}

function notify() {
  for (const fn of _listeners) { try { fn() } catch {} }
}

export function subscribeJoinedRooms(fn) {
  _listeners.add(fn)
  return () => _listeners.delete(fn)
}

// Return the user's known rooms — joined / created + the configured house
// room (so it's always visible even on a fresh device).
export function listJoinedRooms() {
  const stored = safeRead()
  const seen = new Set(stored.map((r) => r.address))
  const out = [...stored]
  const house = getDefaultContractAddress()
  if (house && !seen.has(house.toLowerCase())) {
    out.push({
      address: house.toLowerCase(),
      lastSeenAt: 0,
      isHost: false,
      label: 'House Room',
    })
  }
  out.sort((a, b) => b.lastSeenAt - a.lastSeenAt)
  return out
}

export function rememberJoinedRoom(address, opts = {}) {
  if (!address || !/^0x[0-9a-f]{40}$/i.test(address)) return
  const addr = address.toLowerCase()
  const arr = safeRead().filter((r) => r.address !== addr)
  arr.unshift({
    address:    addr,
    lastSeenAt: Date.now(),
    isHost:     !!opts.isHost,
    label:      opts.label || '',
  })
  if (arr.length > MAX_ROOMS) arr.length = MAX_ROOMS
  safeWrite(arr)
  notify()
}

export function forgetJoinedRoom(address) {
  if (!address) return
  const addr = address.toLowerCase()
  const arr = safeRead().filter((r) => r.address !== addr)
  safeWrite(arr)
  notify()
}

export function clearJoinedRooms() {
  safeWrite([])
  notify()
}
