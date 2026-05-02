import React, { useState } from 'react'
import { Coins, Plus, X } from 'lucide-react'
import useGameStore, { PHASES } from '../lib/store'
import TimerRing from './TimerRing'
import { formatGen, getChainNativeSymbol } from '../lib/genlayer'

const PHASE_LABELS = {
  [PHASES.WRITING]:        'Deceiver writing',
  [PHASES.VOTING]:         'Detectors vote',
  [PHASES.AI_JUDGING]:     'AI deliberating',
  [PHASES.OBJECTION]:      'Raise objection?',
  [PHASES.OBJECTION_VOTE]: 'Objection vote',
  [PHASES.REVEAL]:         'The verdict',
  [PHASES.SCOREBOARD]:     'Final scores',
}

const PHASE_STEPS = [
  { phase: PHASES.WRITING,    label: 'Write'  },
  { phase: PHASES.VOTING,     label: 'Vote'   },
  { phase: PHASES.AI_JUDGING, label: 'Judge'  },
  { phase: PHASES.OBJECTION,  label: 'Object' },
  { phase: PHASES.REVEAL,     label: 'Reveal' },
  { phase: PHASES.SCOREBOARD, label: 'Score'  },
]

function PhaseStepperBar({ phase }) {
  const currentIdx   = PHASE_STEPS.findIndex(s => s.phase === phase)
  const effectiveIdx = phase === PHASES.OBJECTION_VOTE ? 3 : currentIdx
  return (
    <div className="flex items-center gap-0.5">
      {PHASE_STEPS.map((step, i) => {
        const done   = i < effectiveIdx
        const active = i === effectiveIdx
        return (
          <React.Fragment key={step.phase}>
            <div
              className={`relative flex items-center justify-center rounded-full text-[9px] font-mono tracking-widest transition-all duration-300 ${
                active
                  ? 'w-14 h-5 bg-plasma/30 border border-plasma/60 text-plasma'
                  : done
                  ? 'w-4 h-4 bg-neon/20 border border-neon/40 text-neon/70'
                  : 'w-4 h-4 bg-white/5 border border-white/10 text-white/20'
              }`}
            >
              {active ? step.label : done ? '✓' : ''}
            </div>
            {i < PHASE_STEPS.length - 1 && (
              <div className={`w-3 h-px transition-colors duration-300 ${done ? 'bg-neon/40' : 'bg-white/10'}`} />
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}

export default function GameHeader() {
  const phase             = useGameStore(s => s.phase)
  const round             = useGameStore(s => s.round)
  const maxRounds         = useGameStore(s => s.maxRounds)
  const players           = useGameStore(s => s.players)
  const myId              = useGameStore(s => s.myId)
  const timer             = useGameStore(s => s.timer)
  const timerMax          = useGameStore(s => s.timerMax)
  const category          = useGameStore(s => s.category)
  const roomCode          = useGameStore(s => s.roomCode)
  const prizePoolWei      = useGameStore(s => s.prizePoolWei)
  const winnerWinningsWei = useGameStore(s => s.winnerWinningsWei)
  const resetGame         = useGameStore(s => s.resetGame)
  const setActiveTab      = useGameStore(s => s.setActiveTab)

  const [confirmLeave, setConfirmLeave] = useState(false)

  const me        = players.find(p => p.id === myId)
  const symbol    = getChainNativeSymbol()
  const showTimer = [PHASES.WRITING, PHASES.VOTING, PHASES.OBJECTION, PHASES.OBJECTION_VOTE].includes(phase)

  const displayPotWei = phase === PHASES.SCOREBOARD ? winnerWinningsWei : prizePoolWei
  const showPot       = (displayPotWei || 0n) > 0n

  const handleLeaveAndCreate = () => {
    if (!confirmLeave) {
      setConfirmLeave(true)
      setTimeout(() => setConfirmLeave(false), 3000)
      return
    }
    resetGame()
    setActiveTab('mistrial')
  }

  /*
    NOTE on the `.badge` override:
    globals.css defines `.badge { display: inline-flex }` AFTER @tailwind utilities,
    which means Tailwind's `hidden` (display:none) is overridden by the cascade.
    Fix: never put `hidden` on an element that also uses `.badge`.
    Instead, wrap badges in a plain <div> that carries the visibility class.
  */

  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass border-b border-white/[0.07]">

      {/* ══════════════════════════════════════════════
          ROW 1 — always visible
          Mobile : Logo · Phase badge · Timer
          Desktop: Logo · Room · Prize · Phase+stepper · Round · Timer · Leave · Avatar
         ══════════════════════════════════════════════ */}
      <div className="flex items-center h-12 md:h-16 px-3 md:px-4 gap-2 md:gap-3 overflow-hidden">

        {/* Logo */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <img src="/logo.png" alt="" className="w-6 h-6 object-contain" />
          <span className="font-display font-extrabold text-base text-white tracking-tight">
            Gen<span className="text-neon text-glow-neon">jury</span>
          </span>
        </div>

        {/*
          Room code — desktop only.
          Plain div carries `hidden md:block` safely (not a .badge element).
        */}
        <div className="hidden md:block flex-shrink-0">
          <span className="badge bg-white/[0.04] border border-white/[0.08] text-white/50 font-mono text-xs">
            {roomCode}
          </span>
        </div>

        {/*
          Prize pool — desktop only.
          Wrapper div carries the visibility class; inner span carries .badge styles.
          This avoids the .badge display:inline-flex overriding Tailwind's `hidden`.
        */}
        {showPot && (
          <div className="hidden md:flex flex-shrink-0 items-center gap-1.5 badge bg-gold/10 border border-gold/30 text-gold font-mono text-xs">
            <Coins className="w-3.5 h-3.5" />
            <span>{formatGen(displayPotWei, 3)} {symbol}</span>
          </div>
        )}

        {/* Phase label + stepper — fills remaining space */}
        <div className="flex-1 flex flex-col items-center min-w-0 gap-0.5 overflow-hidden">
          {/* Phase badge — NOT hidden on any breakpoint, just text changes */}
          <div className="badge bg-plasma/15 text-plasma border border-plasma/30 text-[10px] tracking-widest max-w-full" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {PHASE_LABELS[phase] || ''}
          </div>
          {/* Phase stepper — desktop only, wrapped in plain div for safe hiding */}
          <div className="hidden md:flex">
            <PhaseStepperBar phase={phase} />
          </div>
          {/* Category — large screens only */}
          {category && phase !== PHASES.SCOREBOARD && (
            <span className="hidden lg:block text-white/30 text-[10px] font-mono truncate max-w-full">
              {category}
            </span>
          )}
        </div>

        {/* Round counter — desktop only (plain div, safe to hide) */}
        <div className="hidden md:flex flex-shrink-0 items-center gap-1">
          {Array.from({ length: maxRounds }).map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                i < round - 1 ? 'bg-neon' : i === round - 1 ? 'bg-plasma animate-pulse' : 'bg-white/15'
              }`}
            />
          ))}
          <span className="text-white/40 text-xs ml-1 font-mono">{round}/{maxRounds}</span>
        </div>

        {/* Timer — always visible */}
        {showTimer && (
          <div className="flex-shrink-0">
            <TimerRing seconds={timer} max={timerMax} size={32} />
          </div>
        )}

        {/* New case button — desktop only (plain button, safe to hide) */}
        <button
          onClick={handleLeaveAndCreate}
          title={confirmLeave ? 'Click again — you will leave this game' : 'Open or join a new case'}
          className={`hidden md:inline-flex flex-shrink-0 items-center gap-1 px-2 py-1 rounded-lg border text-xs font-mono transition-all ${
            confirmLeave
              ? 'border-signal/60 bg-signal/15 text-signal animate-pulse'
              : 'border-neon/30 bg-neon/10 text-neon hover:bg-neon/20'
          }`}
        >
          {confirmLeave
            ? <><X className="w-3 h-3" />Leave?</>
            : <><Plus className="w-3 h-3" />New case</>
          }
        </button>

        {/* Avatar + XP — desktop only */}
        {me && (
          <div className="hidden md:flex flex-shrink-0 items-center gap-2">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold"
              style={{ background: me.color + '22', color: me.color, border: `1px solid ${me.color}44` }}
            >
              {me.avatar}
            </div>
            <div className="text-right hidden lg:block">
              <div className="text-xs font-mono text-white/60">{me.xp} XP</div>
              <div className="text-xs text-white/30">Lv.{me.level}</div>
            </div>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════
          ROW 2 — mobile only (hidden on md+)
          Prize pool · Round · Spacer · Avatar · Leave
          This is a plain <div>, so `md:hidden` works perfectly.
         ══════════════════════════════════════════════ */}
      <div className="md:hidden flex items-center h-8 px-3 gap-2 border-t border-white/[0.05] overflow-hidden">

        {/* Prize pool — only in this row, never duplicated in Row 1 on mobile */}
        {showPot && (
          <div className="flex items-center gap-1 badge bg-gold/10 border border-gold/25 text-gold font-mono text-[10px] flex-shrink-0">
            <Coins className="w-3 h-3" />
            <span>{formatGen(displayPotWei, 2)} {symbol}</span>
          </div>
        )}

        {/* Round dots + counter */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {Array.from({ length: maxRounds }).map((_, i) => (
            <div
              key={i}
              className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                i < round - 1 ? 'bg-neon' : i === round - 1 ? 'bg-plasma animate-pulse' : 'bg-white/15'
              }`}
            />
          ))}
          <span className="text-white/40 text-[10px] ml-1 font-mono">{round}/{maxRounds}</span>
        </div>

        <div className="flex-1" />

        {/* Avatar */}
        {me && (
          <div
            className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
            style={{ background: me.color + '22', color: me.color, border: `1px solid ${me.color}44` }}
          >
            {me.avatar}
          </div>
        )}

        {/* Leave / New case */}
        <button
          onClick={handleLeaveAndCreate}
          title={confirmLeave ? 'Click again to confirm leaving' : 'Leave and open a new case'}
          className={`flex-shrink-0 inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md border text-[10px] font-mono transition-all ${
            confirmLeave
              ? 'border-signal/60 bg-signal/15 text-signal animate-pulse'
              : 'border-neon/25 bg-neon/8 text-neon'
          }`}
        >
          {confirmLeave
            ? <><X className="w-2.5 h-2.5" />Leave?</>
            : <><Plus className="w-2.5 h-2.5" />New case</>
          }
        </button>
      </div>
    </header>
  )
}
