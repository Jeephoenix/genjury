import React, { useState } from 'react'
import { Trophy, Medal, Award, TrendingUp, Flame, Crown } from 'lucide-react'

const SEEDED = [
  { rank: 1,  name: 'cipher.eth',    addr: '0xA9c4…3f12', wins: 184, winRate: 71, earnings: '128.42', streak: 12, tier: 'mythic'   },
  { rank: 2,  name: 'lumen',         addr: '0x44b1…d09a', wins: 162, winRate: 68, earnings: '101.07', streak: 8,  tier: 'mythic'   },
  { rank: 3,  name: 'oracle9',       addr: '0x7e2c…ab44', wins: 149, winRate: 65, earnings:  '92.18', streak: 4,  tier: 'mythic'   },
  { rank: 4,  name: 'nyx.builds',    addr: '0xC0fe…1188', wins: 138, winRate: 63, earnings:  '78.66', streak: 3,  tier: 'diamond'  },
  { rank: 5,  name: 'phantom_byte',  addr: '0x21ee…ff03', wins: 122, winRate: 61, earnings:  '64.30', streak: 5,  tier: 'diamond'  },
  { rank: 6,  name: 'bluffmaster',   addr: '0x8aa9…4b2d', wins: 117, winRate: 59, earnings:  '60.81', streak: 2,  tier: 'diamond'  },
  { rank: 7,  name: 'detective.gg',  addr: '0x9013…77ab', wins: 104, winRate: 57, earnings:  '53.22', streak: 1,  tier: 'platinum' },
  { rank: 8,  name: 'glitchhunter',  addr: '0x5fea…0099', wins:  98, winRate: 55, earnings:  '47.91', streak: 6,  tier: 'platinum' },
  { rank: 9,  name: 'voidwalker',    addr: '0xB123…cd34', wins:  91, winRate: 54, earnings:  '42.05', streak: 0,  tier: 'platinum' },
  { rank: 10, name: 'silentecho',    addr: '0x6789…1ab2', wins:  85, winRate: 52, earnings:  '38.77', streak: 2,  tier: 'gold'     },
]

const TIER_COLORS = {
  mythic:   'text-plasma',
  diamond:  'text-ice',
  platinum: 'text-white/80',
  gold:     'text-gold',
}

const RANGES = ['Today', 'This week', 'All time']

function rankBadge(rank) {
  if (rank === 1) return { Icon: Crown,  cls: 'text-gold bg-gold/15 border-gold/30' }
  if (rank === 2) return { Icon: Trophy, cls: 'text-white bg-white/10 border-white/20' }
  if (rank === 3) return { Icon: Medal,  cls: 'text-signal bg-signal/15 border-signal/30' }
  return null
}

export default function LeaderboardPage() {
  const [range, setRange] = useState('This week')

  const top3 = SEEDED.slice(0, 3)
  const rest = SEEDED.slice(3)

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
            The sharpest detectives and the boldest deceivers, ranked by on-chain results.
          </p>
        </div>

        {/* Range pills */}
        <div className="inline-flex items-center rounded-xl bg-white/5 border border-white/10 p-1">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                range === r ? 'bg-white/10 text-white' : 'text-white/55 hover:text-white'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Top 3 podium */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {top3.map((p) => {
          const badge = rankBadge(p.rank)
          const Icon = badge?.Icon || Award
          return (
            <div
              key={p.addr}
              className={`card glass relative overflow-hidden ${
                p.rank === 1 ? 'border-gold/40 shadow-[0_0_60px_rgba(255,206,84,0.18)]' : ''
              }`}
            >
              <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-white/5 blur-2xl" />
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-xl border flex items-center justify-center ${badge?.cls || 'border-white/10 bg-white/5'}`}>
                  <Icon className="w-6 h-6" strokeWidth={2} />
                </div>
                <div className="min-w-0">
                  <div className="text-white/40 text-xs font-mono">#{p.rank}</div>
                  <div className="text-white font-display font-700 text-lg truncate">{p.name}</div>
                  <div className={`text-xs font-mono uppercase tracking-widest ${TIER_COLORS[p.tier]}`}>{p.tier}</div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-5">
                <Stat label="Wins"     value={p.wins} />
                <Stat label="Win rate" value={`${p.winRate}%`} />
                <Stat label="Earned"   value={`${p.earnings}`} suffix="GEN" />
              </div>
            </div>
          )
        })}
      </div>

      {/* Table */}
      <div className="card glass !p-0 overflow-hidden">
        <div className="grid grid-cols-12 gap-2 px-5 py-3 text-[10px] font-mono uppercase tracking-widest text-white/40 border-b border-white/10">
          <div className="col-span-1">#</div>
          <div className="col-span-5">Player</div>
          <div className="col-span-2 text-right">Wins</div>
          <div className="col-span-2 text-right">Win rate</div>
          <div className="col-span-2 text-right">Earned</div>
        </div>
        <div className="divide-y divide-white/5">
          {rest.map((p) => (
            <div key={p.addr} className="grid grid-cols-12 gap-2 px-5 py-3 items-center hover:bg-white/[0.03] transition-colors">
              <div className="col-span-1 text-white/40 font-mono text-sm">{p.rank}</div>
              <div className="col-span-5 min-w-0">
                <div className="text-white text-sm truncate">{p.name}</div>
                <div className="text-white/30 text-xs font-mono truncate">{p.addr}</div>
              </div>
              <div className="col-span-2 text-right text-white/85 font-mono text-sm">{p.wins}</div>
              <div className="col-span-2 text-right text-white/85 font-mono text-sm">{p.winRate}%</div>
              <div className="col-span-2 text-right text-neon font-mono text-sm">{p.earnings}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Footnote */}
      <div className="mt-6 flex items-center gap-2 text-xs text-white/40">
        <Flame className="w-3.5 h-3.5 text-signal" />
        Rankings refresh after each finalized round. Sample data shown — connect your wallet to start climbing.
      </div>
    </div>
  )
}

function Stat({ label, value, suffix }) {
  return (
    <div className="rounded-lg bg-white/[0.03] border border-white/10 px-2.5 py-2">
      <div className="text-[10px] font-mono uppercase tracking-wider text-white/40">{label}</div>
      <div className="text-white text-sm font-mono mt-0.5">
        {value}
        {suffix && <span className="text-white/40 text-[10px] ml-1">{suffix}</span>}
      </div>
    </div>
  )
}
