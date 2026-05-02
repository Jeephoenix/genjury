import React from 'react'
import {
  Sparkles,
  Hourglass,
  Users,
  Coins,
  ArrowRight,
  ShieldCheck,
  Swords,
  Dice5,
  Zap,
  Lock,
} from 'lucide-react'
import useGameStore from '../lib/store'
import MistrialMark from '../components/MistrialMark'

const GAMES = [
  {
    id: 'mistrial',
    name: 'Mistrial',
    tagline: 'Bluffing meets an on-chain AI Judge.',
    description:
      'Three statements, one lie. Detectors vote, the AI Judge deliberates on-chain, and objections can flip the verdict.',
    status: 'live',
    players: '3 – 8',
    minStake: '0 – 1 GEN',
    accent: 'neon',
    icon: MistrialMark,
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
  neon:   {
    border: 'border-neon/40',   text: 'text-neon',   bg: 'bg-neon/10',
    chip: 'bg-neon/15 text-neon border-neon/30',
    glow: 'shadow-[0_0_50px_rgba(127,255,110,0.1)]',
    topBar: 'from-neon/60',
    hoverGlow: 'hover:shadow-[0_0_60px_rgba(127,255,110,0.18)]',
  },
  plasma: {
    border: 'border-plasma/40', text: 'text-plasma', bg: 'bg-plasma/10',
    chip: 'bg-plasma/15 text-plasma border-plasma/30',
    glow: 'shadow-[0_0_50px_rgba(162,89,255,0.08)]',
    topBar: 'from-plasma/60',
    hoverGlow: 'hover:shadow-[0_0_60px_rgba(162,89,255,0.15)]',
  },
  signal: {
    border: 'border-signal/40', text: 'text-signal', bg: 'bg-signal/10',
    chip: 'bg-signal/15 text-signal border-signal/30',
    glow: 'shadow-[0_0_50px_rgba(255,107,53,0.08)]',
    topBar: 'from-signal/60',
    hoverGlow: 'hover:shadow-[0_0_60px_rgba(255,107,53,0.15)]',
  },
  gold:   {
    border: 'border-gold/40',   text: 'text-gold',   bg: 'bg-gold/10',
    chip: 'bg-gold/15 text-gold border-gold/30',
    glow: 'shadow-[0_0_50px_rgba(245,200,66,0.08)]',
    topBar: 'from-gold/60',
    hoverGlow: 'hover:shadow-[0_0_60px_rgba(245,200,66,0.15)]',
  },
}

export default function GamesPage() {
  const setActiveTab = useGameStore((s) => s.setActiveTab)

  const handlePlay = (gameId) => setActiveTab(gameId)

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10 sm:py-14">
      {/* Section header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-10">
        <div>
          <div className="inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.2em] text-white/40 mb-3 px-3 py-1 rounded-full border border-white/[0.07] bg-white/[0.03]">
            <ShieldCheck className="w-3.5 h-3.5 text-neon" />
            On-chain game catalog
          </div>
          <h1 className="font-display font-bold text-3xl sm:text-4xl text-white tracking-tight mb-2">
            Games
          </h1>
          <p className="text-white/50 max-w-xl text-sm leading-relaxed">
            A growing arcade of provably fair, AI-judged games settled on-chain. Pick one, stake in, play.
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs text-white/40 font-mono flex-shrink-0">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-neon shadow-[0_0_6px_#7fff6e]" /> Live
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Lock className="w-3 h-3 text-white/25" /> Coming soon
          </span>
        </div>
      </div>

      {/* Game grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {GAMES.map((g) => {
          const a    = ACCENT[g.accent]
          const Icon = g.icon
          const live = g.status === 'live'
          return (
            <div
              key={g.id}
              className={`group relative glass rounded-2xl border overflow-hidden transition-all duration-300 ${a.border} ${a.glow} ${live ? `${a.hoverGlow} hover:-translate-y-0.5` : 'opacity-75'}`}
            >
              {/* Top accent gradient */}
              <div className={`absolute inset-x-0 top-0 h-px bg-gradient-to-r ${a.topBar} via-transparent to-transparent`} />

              {/* Corner ambient glow */}
              {live && (
                <div className={`absolute -top-8 -right-8 w-32 h-32 rounded-full ${a.bg} blur-3xl opacity-50 pointer-events-none`} />
              )}

              <div className="relative p-6">
                {/* Game icon + name row */}
                <div className="flex items-start gap-4 mb-5">
                  <div className={`w-13 h-13 w-[52px] h-[52px] rounded-2xl flex items-center justify-center ${a.bg} border ${a.border} ${a.text} transition-transform duration-200 ${live ? 'group-hover:scale-105' : ''} flex-shrink-0`}>
                    <Icon className="w-6 h-6" strokeWidth={live ? 1.85 : 2} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap mb-1">
                      <h2 className="font-display font-bold text-xl text-white">{g.name}</h2>
                      <span className={`text-[10px] font-mono tracking-widest px-2 py-0.5 rounded-full border ${
                        live ? a.chip : 'bg-white/[0.04] text-white/35 border-white/10'
                      }`}>
                        {live ? 'LIVE' : 'COMING SOON'}
                      </span>
                    </div>
                    <p className="text-white/60 text-sm">{g.tagline}</p>
                  </div>
                </div>

                <p className="text-white/45 text-sm leading-relaxed mb-5">{g.description}</p>

                {/* Stats row */}
                <div className="grid grid-cols-2 gap-3 mb-5">
                  <div className="rounded-xl bg-white/[0.03] border border-white/[0.07] px-3.5 py-3">
                    <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-white/35 mb-1.5">
                      <Users className="w-3 h-3" /> Players
                    </div>
                    <div className="text-white/85 text-sm font-mono font-medium">{g.players}</div>
                  </div>
                  <div className="rounded-xl bg-white/[0.03] border border-white/[0.07] px-3.5 py-3">
                    <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-white/35 mb-1.5">
                      <Coins className="w-3 h-3" /> Min stake
                    </div>
                    <div className="text-white/85 text-sm font-mono font-medium">{g.minStake}</div>
                  </div>
                </div>

                {/* CTA */}
                {live ? (
                  <button
                    onClick={() => handlePlay(g.id)}
                    className="btn btn-crimson w-full py-3 text-sm inline-flex items-center justify-center gap-2"
                  >
                    <Zap className="w-4 h-4" strokeWidth={2.5} />
                    Play now
                    <ArrowRight className="w-4 h-4 ml-auto" strokeWidth={2.25} />
                  </button>
                ) : (
                  <button
                    disabled
                    className="w-full py-3 text-sm rounded-xl border border-white/[0.08] bg-white/[0.03] text-white/30 inline-flex items-center justify-center gap-2 cursor-not-allowed"
                  >
                    <Hourglass className="w-4 h-4" strokeWidth={2} />
                    In development
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer hint */}
      <div className="mt-10 rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.02] px-5 py-4 text-sm text-white/45 flex items-center gap-3">
        <Sparkles className="w-4 h-4 text-plasma flex-shrink-0" strokeWidth={2.25} />
        Have an idea for the next game? The catalog ships new titles monthly — proposals welcome.
      </div>
    </div>
  )
}
