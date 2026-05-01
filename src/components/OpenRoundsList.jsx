import React, { useEffect, useState } from 'react'
import { Users, Trophy, RefreshCw, X, Globe, Clock, Share2, Check, Link } from 'lucide-react'
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

// Build a one-tap invite URL that deep-links straight into the join flow for
// a given room code. MistrialPage already handles the ?join=CODE query param.
function buildInviteUrl(code) {
  if (typeof window === 'undefined' || !code) return ''
  const u = new URL(window.location.href)
  u.search = ''
  u.hash = ''
  u.searchParams.set('join', code)
  return u.toString()
}

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
  const [copiedCode, setCopiedCode] = useState(null) // which card's link was just copied

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
    const myAlready = myRooms.find((r) => r.code === room.code)
    if (myAlready) {
      enterRoom(room.code)
    } else {
      joinRoom(room.code)
    }
  }

  // Share / copy invite link for a room. Tries the native share sheet first
  // (ideal on mobile), falls back to clipboard copy.
  const handleShare = async (code) => {
    const url = buildInviteUrl(code)
    if (!url) return
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join Genjury case ${code}`,
          text: `Take a seat in Genjury case ${code}:`,
          url,
        })
        return
      } catch {
        // User dismissed the share sheet — fall through to clipboard.
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      setCopiedCode(code)
      setTimeout(() => setCopiedCode((c) => (c === code ? null : c)), 2500)
    } catch {
      // Clipboard unavailable — nothing to do.
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

            const isMyRoom  = !!myRooms.find((mr) => mr.code === r.code)
            const canRejoin = !playable && !isError && isMyRoom

            // Show the invite-share button on any joinable (lobby) room, and
            // also on rooms where the user is already seated (they can invite
            // others to future rounds by sharing the code).
            const showShare = (playable || isMyRoom) && !isError

            const wasCopied = copiedCode === r.code

            return (
              <div
                key={r.code}
                className={`relative rounded-xl border p-4 hover:border-white/20 transition-colors ${
                  canRejoin
                    ? 'border-plasma/30 bg-plasma/[0.04]'
                    : 'border-white/10 bg-white/[0.03]'
                }`}
              >
                {/* Remove button — only for locally-tracked rooms */}
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
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
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

                  {/* Invite / share button — right-aligned, only when relevant */}
                  {showShare && (
                    <button
                      onClick={() => handleShare(r.code)}
                      title={wasCopied ? 'Link copied!' : 'Copy invite link'}
                      className={`ml-auto flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-mono transition-all ${
                        wasCopied
                          ? 'border-neon/50 bg-neon/10 text-neon'
                          : 'border-white/15 bg-white/[0.04] text-white/45 hover:text-white hover:border-white/30'
                      }`}
                    >
                      {wasCopied
                        ? <><Check className="w-3 h-3" /> Copied!</>
                        : <><Share2 className="w-3 h-3" /> Invite</>
                      }
                    </button>
                  )}
                </div>

                <div className="text-white/40 text-[11px] mb-3 truncate">
                  {live?.hostName ? `Filed by ${live.hostName}` : 'Awaiting case file'}
                </div>

                <div className="grid grid-cols-3 gap-2 text-center mb-3">
                  <Cell label="Phase" value={
                    <span className="capitalize text-white/85 text-xs inline-flex items-center justify-center gap-1">
                      {playable
                        ? <span className="text-neon">Open · Pre-trial</span>
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

                {/* Invite link row — shown below the stats for lobby rooms */}
                {playable && (
                  <InviteLinkBar code={r.code} wasCopied={wasCopied} onShare={handleShare} />
                )}

                <button
                  onClick={() => handleJoin(r)}
                  disabled={loading || isError || (!playable && !canRejoin)}
                  className={`w-full py-2.5 rounded-lg text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors ${
                    playable ? 'mt-2' : ''
                  } ${
                    isError
                      ? 'bg-white/5 text-white/35 cursor-not-allowed'
                      : canRejoin
                        ? 'bg-plasma/15 text-plasma border border-plasma/40 hover:bg-plasma/25'
                        : playable
                          ? 'bg-neon/15 text-neon border border-neon/40 hover:bg-neon/25'
                          : 'bg-white/5 text-white/35 border border-white/10 cursor-not-allowed'
                  }`}
                >
                  {isError
                    ? 'Unreachable'
                    : isLoading
                      ? 'Loading…'
                      : canRejoin
                        ? 'Rejoin your seat'
                        : !playable
                          ? 'Trial in session — locked'
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

// ── Invite link bar ──────────────────────────────────────────────────────────
// Shown beneath the stats grid for lobby-phase rooms. Displays the shareable
// URL in a read-only input with a copy/share button so players can grab it
// without needing to be inside the room.
function InviteLinkBar({ code, wasCopied, onShare }) {
  const url = buildInviteUrl(code)
  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1.5 mb-0">
      <Link className="w-3 h-3 text-white/30 flex-shrink-0" />
      <span className="flex-1 font-mono text-[10px] text-white/40 truncate select-all" title={url}>
        {url || `…?join=${code}`}
      </span>
      <button
        onClick={() => onShare(code)}
        className={`flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-mono transition-all ${
          wasCopied
            ? 'border-neon/40 bg-neon/10 text-neon'
            : 'border-white/15 bg-white/[0.04] text-white/45 hover:text-white hover:border-white/25'
        }`}
      >
        {wasCopied ? <><Check className="w-3 h-3" /> Copied</> : <><Share2 className="w-3 h-3" /> Share</>}
      </button>
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────
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
