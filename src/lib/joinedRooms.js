// "Joined rooms" registry — every room code the user has joined or created.
// Stored in localStorage as an array of:
//   { code, lastSeenAt, isHost, label? }
// Most-recently-touched first. Capped to keep the registry small.

import { isValidRoomCode, normalizeRoomCode } from './genlayer'

const STORAGE_KEY = 'genjury_joined_rooms_v2'
const LEGACY_KEYS = ['genjury_joined_rooms_v1']
const MAX_ROOMS   = 25

const _listeners = new Set()

function safeRead() {
  if (typeof window === 'undefined') return []
  // One-time wipe of the legacy address-keyed registry — addresses don't
  // map to room codes in the new model so the old data isn't useful.
  try {
    for (const key of LEGACY_KEYS) {
      if (localStorage.getItem(key) !== null) localStorage.removeItem(key)
    }
  } catch {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    if (!Array.isArray(arr)) return []
    return arr
      .map((r) => {
        const code = normalizeRoomCode(r?.code || '')
        if (!isValidRoomCode(code)) return null
        return {
          code,
          lastSeenAt: Number(r.lastSeenAt) || 0,
          isHost:     !!r.isHost,
          label:      r.label ? String(r.label).slice(0, 32) : '',
        }
      })
      .filter(Boolean)
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

export function listJoinedRooms() {
  const arr = safeRead()
  arr.sort((a, b) => b.lastSeenAt - a.lastSeenAt)
  return arr
}

export function rememberJoinedRoom(rawCode, opts = {}) {
  const code = normalizeRoomCode(rawCode)
  if (!isValidRoomCode(code)) return
  const arr = safeRead().filter((r) => r.code !== code)
  arr.unshift({
    code,
    lastSeenAt: Date.now(),
    isHost:     !!opts.isHost,
    label:      opts.label || '',
  })
  if (arr.length > MAX_ROOMS) arr.length = MAX_ROOMS
  safeWrite(arr)
  notify()
}

export function forgetJoinedRoom(rawCode) {
  const code = normalizeRoomCode(rawCode)
  if (!code) return
  const arr = safeRead().filter((r) => r.code !== code)
  safeWrite(arr)
  notify()
}

export function clearJoinedRooms() {
  safeWrite([])
  notify()
}
