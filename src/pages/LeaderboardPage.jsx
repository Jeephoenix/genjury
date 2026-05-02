import React, { useEffect, useMemo, useState } from 'react'
import { Trophy, Medal, Award, Crown, Flame, RefreshCw } from 'lucide-react'
import {
  readContractView,
  myAddress,
  isWalletConnected,
  hasContractAddress,
} from '../lib/genlayer'
import {
  listJoinedRooms,
  subscribeJoinedRooms,
} from '../lib/joinedRooms'
import Avatar from '../components/Avatar'

// Aggregate every player's XP / wins / games across every room the user knows
// about (joined rooms + the configured house room). This produces a real
// leaderboard from on-chain state — no hardcoded sample data.
function aggregate(roomStates, address) {
  const me = (address || '').toLowerCase()
  const acc = new Map()  // addr -> { addr, name, color, xp, wins, games }
  for (const s of roomStates) {
    if (!s) continue
    const winner = (s.winnerAddress || '').toLowerCase()
    const players = s.players || {}
    for (const [k, rec] of Object.entries(players)) {
      const a = String(k).toLowerCase()
      const cur = acc.get(a) || {
        addr: a,
        name: rec?.name || `${a.slice(0, 6)}…${a.slice(-4)}`,
        color: rec?.color || '#a259ff',
        xp: 0,
        wins: 0,
        games: 0,
      }
      cur.xp += Number(rec?.xp || 0)
      cur.games += 1
      if (winner && winner === a) cur.wins += 1
      // Prefer the longest non-empty name we've seen.
      if (rec?.name && rec.name.length > cur.name.length) cur.name = rec.name
      acc.set(a, cur)
    }
  }
  const list = Array.from(acc.values())
  list.sort((a, b) => b.xp - a.xp || b.wins - a.wins)
  return list.map((p, i) => ({
    ...p,
    rank: i + 1,
    isMe: me && p.addr === me,
    winRate: p.games > 0 ? Math.round((p.wins / p.games) * 100) : 0,
  }))
}

function rankBadge(rank) {
  if (rank === 1) return { Icon: Crown,  cls: 'text-gold bg-gold/15 border-gold/30' }
  if (rank === 2) return { Icon: Trophy, cls: 'text-white bg-white/10 border-white/20' }
  if (rank === 3) return { Icon: Medal,  cls: 'text-signal bg-signal/15 border-signal/30' }
  return null
}

