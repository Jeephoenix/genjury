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
  Zap,
} from 'lucide-react'
import useGameStore from '../lib/store'
import { getChainNativeSymbol, readContractView, hasContractAddress } from '../lib/genlayer'
import MistrialMark from '../components/MistrialMark'

// ── Hero char-reveal component ────────────────────────────────────────────────
// Each character appears individually with blur+lift, staggered by `charMs`.
function CharReveal({ text, startDelay = 0, charMs = 22, className = '' }) {
  return (
    <span className={className} aria-label={text}>
      {text.split('').map((ch, i) => (
        <span
          key={i}
          aria-hidden="true"
          style={{
            display: 'inline-block',
            opacity: 0,
            animation: 'charReveal 0.28s cubic-bezier(0.16,1,0.3,1) forwards',
            animationDelay: `${startDelay + i * charMs}ms`,
            whiteSpace: ch === ' ' ? 'pre' : undefined,
          }}
        >{ch}</span>
      ))}
    </span>
  )
}

// ── TV-subtitle cycling hook ──────────────────────────────────────────────────
// Phases: waiting → typing (char by char) → holding → fading → next phrase
const SUBTITLE_PHRASES = [
  'Mistrial — bluff the AI Judge.',
  'Highstakes — zero house edge.',
  'Crossfire — AI-graded trivia.',
  'Oracle Arena — chain decides.',
]

function useCyclingSubtitle(phrases, { charMs = 36, holdMs = 2600, fadeMs = 380, startDelay = 0 } = {}) {
  const [started, setStarted] = useState(startDelay === 0)
  const [idx,     setIdx]     = useState(0)
  const [chars,   setChars]   = useState(0)
  const [phase,   setPhase]   = useState('typing')

  useEffect(() => {
    if (started) return
    const t = setTimeout(() => setStarted(true), startDelay)
    return () => clearTimeout(t)
  }, [started, startDelay])

  useEffect(() => {
    if (!started) return
    const phrase = phrases[idx]
    if (phase === 'typing') {
      if (chars < phrase.length) {
        const t = setTimeout(() => setChars(c => c + 1), charMs)
        return () => clearTimeout(t)
      }
      const t = setTimeout(() => setPhase('holding'), 60)
      return () => clearTimeout(t)
    }
    if (phase === 'holding') {
      const t = setTimeout(() => setPhase('fading'), holdMs)
      return () => clearTimeout(t)
    }
    // fading
    const t = setTimeout(() => { setIdx(i => (i + 1) % phrases.length); setChars(0); setPhase('typing') }, fadeMs)
    return () => clearTimeout(t)
  }, [started, chars, phase, idx, phrases, charMs, holdMs, fadeMs])

  return { text: started ? phrases[idx].slice(0, chars) : '', fading: phase === 'fading' }
}

