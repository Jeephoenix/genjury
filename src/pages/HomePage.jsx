import React, { useEffect, useState } from 'react'
import {
  ShieldCheck,
  Brain,
  Coins,
  ArrowRight,
  Sparkles,
  Dice5,
  Swords,
  Wallet,
  Gamepad2,
  Trophy,
  Users,
  Activity,
} from 'lucide-react'
import useGameStore from '../lib/store'
import { getChainNativeSymbol, readContractView, hasContractAddress } from '../lib/genlayer'
import MistrialMark from '../components/MistrialMark'

const HOW_IT_WORKS = [
  {
    Icon: Gamepad2,
    title: 'Pick a case',
    body: 'Browse the docket. Every game is provably fair and presided over by an AI Judge on GenLayer.',
  },
  {
    Icon: Wallet,
    title: 'Take a seat',
    body: 'Connect your wallet, stake the entry fee, and join the jury — invite friends or jump into a public case.',
  },
  {
    Icon: Trophy,
    title: 'Claim the purse',
    body: 'The AI Judge rules on-chain. The winning juror sweeps the purse — no clerks, no house edge beyond the small AI fee.',
  },
]

const ALL_GAMES = [
  {
    id: 'mistrial',
    name: 'Mistrial',
    tagline: 'Bluffing meets an on-chain AI Judge.',
    accent: 'neon',
    icon: MistrialMark,
    status: 'live',
  },
  {
    id: 'highstakes-poker',
    name: 'Highstakes',
    tagline: 'No-limit Hold\u2019em with verifiable shuffles.',
    accent: 'plasma',
    icon: Dice5,
    status: 'soon',
  },
  {
    id: 'crossfire',
    name: 'Crossfire',
    tagline: 'Realtime trivia duels, AI-graded.',
    accent: 'signal',
    icon: Swords,
    status: 'soon',
  },
  {
    id: 'oracle-arena',
    name: 'Oracle Arena',
    tagline: 'Predict the unpredictable. Win the pot.',
    accent: 'gold',
    icon: Sparkles,
    status: 'soon',
  },
]

const ACCENT = {
  neon:   { ring: 'border-neon/40',   text: 'text-neon',   glow: 'shadow-[0_0_45px_rgba(127,255,110,0.18)]' },
  plasma: { ring: 'border-plasma/40', text: 'text-plasma', glow: 'shadow-[0_0_45px_rgba(162,89,255,0.18)]'  },
  signal: { ring: 'border-signal/40', text: 'text-signal', glow: 'shadow-[0_0_45px_rgba(255,138,0,0.18)]'   },
  gold:   { ring: 'border-gold/40',   text: 'text-gold',   glow: 'shadow-[0_0_45px_rgba(255,206,84,0.18)]'  },
}

