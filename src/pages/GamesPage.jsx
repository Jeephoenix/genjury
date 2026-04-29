import React from 'react'
import {
  Sparkles,
  Hourglass,
  Users,
  Coins,
  ArrowRight,
  ShieldCheck,
  Brain,
  Swords,
  Dice5,
} from 'lucide-react'
import useGameStore from '../lib/store'

const GAMES = [
  {
    id: 'genjury',
    name: 'Genjury',
    tagline: 'Bluffing meets an on-chain AI Judge.',
    description:
      'Three statements, one lie. Detectors vote, the AI Judge deliberates on-chain, and objections can flip the verdict.',
    status: 'live',
    players: '3 – 8',
    minStake: '0 – 1 GEN',
    accent: 'neon',
    icon: Brain,
  },
  {
    id: 'highstakes-poker',
    name: 'Highstakes',
    tagline: 'No-limit Hold\u2019em with verifiable shuffles.',
    description:
      'Provably fair shuffles via on-chain randomness. Sit down, stack chips, and play poker that nobody can rig.',
    status: 'soon',
    players: '2 – 9',
    minStake: '0.05 GEN',
    accent: 'plasma',
    icon: Dice5,
  },
  {
    id: 'crossfire',
    name: 'Crossfire',
    tagline: 'Realtime trivia duels with AI-graded answers.',
    description:
      'Head-to-head trivia where the AI Judge scores creativity, accuracy, and speed. First to five rounds takes the pot.',
    status: 'soon',
    players: '2',
    minStake: '0.01 GEN',
    accent: 'signal',
    icon: Swords,
  },
  {
    id: 'oracle-arena',
    name: 'Oracle Arena',
    tagline: 'Predict the unpredictable. Win the pot.',
    description:
      'Submit predictions on real-world events. The on-chain Oracle settles outcomes and pays out the closest forecasts.',
    status: 'soon',
    players: '4 – 32',
    minStake: '0.1 GEN',
    accent: 'gold',
    icon: Sparkles,
  },
]

const ACCENT = {
  neon:   { ring: 'border-neon/50',   chip: 'bg-neon/15 text-neon',     glow: 'shadow-[0_0_50px_rgba(127,255,110,0.18)]', text: 'text-neon',   bar: 'from-neon/60' },
  plasma: { ring: 'border-plasma/50', chip: 'bg-plasma/15 text-plasma', glow: 'shadow-[0_0_50px_rgba(162,89,255,0.18)]',  text: 'text-plasma', bar: 'from-plasma/60' },
  signal: { ring: 'border-signal/50', chip: 'bg-signal/15 text-signal', glow: 'shadow-[0_0_50px_rgba(255,138,0,0.18)]',   text: 'text-signal', bar: 'from-signal/60' },
  gold:   { ring: 'border-gold/50',   chip: 'bg-gold/15 text-gold',     glow: 'shadow-[0_0_50px_rgba(255,206,84,0.18)]',  text: 'text-gold',   bar: 'from-gold/60' },
}

export default function GamesPage() {
  const setActiveTab = useGameStore((s) => s.setActiveTab)

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10 sm:py-14">
      {/* Section header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-[0.2em] text-white/40 mb-3">
            <ShieldCheck className="w-3.5 h-3.5 text-neon" />
            On-chain game catalog
          </div>
          <h1 className="font-display font-800 text-3xl sm:text-4xl text-white tracking-tight">
            Games
          </h1>
          <p className="text-white/55 mt-2 max-w-xl">
            A growing arcade of provably fair, AI-judged games settled on-chain. Pick one, stake in, play.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-white/40">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-neon animate-pulse" /> Live
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-white/30" /> Coming soon
          </span>
        </div>
      </div>

      {/* Game grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {GAMES.map((g) => {
          const a = ACCENT[g.accent]
          const Icon = g.icon
          const live = g.status === 'live'
          return (
            <div
              key={g.id}
              className={`group relative card glass overflow-hidden transition-all duration-300 ${a.ring} ${live ? a.glow + ' hover:-translate-y-0.5' : 'opacity-90'}`}
            >
              {/* Top accent bar */}
              <div className={`absolute inset-x-0 top-0 h-px bg-gradient-to-r ${a.bar} via-white/10 to-transparent`} />

              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center bg-white/5 border border-white/10 ${a.text}`}>
                  <Icon className="w-6 h-6" strokeWidth={2} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="font-display font-700 text-xl text-white">{g.name}</h2>
                    <span className={`badge text-[10px] tracking-widest ${live ? a.chip : 'bg-white/5 text-white/50 border border-white/10'}`}>
                      {live ? 'LIVE' : 'COMING SOON'}
                    </span>
                  </div>
                  <p className="text-white/70 text-sm mt-1">{g.tagline}</p>
                </div>
              </div>

              <p className="text-white/55 text-sm mt-4 leading-relaxed">{g.description}</p>

              <div className="grid grid-cols-2 gap-3 mt-5">
                <div className="rounded-lg bg-white/[0.03] border border-white/10 px-3 py-2.5">
                  <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-white/40">
                    <Users className="w-3 h-3" /> Players
                  </div>
                  <div className="text-white/90 text-sm font-mono mt-1">{g.players}</div>
                </div>
                <div className="rounded-lg bg-white/[0.03] border border-white/10 px-3 py-2.5">
                  <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-white/40">
                    <Coins className="w-3 h-3" /> Min stake
                  </div>
                  <div className="text-white/90 text-sm font-mono mt-1">{g.minStake}</div>
                </div>
              </div>

              <div className="mt-5">
                {live ? (
                  <button
                    onClick={() => setActiveTab('home')}
                    className="btn btn-neon w-full py-2.5 text-sm inline-flex items-center justify-center gap-2"
                  >
                    Play now
                    <ArrowRight className="w-4 h-4" strokeWidth={2.25} />
                  </button>
                ) : (
                  <button
                    disabled
                    className="w-full py-2.5 text-sm rounded-xl border border-white/10 bg-white/[0.03] text-white/40 inline-flex items-center justify-center gap-2 cursor-not-allowed"
                  >
                    <Hourglass className="w-4 h-4" />
                    In development
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer hint */}
      <div className="mt-10 rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-5 py-4 text-sm text-white/55 flex items-center gap-3">
        <Sparkles className="w-4 h-4 text-plasma flex-shrink-0" />
        Have an idea for the next game? The catalog ships new titles monthly — proposals welcome.
      </div>
    </div>
  )
}