const HOW_IT_WORKS = [
  {
    Icon: Gamepad2,
    color: 'plasma',
    step: '01',
    title: 'Pick a case',
    body: 'Browse the docket. Every game is provably fair and presided over by an AI Judge on GenLayer.',
  },
  {
    Icon: Wallet,
    color: 'neon',
    step: '02',
    title: 'Take a seat',
    body: 'Connect your wallet, stake the entry fee, and join the jury — invite friends or jump into a public case.',
  },
  {
    Icon: Trophy,
    color: 'gold',
    step: '03',
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
  neon:   { border: 'border-neon/30',   text: 'text-neon',   bg: 'bg-neon/10',   glow: 'hover:shadow-[0_0_40px_rgba(127,255,110,0.14)]',   dot: 'bg-neon' },
  plasma: { border: 'border-plasma/30', text: 'text-plasma', bg: 'bg-plasma/10', glow: 'hover:shadow-[0_0_40px_rgba(162,89,255,0.14)]',   dot: 'bg-plasma' },
  signal: { border: 'border-signal/30', text: 'text-signal', bg: 'bg-signal/10', glow: 'hover:shadow-[0_0_40px_rgba(255,107,53,0.14)]',   dot: 'bg-signal' },
  gold:   { border: 'border-gold/30',   text: 'text-gold',   bg: 'bg-gold/10',   glow: 'hover:shadow-[0_0_40px_rgba(245,200,66,0.14)]',   dot: 'bg-gold' },
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

  const { text: subtitleText, fading: subtitleFading } = useCyclingSubtitle(SUBTITLE_PHRASES, {
    charMs: 28,
    startDelay: 1200,
  })

  const playGame = (id) => {
    if (id === 'mistrial') setActiveTab('mistrial')
    else setActiveTab('games')
  }

  const featured     = ALL_GAMES.find((g) => g.status === 'live') || ALL_GAMES[0]
  const FA           = ACCENT[featured.accent]
  const FeaturedIcon = featured.icon

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-12 sm:py-20">

      {/* ── Hero ── */}
      <section className="text-center animate-slide-up relative overflow-hidden">
        {/* Ambient background glows */}
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full bg-plasma/6 blur-[80px] pointer-events-none animate-hero-glow" />
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-[300px] h-[200px] rounded-full bg-crimson/5 blur-[60px] pointer-events-none" style={{ animationDelay: '2s', animation: 'heroGlow 10s ease-in-out 2s infinite' }} />

        <div className="relative">
          {/* Chain badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-[11px] font-mono uppercase tracking-[0.18em] text-white/45 mb-6 backdrop-blur-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-neon animate-pulse" />
            On-chain · AI-judged · Built on GenLayer
            <ShieldCheck className="w-3.5 h-3.5 text-neon ml-0.5" />
          </div>

          {/* ── Main headline ── letter-by-letter reveal */}
          <h1 className="font-display font-extrabold text-[2.35rem] sm:text-6xl tracking-tight leading-[0.92] mb-4">
            <span className="block text-white">
              <CharReveal text="Every game." startDelay={150} />
            </span>
            <span className="block text-crimson">
              {/* LINE2: 150 + 11 chars × 22ms + 55ms gap = ~447ms */}
              <CharReveal text="AI-judged. On-chain." startDelay={447} />
            </span>
          </h1>

          {/* ── TV cycling subtitle ── */}
          <div className="h-5 mb-5 flex items-center justify-center">
            <span
              className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/38 select-none whitespace-nowrap"
              style={{ transition: 'opacity 380ms ease', opacity: subtitleFading ? 0 : 1 }}
            >
              {subtitleText || '\u00A0'}
            </span>
          </div>

          <p className="text-white/48 text-base sm:text-lg max-w-lg mx-auto leading-relaxed">
            Genjury runs every game on GenLayer's Optimistic AI — an on-chain AI Judge
            that deliberates, rules, and settles each verdict with no house, no edge.
          </p>

          {/* Mechanic pills */}
          <div className="flex flex-wrap gap-2 justify-center mt-6">
            {[
              { Icon: Brain,       label: 'AI-judged',              color: 'text-plasma' },
              { Icon: ShieldCheck, label: 'Provably fair',           color: 'text-neon' },
              { Icon: Coins,       label: `Stake ${symbol}, win the purse`, color: 'text-gold' },
            ].map(({ Icon, label, color }) => (
              <span
                key={label}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-white/[0.09] bg-white/[0.04] text-white/65 text-sm backdrop-blur-sm"
              >
                <Icon className={`w-3.5 h-3.5 ${color}`} strokeWidth={2.25} />
                {label}
              </span>
            ))}
          </div>

          {/* Live stats */}
          {houseStats && (
            <div className="flex flex-wrap items-center justify-center gap-5 mt-5">
              <div className="flex items-center gap-1.5 text-white/35 text-xs font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-neon animate-pulse" />
                <span className="text-white/65">{Number(houseStats.totalGamesPlayed || 0)}</span>&nbsp;games played
              </div>
              {houseStats.openRoomsCount > 0 && (
                <div className="flex items-center gap-1.5 text-white/35 text-xs font-mono">
                  <Activity className="w-3 h-3 text-signal" />
                  <span className="text-signal">{houseStats.openRoomsCount}</span>&nbsp;active rooms
                </div>
              )}
              {houseStats.totalPlayersEver > 0 && (
                <div className="flex items-center gap-1.5 text-white/35 text-xs font-mono">
                  <Users className="w-3 h-3 text-ice" />
                  <span className="text-ice/80">{houseStats.totalPlayersEver}</span>&nbsp;jurors
                </div>
              )}
            </div>
          )}

          {/* Primary CTAs */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8 max-w-sm mx-auto">
            <button
              onClick={() => playGame(featured.id)}
              className="btn btn-crimson flex-1 py-3.5 text-sm inline-flex items-center justify-center gap-2"
            >
              <Zap className="w-4 h-4" strokeWidth={2.5} />
              Play {featured.name}
            </button>
            <button
              onClick={() => setActiveTab('games')}
              className="btn btn-ghost flex-1 py-3.5 text-sm inline-flex items-center justify-center gap-2"
            >
              Browse games
              <ArrowRight className="w-4 h-4" strokeWidth={2.25} />
            </button>
          </div>
        </div>
      </section>

      {/* ── Featured game spotlight ── */}
      <section className="mt-16 sm:mt-24 animate-slide-up" style={{ animationDelay: '0.08s' }}>
        <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.22em] text-white/35 mb-4">
          <span className="dot-live" />
          <span className="ml-2">Featured · live now</span>
        </div>

        <div className={`relative rounded-2xl border ${FA.border} bg-panel overflow-hidden card-lift`}
          style={{ boxShadow: '0 0 60px rgba(232,0,45,0.07)' }}>
          {/* Top accent */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-crimson/50 to-transparent" />
          {/* Corner glow */}
          <div className="absolute top-0 left-0 w-40 h-40 rounded-full bg-crimson/5 blur-3xl pointer-events-none" />

          <div className="relative p-6 sm:p-7 flex flex-col sm:flex-row sm:items-center gap-6">
            <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center ${FA.bg} border ${FA.border} flex-shrink-0 ${FA.text} float-anim`}>
              <FeaturedIcon className="w-8 h-8 sm:w-9 sm:h-9" strokeWidth={1.85} />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2.5 mb-1.5">
                <h2 className="font-display font-bold text-2xl text-white">{featured.name}</h2>
                <span className="badge bg-neon/12 border border-neon/30 text-neon text-[10px] font-mono tracking-widest">LIVE</span>
              </div>
              <p className="text-white/60 text-sm mb-2">{featured.tagline}</p>
              <p className="text-white/40 text-sm leading-relaxed max-w-md">
                Three statements, one lie. Detectors vote, the AI Judge deliberates on-chain,
                and objections can flip the verdict.
              </p>
            </div>

            <button
              onClick={() => playGame(featured.id)}
              className="btn btn-crimson px-6 py-3.5 text-sm inline-flex items-center justify-center gap-2 sm:flex-shrink-0"
            >
              Play now
              <ArrowRight className="w-4 h-4" strokeWidth={2.25} />
            </button>
          </div>
        </div>
      </section>

      {/* ── All games mini-grid ── */}
      <section className="mt-14 animate-slide-up" style={{ animationDelay: '0.12s' }}>
        <div className="flex items-end justify-between mb-5">
          <h2 className="font-display font-bold text-xl sm:text-2xl text-white">All games</h2>
          <button
            onClick={() => setActiveTab('games')}
            className="text-white/45 hover:text-white text-sm inline-flex items-center gap-1.5 transition-colors"
          >
            View catalog
            <ArrowRight className="w-3.5 h-3.5" strokeWidth={2.25} />
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {ALL_GAMES.map((g) => {
            const a    = ACCENT[g.accent]
            const Icon = g.icon
            const live = g.status === 'live'
            return (
              <button
                key={g.id}
                onClick={() => playGame(g.id)}
                disabled={!live}
                className={`group text-left rounded-2xl border p-4 transition-all duration-200 relative overflow-hidden ${
                  a.border
                } ${live
                  ? `bg-white/[0.025] hover:bg-white/[0.05] card-lift ${a.glow}`
                  : 'bg-white/[0.015] opacity-55 cursor-not-allowed'
                }`}
              >
                {live && (
                  <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-current to-transparent opacity-30" />
                )}

                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${a.bg} border ${a.border} mb-3.5 ${a.text} transition-transform duration-200 ${live ? 'group-hover:scale-105' : ''}`}>
                  <Icon className="w-5 h-5" strokeWidth={2} />
                </div>

                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                  <h3 className="font-display font-bold text-white text-base">{g.name}</h3>
                  <span className={`text-[9px] font-mono tracking-widest px-1.5 py-0.5 rounded-md ${
                    live
                      ? `${a.bg} ${a.text} border ${a.border}`
                      : 'bg-white/[0.05] text-white/35 border border-white/10'
                  }`}>
                    {live ? 'LIVE' : 'SOON'}
                  </span>
                </div>

                <p className="text-white/40 text-xs leading-snug">{g.tagline}</p>
              </button>
            )
          })}
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="mt-16 sm:mt-20 animate-slide-up" style={{ animationDelay: '0.16s' }}>
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.25em] text-white/35 mb-3 px-3 py-1 rounded-full border border-white/[0.07] bg-white/[0.03]">
            How it works
          </div>
          <h2 className="font-display font-bold text-2xl sm:text-3xl text-white">
            Three steps to a verdict
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {HOW_IT_WORKS.map(({ Icon, color, step, title, body }) => {
            const a = ACCENT[color]
            return (
              <div
                key={title}
                className={`relative rounded-2xl border ${a.border} bg-white/[0.025] p-5 sm:p-6 overflow-hidden`}
              >
                <div className={`absolute -top-6 -right-6 w-24 h-24 rounded-full ${a.bg} blur-2xl opacity-40 pointer-events-none`} />
                <div className="relative">
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-10 h-10 rounded-xl ${a.bg} border ${a.border} ${a.text} flex items-center justify-center`}>
                      <Icon className="w-5 h-5" strokeWidth={2.25} />
                    </div>
                    <span className={`text-[10px] font-mono uppercase tracking-[0.2em] ${a.text} opacity-60`}>
                      Step {step}
                    </span>
                  </div>
                  <h3 className="font-display font-bold text-white text-lg mb-2">{title}</h3>
                  <p className="text-white/50 text-sm leading-relaxed">{body}</p>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* ── Closing CTA band ── */}
      <section
        className="mt-16 sm:mt-20 animate-slide-up relative overflow-hidden rounded-2xl"
        style={{ animationDelay: '0.2s' }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-plasma/12 via-white/[0.02] to-transparent rounded-2xl" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-plasma/40 to-transparent" />
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-60 h-40 bg-plasma/10 blur-3xl rounded-full pointer-events-none" />

        <div className="relative border border-plasma/20 rounded-2xl p-6 sm:p-10 text-center">
          <div className="inline-flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.2em] text-plasma/50 mb-4 border border-plasma/20 rounded-full px-3 py-1 bg-plasma/5">
            <Zap className="w-3 h-3" strokeWidth={2.5} /> Ready to play
          </div>
          <h3 className="font-display font-bold text-white text-2xl sm:text-3xl mb-2">
            Ready to take the stand?
          </h3>
          <p className="text-white/50 text-sm sm:text-base max-w-md mx-auto leading-relaxed">
            Walk into a live courtroom or browse the catalog. New games ship monthly.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center mt-7 max-w-sm mx-auto">
            <button
              onClick={() => playGame(featured.id)}
              className="btn btn-crimson flex-1 py-3.5 text-sm inline-flex items-center justify-center gap-2"
            >
              <Zap className="w-4 h-4" strokeWidth={2.5} />
              Play {featured.name}
            </button>
            <button
              onClick={() => setActiveTab('games')}
              className="btn btn-ghost flex-1 py-3.5 text-sm"
            >
              See all games
            </button>
          </div>
          <p className="text-white/20 text-xs font-mono mt-7">
            Built on{' '}
            <a
              href="https://genlayer.com"
              target="_blank"
              rel="noopener"
              className="text-plasma/55 hover:text-plasma transition-colors"
            >
              GenLayer
            </a>
            {' '}· Intelligent Contracts · Optimistic Democracy
          </p>
        </div>
      </section>
    </div>
  )
}