export default function HomePage() {
  const setActiveTab = useGameStore((s) => s.setActiveTab)
  const symbol = getChainNativeSymbol()

  const [houseStats, setHouseStats] = useState(null)
  useEffect(() => {
    if (!hasContractAddress()) return
    ;(async () => {
      try {
        const raw = await readContractView('get_house_info', [])
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
        setHouseStats(parsed)
      } catch {}
    })()
  }, [])

  const playGame = (id) => {
    if (id === 'mistrial') setActiveTab('mistrial')
    else setActiveTab('games')
  }

  const featured = ALL_GAMES.find((g) => g.status === 'live') || ALL_GAMES[0]
  const FA = ACCENT[featured.accent]
  const FeaturedIcon = featured.icon

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-12 sm:py-20">
      {/* Hero */}
      <section className="text-center animate-slide-up">
        <div className="inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.22em] text-white/45 mb-5">
          <ShieldCheck className="w-3.5 h-3.5 text-neon" />
          On-chain games · AI-judged · Built on GenLayer
        </div>
        <h1 className="font-display font-800 text-5xl sm:text-7xl text-white tracking-tight leading-[0.95]">
          Provably fair games,
          <br />
          <span className="shimmer-text">judged on-chain.</span>
        </h1>
        <p className="text-white/55 text-base sm:text-lg max-w-xl mx-auto mt-6 leading-relaxed">
          Genjury is a courthouse of on-chain games where an AI Judge rules every case.
          Stake {symbol}, summon a jury, and let the chain hand down the verdict.
        </p>

        {/* Mechanic pills */}
        <div className="flex flex-wrap gap-2 justify-center mt-7">
          {[
            { Icon: Brain,        label: 'AI-judged' },
            { Icon: ShieldCheck,  label: 'Provably fair' },
            { Icon: Coins,        label: `Stake ${symbol}, win the purse` },
          ].map(({ Icon, label }) => (
            <span
              key={label}
              className="inline-flex items-center gap-1.5 badge bg-white/5 border border-white/10 text-white/70 text-sm py-1.5 px-3"
            >
              <Icon className="w-3.5 h-3.5 text-white/55" strokeWidth={2.25} />
              {label}
            </span>
          ))}
        </div>

        {/* Live stats bar */}
        {houseStats && (
          <div className="flex flex-wrap items-center justify-center gap-4 mt-5">
            <div className="flex items-center gap-1.5 text-white/40 text-xs font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-neon animate-pulse" />
              <span className="text-white/70">{Number(houseStats.totalGamesPlayed || 0)}</span> games played
            </div>
            {houseStats.openRoomsCount > 0 && (
              <div className="flex items-center gap-1.5 text-white/40 text-xs font-mono">
                <Activity className="w-3 h-3 text-signal" />
                <span className="text-signal">{houseStats.openRoomsCount}</span> active rooms
              </div>
            )}
            {houseStats.totalPlayersEver > 0 && (
              <div className="flex items-center gap-1.5 text-white/40 text-xs font-mono">
                <Users className="w-3 h-3 text-ice" />
                <span className="text-ice/80">{houseStats.totalPlayersEver}</span> jurors
              </div>
            )}
          </div>
        )}

        {/* Primary CTAs */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8 max-w-md mx-auto">
          <button
            onClick={() => playGame(featured.id)}
            className="btn btn-neon flex-1 py-3.5 text-sm inline-flex items-center justify-center gap-2"
          >
            Play {featured.name}
            <ArrowRight className="w-4 h-4" strokeWidth={2.25} />
          </button>
          <button
            onClick={() => setActiveTab('games')}
            className="btn btn-ghost flex-1 py-3.5 text-sm inline-flex items-center justify-center gap-2"
          >
            Browse all games
          </button>
        </div>
      </section>

      {/* Featured game spotlight */}
      <section
        className="mt-16 sm:mt-20 animate-slide-up"
        style={{ animationDelay: '0.1s' }}
      >
        <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.22em] text-white/40 mb-4">
          <span className="w-1.5 h-1.5 rounded-full bg-neon animate-pulse" />
          Featured · live now
        </div>
        <div
          className={`card glass relative overflow-hidden ${FA.ring} ${FA.glow}`}
        >
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-neon/60 to-transparent" />
          <div className="flex flex-col sm:flex-row sm:items-center gap-5">
            <div
              className={`w-16 h-16 rounded-2xl flex items-center justify-center bg-white/5 border border-white/10 flex-shrink-0 ${FA.text}`}
            >
              <FeaturedIcon className="w-8 h-8" strokeWidth={1.85} />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-display font-700 text-2xl text-white">
                {featured.name}
              </h2>
              <p className="text-white/65 text-sm mt-1">{featured.tagline}</p>
              <p className="text-white/45 text-sm mt-2 leading-relaxed">
                Three statements, one lie. Detectors vote, the AI Judge
                deliberates on-chain, and objections can flip the verdict.
              </p>
            </div>
            <button
              onClick={() => playGame(featured.id)}
              className="btn btn-neon px-5 py-3 text-sm inline-flex items-center justify-center gap-2 sm:flex-shrink-0"
            >
              Play now
              <ArrowRight className="w-4 h-4" strokeWidth={2.25} />
            </button>
          </div>
        </div>
      </section>

      {/* All games mini-grid */}
      <section
        className="mt-16 animate-slide-up"
        style={{ animationDelay: '0.15s' }}
      >
        <div className="flex items-end justify-between mb-5">
          <h2 className="font-display font-700 text-xl sm:text-2xl text-white">
            All games
          </h2>
          <button
            onClick={() => setActiveTab('games')}
            className="text-white/55 hover:text-white text-sm inline-flex items-center gap-1 transition-colors"
          >
            View catalog
            <ArrowRight className="w-3.5 h-3.5" strokeWidth={2.25} />
          </button>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {ALL_GAMES.map((g) => {
            const a = ACCENT[g.accent]
            const Icon = g.icon
            const live = g.status === 'live'
            return (
              <button
                key={g.id}
                onClick={() => playGame(g.id)}
                disabled={!live}
                className={`group text-left rounded-xl border bg-white/[0.02] hover:bg-white/[0.04] p-4 transition-colors ${
                  a.ring
                } ${live ? '' : 'opacity-60 cursor-not-allowed'}`}
              >
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center bg-white/5 border border-white/10 mb-3 ${a.text}`}
                >
                  <Icon className="w-5 h-5" strokeWidth={2} />
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-display font-700 text-white text-base">
                    {g.name}
                  </h3>
                  <span
                    className={`text-[9px] font-mono tracking-widest px-1.5 py-0.5 rounded ${
                      live
                        ? 'bg-neon/15 text-neon border border-neon/30'
                        : 'bg-white/5 text-white/45 border border-white/10'
                    }`}
                  >
                    {live ? 'LIVE' : 'SOON'}
                  </span>
                </div>
                <p className="text-white/45 text-xs mt-1.5 leading-snug">
                  {g.tagline}
                </p>
              </button>
            )
          })}
        </div>
      </section>

      {/* How it works */}
      <section
        className="mt-16 sm:mt-20 animate-slide-up"
        style={{ animationDelay: '0.2s' }}
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.22em] text-white/40 mb-2">
            How it works
          </div>
          <h2 className="font-display font-700 text-2xl sm:text-3xl text-white">
            Three steps to a verdict
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {HOW_IT_WORKS.map(({ Icon, title, body }, i) => (
            <div
              key={title}
              className="rounded-xl border border-white/10 bg-white/[0.02] p-5"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 text-white/80 flex items-center justify-center">
                  <Icon className="w-4 h-4" strokeWidth={2.25} />
                </div>
                <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/35">
                  Step {i + 1}
                </span>
              </div>
              <h3 className="font-display font-700 text-white text-lg">
                {title}
              </h3>
              <p className="text-white/55 text-sm mt-1.5 leading-relaxed">
                {body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Closing band */}
      <section
        className="mt-16 sm:mt-20 rounded-2xl border border-white/10 bg-gradient-to-br from-plasma/10 via-white/[0.02] to-transparent p-6 sm:p-8 text-center animate-slide-up"
        style={{ animationDelay: '0.25s' }}
      >
        <h3 className="font-display font-700 text-white text-2xl sm:text-3xl">
          Ready to take the stand?
        </h3>
        <p className="text-white/55 text-sm sm:text-base mt-2 max-w-lg mx-auto">
          Walk into a live courtroom or browse the catalog. New games ship monthly.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6 max-w-md mx-auto">
          <button
            onClick={() => playGame(featured.id)}
            className="btn btn-neon flex-1 py-3 text-sm inline-flex items-center justify-center gap-2"
          >
            Play {featured.name}
            <ArrowRight className="w-4 h-4" strokeWidth={2.25} />
          </button>
          <button
            onClick={() => setActiveTab('games')}
            className="btn btn-ghost flex-1 py-3 text-sm"
          >
            See all games
          </button>
        </div>
        <p className="text-white/25 text-xs font-mono mt-6">
          Built on{' '}
          <a
            href="https://genlayer.com"
            target="_blank"
            rel="noopener"
            className="text-plasma/60 hover:text-plasma transition-colors"
          >
            GenLayer
          </a>{' '}
          · Intelligent Contracts · Optimistic Democracy
        </p>
      </section>
    </div>
  )
}
