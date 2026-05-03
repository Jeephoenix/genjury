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
        const entry = {
          code,
          lastSeenAt: Number(r.lastSeenAt) || 0,
          isHost:     !!r.isHost,
          label:      r.label ? String(r.label).slice(0, 32) : '',
          finished:   !!r.finished,
        }
        // Preserve all metadata fields written by markRoomFinished so
        // they are not silently dropped on every read-then-write cycle.
        if (r.finishedAt  != null) entry.finishedAt  = Number(r.finishedAt)
        if (r.category)            entry.category    = String(r.category).slice(0, 64)
        if (r.rounds      != null) entry.rounds      = Number(r.rounds)
        if (r.maxRounds   != null) entry.maxRounds   = Number(r.maxRounds)
        if (r.playerCount != null) entry.playerCount = Number(r.playerCount)
        if (r.myRank      != null) entry.myRank      = Number(r.myRank)
        if (r.myXP        != null) entry.myXP        = Number(r.myXP)
        if (r.winnerName)          entry.winnerName  = String(r.winnerName).slice(0, 32)
        return entry
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
  const arr      = safeRead()
  const existing = arr.find((r) => r.code === code)
  const filtered = arr.filter((r) => r.code !== code)

  const entry = {
    code,
    lastSeenAt: Date.now(),
    isHost:     !!opts.isHost || existing?.isHost || false,
    label:      opts.label || existing?.label || '',
    // Never overwrite a finished flag — once finished, always finished.
    finished:   existing?.finished || false,
  }

  // Carry over all history metadata so re-entering a finished room
  // doesn't wipe the case from the profile history panel.
  if (existing?.finished) {
    if (existing.finishedAt  != null) entry.finishedAt  = existing.finishedAt
    if (existing.category)            entry.category    = existing.category
    if (existing.rounds      != null) entry.rounds      = existing.rounds
    if (existing.maxRounds   != null) entry.maxRounds   = existing.maxRounds
    if (existing.playerCount != null) entry.playerCount = existing.playerCount
    if (existing.myRank      != null) entry.myRank      = existing.myRank
    if (existing.myXP        != null) entry.myXP        = existing.myXP
    if (existing.winnerName)          entry.winnerName  = existing.winnerName
  }

  filtered.unshift(entry)
  if (filtered.length > MAX_ROOMS) filtered.length = MAX_ROOMS
  safeWrite(filtered)
  notify()
}

export function forgetJoinedRoom(rawCode) {
  const code = normalizeRoomCode(rawCode)
  if (!code) return
  const arr = safeRead().filter((r) => r.code !== code)
  safeWrite(arr)
  notify()
}

export function markRoomFinished(rawCode, meta = {}) {
  const code = normalizeRoomCode(rawCode)
  if (!isValidRoomCode(code)) return
  const arr = safeRead()
  let entry = arr.find((r) => r.code === code)
  if (!entry) {
    // Room was never in the registry (e.g. player browsed in) — create a stub.
    entry = { code, lastSeenAt: Date.now(), isHost: false, label: '', finished: false }
    arr.unshift(entry)
  }
  entry.finished   = true
  entry.finishedAt = entry.finishedAt || meta.finishedAt || Date.now()
  if (meta.category)    entry.category    = String(meta.category).slice(0, 64)
  if (meta.rounds)      entry.rounds      = Number(meta.rounds)
  if (meta.maxRounds)   entry.maxRounds   = Number(meta.maxRounds)
  if (meta.playerCount) entry.playerCount = Number(meta.playerCount)
  if (meta.myRank)      entry.myRank      = Number(meta.myRank)
  if (meta.myXP != null) entry.myXP       = Number(meta.myXP)
  if (meta.winnerName)  entry.winnerName  = String(meta.winnerName).slice(0, 32)
  safeWrite(arr)
  notify()
}

// List only rooms that have finished (for the profile history panel).
export function listFinishedRooms() {
  const arr = safeRead()
  return arr
    .filter((r) => r.finished)
    .sort((a, b) => (b.finishedAt || b.lastSeenAt) - (a.finishedAt || a.lastSeenAt))
}

// Permanently remove a finished room from the history.
export function dismissFinishedRoom(rawCode) {
  const code = normalizeRoomCode(rawCode)
  if (!isValidRoomCode(code)) return
  const arr = safeRead().filter((r) => r.code !== code)
  safeWrite(arr)
  notify()
}

export function clearJoinedRooms() {
  safeWrite([])
  notify()
}
