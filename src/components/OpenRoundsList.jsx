import React, { useEffect, useState } from 'react'
import { Users, Coins, Trophy, RefreshCw, X } from 'lucide-react'
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
} from '../lib/genlayer'

// Reusable list of rooms the user knows about (joined / created / house room).
// One-click join — no contract address typing, no name typing (uses the
// user's saved profile name).
//
// Props:
//   - emptyHint: text shown when the user has no known rooms at all
//   - title:     optional section header
export default function OpenRoundsList({
  emptyHint = "You haven't joined any rooms yet.",
  title = 'Open rounds',
}) {
  const [rooms, setRooms] = useState(() => listJoinedRooms())
  const [previews, setPreviews] = useState({})  // { addrLower: previewObj | 'loading' | 'error' }
  const [tick, setTick] = useState(0)

  const previewRoom = useGameStore((s) => s.previewRoom)
  const joinRoom    = useGameStore((s) => s.joinRoom)
  const setOpenWallet = useGameStore((s) => s.setWalletPanelOpen)
  const loading     = useGameStore((s) => s.loading)
  const symbol      = getChainNativeSymbol()

  useEffect(() => subscribeJoinedRooms(() => setRooms(listJoinedRooms())), [])

  // Refresh previews whenever the list of known rooms changes or the user
  // explicitly hits Refresh. Each room is fetched in parallel.
  useEffect(() => {
    let cancelled = false
    if (!rooms.length) {
      setPreviews({})
      return
    }
    setPreviews((prev) => {
      const next = { ...prev }
      for (const r of rooms) if (!next[r.address]) next[r.address] = 'loading'
      return next
    })
    rooms.forEach(async (r) => {
      try {
        const p = await previewRoom(r.address)
        if (cancelled) return
        setPreviews((prev) => ({ ...prev, [r.address]: p || 'error' }))
      } catch {
        if (cancelled) return
        setPreviews((prev) => ({ ...prev, [r.address]: 'error' }))
      }
    })
    return () => { cancelled = true }
  }, [rooms, previewRoom, tick])

  // Auto-refresh every 20s so player counts / phases stay live.
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 20000)
    return () => clearInterval(id)
  }, [])

  const handleJoin = (addr) => {
    if (loading) return
    if (!isWalletConnected()) {
      setOpenWallet(true)
      return
    }
    joinRoom(addr)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-display font-700 text-base text-white">{title}</h2>
        <button
          onClick={() => setTick((n) => n + 1)}
          className="inline-flex items-center gap-1.5 text-white/45 hover:text-white text-xs font-mono uppercase tracking-wider"
          aria-label="Refresh"
        >
          <RefreshCw className="w-3 h-3" strokeWidth={2.25} />
          Refresh
        </button>
      </div>

      {rooms.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-6 text-center text-white/55 text-sm">
          {emptyHint}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {rooms.map((r) => {
            const p = previews[r.address]
            const isLoading = p === 'loading' || p === undefined
            const isError = p === 'error'
            const phase = (p && typeof p === 'object' && p.phase) || (isError ? 'unreachable' : 'loading…')
            const playable = p && typeof p === 'object' && p.phase === 'lobby'
            const fee = p && typeof p === 'object' ? p.entryFeeWei || 0n : 0n
            const pool = p && typeof p === 'object' ? p.prizePoolWei || 0n : 0n
            const players = p && typeof p === 'object' ? `${p.playerCount}/${p.maxPlayers}` : '—'

            return (
              <div
                key={r.address}
                className="relative rounded-xl border border-white/10 bg-white/[0.03] p-4 hover:border-white/20 transition-colors"
              >
                <button
                  onClick={() => forgetJoinedRoom(r.address)}
                  className="absolute top-2 right-2 text-white/30 hover:text-white/70 transition-colors"
                  title="Remove from list"
                  aria-label="Remove room"
                >
                  <X className="w-3.5 h-3.5" strokeWidth={2.25} />
                </button>

                <div className="flex items-center gap-2 mb-2">
                  <span className={`w-2 h-2 rounded-full ${
                    isError ? 'bg-white/20'
                    : playable ? 'bg-neon animate-pulse'
                    : isLoading ? 'bg-white/30'
                    : 'bg-signal/70'
                  }`} />
                  <span className="text-white font-display font-700 text-sm truncate">
                    {r.label || (r.isHost ? 'Your room' : 'Game room')}
                  </span>
                  {r.isHost && (
                    <span className="badge bg-plasma/15 text-plasma border border-plasma/30 text-[9px] tracking-widest">
                      HOST
                    </span>
                  )}
                </div>

                <div className="text-white/30 text-[10px] font-mono mb-3 truncate">
                  {r.address.slice(0, 10)}…{r.address.slice(-8)}
                </div>

                <div className="grid grid-cols-3 gap-2 text-center mb-3">
                  <Cell label="Phase" value={
                    <span className="capitalize text-white/85 text-xs">{phase}</span>
                  } />
                  <Cell label="Players" value={
                    <span className="text-white/85 text-xs font-mono inline-flex items-center gap-1 justify-center">
                      <Users className="w-3 h-3 text-white/40" /> {players}
                    </span>
                  } />
                  <Cell label="Pool" value={
                    <span className="text-gold text-xs font-mono inline-flex items-center gap-1 justify-center">
                      <Trophy className="w-3 h-3" /> {p && typeof p === 'object'
                        ? formatGen(pool, 3)
                        : '—'}
                    </span>
                  } />
                </div>

                <button
                  onClick={() => handleJoin(r.address)}
                  disabled={loading || isError || (p && typeof p === 'object' && !playable)}
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
                        ? 'In progress'
                        : fee > 0n
                          ? `Join · ${formatGen(fee, 4)} ${symbol}`
                          : 'Join'}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Cell({ label, value }) {
  return (
    <div className="rounded-lg bg-white/[0.03] border border-white/10 px-2 py-1.5">
      <div className="text-[9px] font-mono uppercase tracking-wider text-white/40">{label}</div>
      <div className="mt-0.5">{value}</div>
    </div>
  )
}