export default function LeaderboardPage() {
  const [rooms, setRooms] = useState(() => listJoinedRooms())
  useEffect(() => subscribeJoinedRooms(() => setRooms(listJoinedRooms())), [])

  const [loading, setLoading] = useState(false)
  const [roomStates, setRoomStates] = useState([])
  const [tick, setTick] = useState(0)
  const address = myAddress()

  const refresh = async () => {
    if (!hasContractAddress()) { setRoomStates([]); return }
    if (!rooms.length) {
      setRoomStates([])
      return
    }
    setLoading(true)
    try {
      const states = await Promise.all(rooms.map(async (r) => {
        try {
          const raw = await readContractView('get_room_state', [r.code])
          const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
          if (!parsed?.roomCode) return null
          return parsed
        } catch {
          return null
        }
      }))
      setRoomStates(states.filter(Boolean))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { refresh() /* eslint-disable-next-line */ }, [rooms, tick])

  const players = useMemo(() => aggregate(roomStates, address), [roomStates, address])
  const top3 = players.slice(0, 3)
  const rest = players.slice(3)

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10 sm:py-14">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-[0.2em] text-white/40 mb-3">
            <Trophy className="w-3.5 h-3.5 text-gold" />
            Hall of judges
          </div>
          <h1 className="font-display font-800 text-3xl sm:text-4xl text-white tracking-tight">
            Leaderboard
          </h1>
          <p className="text-white/55 mt-2 max-w-xl">
            Aggregated across every room you've touched plus the house room. Powered by on-chain state.
          </p>
        </div>

        <button
          onClick={() => setTick((n) => n + 1)}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-white/70 text-xs font-mono uppercase tracking-wider disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} strokeWidth={2.25} />
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {players.length === 0 ? (
        <EmptyState loading={loading} hasRooms={rooms.length > 0} connected={isWalletConnected()} />
      ) : (
        <>
          {/* Top 3 podium */}
          {top3.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              {top3.map((p) => {
                const badge = rankBadge(p.rank)
                const Icon = badge?.Icon || Award
                return (
                  <div
                    key={p.addr}
                    className={`card glass relative overflow-hidden ${
                      p.rank === 1 ? 'border-gold/40 shadow-[0_0_60px_rgba(255,206,84,0.18)]' : ''
                    } ${p.isMe ? 'ring-1 ring-plasma/40' : ''}`}
                  >
                    <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-white/5 blur-2xl" />
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-xl border flex items-center justify-center ${badge?.cls || 'border-white/10 bg-white/5'}`}>
                        <Icon className="w-6 h-6" strokeWidth={2} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-white/40 text-xs font-mono">#{p.rank}</div>
                        <div className="text-white font-display font-700 text-lg truncate flex items-center gap-2">
                          {p.name}
                          {p.isMe && (
                            <span className="badge bg-plasma/15 text-plasma border border-plasma/30 text-[9px] tracking-widest">YOU</span>
                          )}
                        </div>
                        <div className="text-white/30 text-[10px] font-mono truncate">{p.addr}</div>
                      </div>
                      <Avatar name={p.name} color={p.color} size={40} />
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-5">
                      <Stat label="XP"        value={p.xp} />
                      <Stat label="Wins"      value={p.wins} />
                      <Stat label="Win rate"  value={`${p.winRate}%`} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Table */}
          {rest.length > 0 && (
            <div className="card glass !p-0 overflow-hidden">
              <div className="grid grid-cols-12 gap-2 px-5 py-3 text-[10px] font-mono uppercase tracking-widest text-white/40 border-b border-white/10">
                <div className="col-span-1">#</div>
                <div className="col-span-6">Player</div>
                <div className="col-span-2 text-right">XP</div>
                <div className="col-span-1 text-right">Wins</div>
                <div className="col-span-2 text-right">Win rate</div>
              </div>
              <div className="divide-y divide-white/5">
                {rest.map((p) => (
                  <div
                    key={p.addr}
                    className={`grid grid-cols-12 gap-2 px-5 py-3 items-center transition-colors ${
                      p.isMe ? 'bg-plasma/[0.06]' : 'hover:bg-white/[0.03]'
                    }`}
                  >
                    <div className="col-span-1 text-white/40 font-mono text-sm">{p.rank}</div>
                    <div className="col-span-6 min-w-0 flex items-center gap-3">
                      <Avatar name={p.name} color={p.color} size={28} />
                      <div className="min-w-0">
                        <div className="text-white text-sm truncate flex items-center gap-2">
                          {p.name}
                          {p.isMe && (
                            <span className="badge bg-plasma/15 text-plasma border border-plasma/30 text-[9px] tracking-widest">YOU</span>
                          )}
                        </div>
                        <div className="text-white/30 text-xs font-mono truncate">{p.addr}</div>
                      </div>
                    </div>
                    <div className="col-span-2 text-right text-white/85 font-mono text-sm">{p.xp}</div>
                    <div className="col-span-1 text-right text-white/85 font-mono text-sm">{p.wins}</div>
                    <div className="col-span-2 text-right text-neon font-mono text-sm">{p.winRate}%</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Footnote */}
      <div className="mt-6 flex items-center gap-2 text-xs text-white/40">
        <Flame className="w-3.5 h-3.5 text-signal" />
        Aggregated from {roomStates.length} room{roomStates.length === 1 ? '' : 's'}. Join more rooms to grow the board.
      </div>
    </div>
  )
}

function EmptyState({ loading, hasRooms, connected }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-14 text-center">
      <Trophy className="w-10 h-10 text-gold/30 mx-auto mb-4" />
      <div className="text-white/85 font-display font-700 text-xl mb-2">
        {loading ? 'Reading on-chain scores…'
          : !hasRooms ? 'The board is empty'
          : 'No players found yet'}
      </div>
      <div className="text-white/45 text-sm max-w-md mx-auto leading-relaxed">
        {loading
          ? 'Fetching scoreboards from every room you have joined.'
          : !hasRooms
            ? 'The leaderboard fills as rooms complete. Join your first case to appear here — your rank will update automatically after each game.'
            : connected
              ? 'Once players finish games in the rooms you\'ve joined, they\'ll rank here. Play more to grow the board.'
              : 'Connect your wallet to see your rank highlighted among other jurors.'}
      </div>
      {!loading && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <div className="text-white/20 text-xs font-mono">
            ℹ︎ This board aggregates only rooms you personally joined — not a global feed.
          </div>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div className="rounded-lg bg-white/[0.03] border border-white/10 px-2.5 py-2">
      <div className="text-[10px] font-mono uppercase tracking-wider text-white/40">{label}</div>
      <div className="text-white text-sm font-mono mt-0.5">{value}</div>
    </div>
  )
}
