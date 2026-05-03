import React, { useEffect, useState } from 'react'
import { Trophy, Crown, Medal, Award, Flame, RefreshCw, TrendingUp } from 'lucide-react'
import {
  readContractView,
  myAddress,
  isWalletConnected,
  hasContractAddress,
  subscribeWallet,
} from '../lib/genlayer'
import {
  listJoinedRooms,
  subscribeJoinedRooms,
} from '../lib/joinedRooms'
import Avatar from '../components/Avatar'

// Fallback: aggregate stats from per-room state snapshots.
function aggregateFromRooms(roomStates, address) {
  const me  = (address || '').toLowerCase()
  const acc = new Map()
  for (const s of roomStates) {
    if (!s) continue
    const winner  = (s.winnerAddress || '').toLowerCase()
    const players = s.players || {}
    for (const [k, rec] of Object.entries(players)) {
      const a   = String(k).toLowerCase()
      const cur = acc.get(a) || {
        addr:  a,
        name:  rec?.name || `${a.slice(0, 6)}\u2026${a.slice(-4)}`,
        color: rec?.color || '#a259ff',
        xp:    0,
        wins:  0,
        games: 0,
      }
      cur.xp    += Number(rec?.xp || 0)
      cur.games += 1
      if (winner && winner === a) cur.wins += 1
      if (rec?.name && rec.name.length > cur.name.length) cur.name = rec.name
      acc.set(a, cur)
    }
  }
  const list = Array.from(acc.values())
  list.sort((a, b) => b.xp - a.xp || b.wins - a.wins)
  return list.map((p, i) => ({
    ...p,
    rank:    i + 1,
    isMe:    me && p.addr === me,
    winRate: p.games > 0 ? Math.round((p.wins / p.games) * 100) : 0,
  }))
}

