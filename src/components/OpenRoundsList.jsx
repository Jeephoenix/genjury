import React, { useEffect, useState } from 'react'
import { Users, Trophy, RefreshCw, X, Globe, Clock } from 'lucide-react'
import useGameStore from '../lib/store'
import {
  listJoinedRooms,
  forgetJoinedRoom,
  subscribeJoinedRooms,
} from '../lib/joinedRooms'
import {
  formatGen,
  getChainNativeSymbol,
  isWalletConnected,
  hasContractAddress,
} from '../lib/genlayer'

// Live courthouse: shows every open case from the contract (across ALL hosts),
// and merges in your personally-tracked cases (joined rooms registry) so they
// stay visible even after the contract pages past them.
//
// Props:
//   - emptyHint: text shown when no rooms exist anywhere (your list + global)
//   - title:     section header
export default function OpenRoundsList({
  emptyHint = 'No open cases on the docket. Open one below to seat the first jury.',
  title = 'Open cases',
}) {
  const [myRooms, setMyRooms] = useState(() => listJoinedRooms())
  const [previews, setPreviews] = useState({})  // { code: previewObj | 'loading' | 'error' }
  const [tick, setTick] = useState(0)

  const previewRoom   = useGameStore((s) => s.previewRoom)
  const joinRoom      = useGameStore((s) => s.joinRoom)
  const enterRoom     = useGameStore((s) => s.enterRoom)
  const setOpenWallet = useGameStore((s) => s.setWalletPanelOpen)
  const loading       = useGameStore((s) => s.loading)
  const refreshLobby  = useGameStore((s) => s.refreshLobby)
  const openRooms     = useGameStore((s) => s.openRooms)
  const liveRooms     = useGameStore((s) => s.liveRooms)
  const roomsLoading  = useGameStore((s) => s.roomsLoading)
  const symbol        = getChainNativeSymbol()

  useEffect(() => subscribeJoinedRooms(() => setMyRooms(listJoinedRooms())), [])

  // Live discovery from the contract — merges open + live rooms with the
  // user's personal joined-room registry, deduped by code.
  useEffect(() => {
    if (!hasContractAddress()) return
    refreshLobby()
  }, [refreshLobby, tick])

  // Auto-refresh every 15s so the docket stays fresh.
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 15000)
    return () => clearInterval(id)
  }, [])

  // Build the merged docket: contract rooms first (priority for display),
  // then any user-tracked rooms not already in the contract list.
  const mergedRooms = React.useMemo(() => {
    const map = new Map()
    for (const r of openRooms || []) {
      const code = String(r.roomCode || '').toUpperCase()
      if (!code) continue
      map.set(code, {
        code,
        host: r.host,
        hostName: r.hostName || '',
        phase: 'lobby',
        playerCount: Number(r.playerCount || 0),
        maxPlayers:  Number(r.maxPlayers || 0),
        entryFeeWei: BigInt(r.entryFee || '0'),
        prizePoolWei: BigInt(r.prizePool || '0'),
        source: 'contract',
        isHost: false,
      })
    }
    for (const r of liveRooms || []) {
      const code = String(r.roomCode || '').toUpperCase()
      if (!code || map.has(code)) continue
      map.set(code, {
        code,
        host: r.host,
        hostName: r.hostName || '',
        phase: r.phase || 'in_session',
        playerCount: Number(r.playerCount || 0),
        maxPlayers:  Number(r.maxPlayers || 0),
        entryFeeWei: BigInt(r.entryFee || '0'),
        prizePoolWei: BigInt(r.prizePool || '0'),
        source: 'contract',
        isHost: false,
      })
    }
    for (const r of myRooms) {
      const existing = map.get(r.code)
      if (existing) { existing.isHost = existing.isHost || !!r.isHost; continue }
      map.set(r.code, {
        code: r.code,
        host: '',
        hostName: '',
        phase: 'unknown',
        playerCount: 0,
        maxPlayers: 0,
        entryFeeWei: 0n,
        prizePoolWei: 0n,
        source: 'local',
        isHost: !!r.isHost,
      })
    }
    return Array.from(map.values())
  }, [openRooms, liveRooms, myRooms])

  // For local-only rooms (not surfaced by the contract list), fetch live
  // previews so we still show phase + pool data.
  useEffect(() => {
    let cancelled = false
    const localOnly = mergedRooms.filter((r) => r.source === 'local')
    if (!localOnly.length) return
    setPreviews((prev) => {
      const next = { ...prev }
      for (const r of localOnly) if (!next[r.code]) next[r.code] = 'loading'
      return next
    })
    localOnly.forEach(async (r) => {
      try {
        const p = await previewRoom(r.code)
        if (cancelled) return
        setPreviews((prev) => ({ ...prev, [r.code]: p || 'error' }))
      } catch {
        if (cancelled) return
        setPreviews((prev) => ({ ...prev, [r.code]: 'error' }))
      }
    })
    return () => { cancelled = true }
  }, [mergedRooms, previewRoom, tick])

  const handleJoin = (room) => {
    if (loading) return
    if (!isWalletConnected()) { setOpenWallet(true); return }
    // If the user already paid the fee in this room, re-enter without paying.
    const myAlready = myRooms.find((r) => r.code === room.code)
    if (myAlready) {
      enterRoom(room.code)
    } else {
      joinRoom(room.code)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-display font-700 text-base text-white inline-flex items-center gap-2">
          <Globe className="w-4 h-4 text-neon" />
          {title}
        </h2>
        <button
          onClick={() => setTick((n) => n + 1)}
          className="inline-flex items-center gap-1.5 text-white/45 hover:text-white text-xs font-mono uppercase tracking-wider"
          aria-label="Refresh"
          disabled={roomsLoading}
        >
          <RefreshCw className={`w-3 h-3 ${roomsLoading ? 'animate-spin' : ''}`} strokeWidth={2.25} />
          {roomsLoading ? 'Polling…' : 'Refresh'}
        </button>
      </div>

      {mergedRooms.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-6 text-center text-white/55 text-sm">
          {emptyHint}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {mergedRooms.map((r) => {
            // For contract-discovered rooms, the merged object IS the preview.
            // For local-only rooms, look up the deferred preview.
            const live = r.source === 'contract'
              ? r
              : (typeof previews[r.code] === 'object' && previews[r.code]) || null
            const status = r.source === 'local' ? previews[r.code] : 'ok'
            const isLoading = status === 'loading' || status === undefined
            const isError   = status === 'error'

            const phase = live?.phase || (isError ? 'unreachable' : 'loading…')
            const playable = phase === 'lobby'
            const fee  = live?.entryFeeWei ?? 0n
            const pool = live?.prizePoolWei ?? 0n
            const players = live ? `${live.playerCount}/${live.maxPlayers || '?'}` : '—'

            return (
              <div
                key={r.code}
                className="relative rounded-xl border border-white/10 bg-white/[0.03] p-4 hover:border-white/20 transition-colors"
              >
                {r.source === 'local' && (
                  <button
                    onClick={() => forgetJoinedRoom(r.code)}
                    className="absolute top-2 right-2 text-white/30 hover:text-white/70 transition-colors"
                    title="Remove from your list"
                    aria-label="Remove case"
                  >
                    <X className="w-3.5 h-3.5" strokeWidth={2.25} />
                  </button>
                )}

                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className={`w-2 h-2 rounded-full ${
                    isError ? 'bg-white/20'
                    : playable ? 'bg-neon animate-pulse'
                    : isLoading ? 'bg-white/30'
                    : 'bg-signal/70'
                  }`} />
                  <span className="text-white font-display font-700 text-sm tracking-wider">
                    Case <span className="text-neon font-mono">{r.code}</span>
                  </span>
                  {r.isHost && (
                    <span className="badge bg-plasma/15 text-plasma border border-plasma/30 text-[9px] tracking-widest">
                      YOUR CASE
                    </span>
                  )}
                </div>

                <div className="text-white/40 text-[11px] mb-3 truncate">
                  {live?.hostName ? `Filed by ${live.hostName}` : 'Awaiting case file'}
                </div>

                <div className="grid grid-cols-3 gap-2 text-center mb-3">
                  <Cell label="Phase" value={
                    <span className="capitalize text-white/85 text-xs inline-flex items-center justify-center gap-1">
                      {playable
                        ? <span className="text-neon">In session</span>
                        : phase === 'unreachable'
                          ? <span className="text-white/40">—</span>
                          : <><Clock className="w-3 h-3 text-signal/70" /> <span className="text-signal/85">{prettyPhase(phase)}</span></>}
                    </span>
                  } />
                  <Cell label="Jury" value={
                    <span className="text-white/85 text-xs font-mono inline-flex items-center gap-1 justify-center">
                      <Users className="w-3 h-3 text-white/40" /> {players}
                    </span>
                  } />
                  <Cell label="Purse" value={
                    <span className="text-gold text-xs font-mono inline-flex items-center gap-1 justify-center">
                      <Trophy className="w-3 h-3" /> {live ? formatGen(pool, 3) : '—'}
                    </span>
                  } />
                </div>

                <button
                  onClick={() => handleJoin(r)}
                  disabled={loading || isError || !playable}
                  className={`w-full py-2.5 rounded-lg text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors ${
                    isError
                      ? 'bg-white/5 text-white/35 cursor-not-allowed'
                      : playable
                        ? 'bg-neon/15 text-neon border border-neon/40 hover:bg-neon/25'
                        : 'bg-white/5 text-white/45 border border-white/10 cursor-not-allowed'
                  }`}
                >
                  {isError
                    ? 'Unreachable'
                    : isLoading
                      ? 'Loading…'
                      : !playable
                        ? 'Trial in session'
                        : fee > 0n
                          ? `Take a seat · ${formatGen(fee, 4)} ${symbol}`
                          : 'Take a seat'}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function prettyPhase(p) {
  switch (p) {
    case 'lobby':           return 'Pre-trial'
    case 'writing':         return 'Testimony'
    case 'voting':          return 'Deliberation'
    case 'ai_judging':      return 'AI Judge'
    case 'objection':       return 'Objection'
    case 'objection_vote':  return 'Objection vote'
    case 'reveal':          return 'Verdict'
    case 'scoreboard':      return 'Adjourned'
    default:                return p
  }
}

function Cell({ label, value }) {
  return (
    <div className="rounded-lg bg-white/[0.03] border border-white/10 px-2 py-1.5">
      <div className="text-[9px] font-mono uppercase tracking-wider text-white/40">{label}</div>
      <div className="mt-0.5">{value}</div>
    </div>
  )
}