export default function LeaderboardPage() {
  const [rooms, setRooms] = useState(() => listJoinedRooms())
  useEffect(() => subscribeJoinedRooms(() => setRooms(listJoinedRooms())), [])

  const [loading,   setLoading]   = useState(false)
  const [players,   setPlayers]   = useState([])
  const [roomCount, setRoomCount] = useState(0) // -1 = global mode
  const [tick,      setTick]      = useState(0)
  const [, force]                  = useState(0)
  const address = myAddress()

  useEffect(() => subscribeWallet(() => force(n => n + 1)), [])

  const refresh = async () => {
    if (!hasContractAddress()) { setPlayers([]); setRoomCount(0); return }
    setLoading(true)
    try {
      // Primary: contract's global leaderboard (cross-room, authoritative)
      const raw    = await readContractView('get_global_leaderboard', [50])
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
      if (Array.isArray(parsed) && parsed.length > 0) {
        const me = (address || '').toLowerCase()
        const list = parsed.map((p, i) => ({
          addr:    String(p.address || '').toLowerCase(),
          name:    p.name || `${String(p.address || '').slice(0, 6)}\u2026`,
          color:   p.color || '#a259ff',
          xp:      Number(p.xp || 0),
          wins:    Number(p.wins || 0),
          games:   0,
          rank:    i + 1,
          winRate: 0,
          isMe:    String(p.address || '').toLowerCase() === me,
        }))
        setPlayers(list)
        setRoomCount(-1)
        setLoading(false)
        return
      }
    } catch {
      // Global endpoint not available — fall through to per-room scan
    }

    // Fallback: scan per-room states from joined rooms
    if (!rooms.length) { setPlayers([]); setRoomCount(0); setLoading(false); return }
    try {
      const states = await Promise.all(
        rooms.map(async (r) => {
          try {
            const raw    = await readContractView('get_room_state', [r.code])
            const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
            return parsed?.roomCode ? parsed : null
          } catch { return null }
        })
      )
      const valid = states.filter(Boolean)
      setPlayers(aggregateFromRooms(valid, address))
      setRoomCount(valid.length)
    } catch {
      setPlayers([])
      setRoomCount(0)
    }
    setLoading(false)
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { refresh() }, [rooms, tick, address])

  const top3 = players.slice(0, 3)
  const rest = players.slice(3)

  const rankMeta = {
    1: { Icon: Crown,  cls: 'bg-gold/12 border-gold/30 text-gold',    size: 'text-gold' },
    2: { Icon: Trophy, cls: 'bg-white/8 border-white/20 text-white/70', size: 'text-white/60' },
    3: { Icon: Medal,  cls: 'bg-signal/10 border-signal/25 text-signal', size: 'text-signal/80' },
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10 sm:py-14">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-10">
        <div>
          <div className="inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.2em] text-white/40 mb-3 px-3 py-1 rounded-full border border-white/[0.07] bg-white/[0.03]">
            <Trophy className="w-3.5 h-3.5 text-gold" />
            Hall of judges
          </div>
          <h1 className="font-display font-bold text-3xl sm:text-4xl text-white tracking-tight mb-2">
            Leaderboard
          </h1>
          <p className="text-white/50 max-w-xl text-sm leading-relaxed">
            Aggregated across every room you've touched. Powered by on-chain state.
          </p>
        </div>

        <button
          onClick={() => setTick((n) => n + 1)}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/[0.09] bg-white/[0.04] hover:bg-white/[0.07] text-white/60 hover:text-white text-xs font-mono uppercase tracking-wider disabled:opacity-50 transition-all flex-shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} strokeWidth={2.25} />
          {loading ? 'Refreshing\u2026' : 'Refresh'}
        </button>
      </div>

      {players.length === 0 ? (
        <EmptyState loading={loading} hasRooms={rooms.length > 0} connected={isWalletConnected()} />
      ) : (
        <>
          {/* Top 3 podium */}
          {top3.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {top3.map((p) => {
                const rm   = rankMeta[p.rank]
                const Icon = rm?.Icon || Award
                return (
                  <div
                    key={p.addr}
                    className={`relative glass rounded-2xl border overflow-hidden p-5 transition-all duration-300 ${
                      p.rank === 1
                        ? 'border-gold/35 podium-1'
                        : p.rank === 2
                        ? 'border-white/15'
                        : 'border-signal/20'
                    } ${p.isMe ? 'ring-1 ring-plasma/40' : ''}`}
                  >
                    <div className={`absolute -top-10 -right-10 w-32 h-32 rounded-full blur-3xl opacity-30 pointer-events-none ${
                      p.rank === 1 ? 'bg-gold/30' : p.rank === 2 ? 'bg-white/10' : 'bg-signal/20'
                    }`} />

                    {p.rank === 1 && (
                      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/60 to-transparent" />
                    )}

                    <div className="relative flex items-center gap-3 mb-4">
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center border ${rm?.cls || 'border-white/10 bg-white/5'} flex-shrink-0`}>
                        <Icon className="w-5 h-5" strokeWidth={2} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-white/35 text-[10px] font-mono mb-0.5">RANK #{p.rank}</div>
                        <div className="text-white font-display font-bold text-base truncate flex items-center gap-1.5">
                          {p.name}
                          {p.isMe && (
                            <span className="badge bg-plasma/15 text-plasma border border-plasma/30 text-[9px] tracking-widest flex-shrink-0">YOU</span>
                          )}
                        </div>
                      </div>
                      <Avatar name={p.name} color={p.color} size={36} />
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <Stat label="XP"    value={p.xp}             />
                      <Stat label="Wins"  value={p.wins}           />
                      <Stat label="Win %" value={`${p.wins > 0 ? p.wins : 0}\u00d7`} highlight={p.rank === 1} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Rest — table */}
          {rest.length > 0 && (
            <div className="glass rounded-2xl border border-white/[0.08] overflow-hidden">
              <div className="grid grid-cols-12 gap-2 px-5 py-3.5 text-[10px] font-mono uppercase tracking-widest text-white/30 border-b border-white/[0.07] bg-white/[0.02]">
                <div className="col-span-1">#</div>
                <div className="col-span-6">Player</div>
                <div className="col-span-2 text-right">XP</div>
                <div className="col-span-2 text-right">Wins</div>
                <div className="col-span-1 text-right">Lvl</div>
              </div>

              <div className="divide-y divide-white/[0.05]">
                {rest.map((p) => (
                  <div
                    key={p.addr}
                    className={`grid grid-cols-12 gap-2 px-5 py-3.5 items-center transition-colors ${
                      p.isMe
                        ? 'bg-plasma/[0.05] border-l-2 border-l-plasma/50'
                        : 'hover:bg-white/[0.025]'
                    }`}
                  >
                    <div className="col-span-1 text-white/35 font-mono text-sm">{p.rank}</div>
                    <div className="col-span-6 min-w-0 flex items-center gap-2.5">
                      <Avatar name={p.name} color={p.color} size={28} />
                      <div className="min-w-0">
                        <div className="text-white text-sm truncate flex items-center gap-1.5">
                          {p.name}
                          {p.isMe && (
                            <span className="badge bg-plasma/15 text-plasma border border-plasma/30 text-[9px] tracking-widest">YOU</span>
                          )}
                        </div>
                        <div className="text-white/25 text-[10px] font-mono truncate">{p.addr.slice(0, 14)}\u2026</div>
                      </div>
                    </div>
                    <div className="col-span-2 text-right text-white/80 font-mono text-sm">{p.xp}</div>
                    <div className="col-span-2 text-right text-white/80 font-mono text-sm">{p.wins}</div>
                    <div className="col-span-1 text-right font-mono text-sm text-plasma/70">{p.level ?? 1}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Footnote */}
      <div className="mt-6 flex items-center gap-2 text-xs text-white/30 font-mono">
        <Flame className="w-3.5 h-3.5 text-signal/60" />
        {roomCount === -1
          ? 'Global on-chain leaderboard — all rooms, all time.'
          : `Aggregated from ${roomCount} room${roomCount === 1 ? '' : 's'}. Join more rooms to grow the board.`}
      </div>
    </div>
  )
}

function EmptyState({ loading, hasRooms, connected }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.02] px-6 py-16 text-center">
      <div className="w-16 h-16 rounded-2xl bg-gold/8 border border-gold/20 flex items-center justify-center mx-auto mb-5">
        <TrendingUp className="w-7 h-7 text-gold/40" strokeWidth={1.75} />
      </div>
      <div className="text-white/80 font-display font-bold text-xl mb-2">
        {loading
          ? 'Reading on-chain scores\u2026'
          : !hasRooms
          ? 'The board is empty'
          : 'No players found yet'}
      </div>
      <div className="text-white/40 text-sm max-w-md mx-auto leading-relaxed">
        {loading
          ? 'Fetching scoreboards from the chain.'
          : !hasRooms
          ? 'The leaderboard fills as rooms complete. Join your first case to appear here.'
          : connected
          ? "Once players finish games, they'll rank here."
          : 'Connect your wallet to see your rank highlighted among other jurors.'}
      </div>
    </div>
  )
}

function Stat({ label, value, highlight = false }) {
  return (
    <div className="rounded-xl bg-white/[0.03] border border-white/[0.07] px-2.5 py-2.5 text-center">
      <div className="text-[9px] font-mono uppercase tracking-wider text-white/30 mb-1">{label}</div>
      <div className={`font-mono text-sm font-medium ${highlight ? 'text-gold text-glow-gold' : 'text-white/80'}`}>
        {value}
      </div>
    </div>
  )
}
