import React, { useState } from 'react'
import { Coins, Plus, X } from 'lucide-react'
import useGameStore, { PHASES } from '../lib/store'
import TimerRing from './TimerRing'
import { formatGen, getChainNativeSymbol } from '../lib/genlayer'

const PHASE_LABELS = {
  [PHASES.WRITING]: 'DECEIVER IS WRITING',
  [PHASES.VOTING]: 'DETECTORS VOTE',
  [PHASES.AI_JUDGING]: 'AI JUDGE DELIBERATING',
  [PHASES.OBJECTION]: 'RAISE OBJECTION?',
  [PHASES.OBJECTION_VOTE]: 'OBJECTION VOTE',
  [PHASES.REVEAL]: 'THE VERDICT',
  [PHASES.SCOREBOARD]: 'FINAL SCORES',
}

// Ordered pipeline shown in the phase stepper
const PHASE_STEPS = [
  { phase: PHASES.WRITING,        label: 'Write' },
  { phase: PHASES.VOTING,         label: 'Vote' },
  { phase: PHASES.AI_JUDGING,     label: 'Judge' },
  { phase: PHASES.OBJECTION,      label: 'Object' },
  { phase: PHASES.REVEAL,         label: 'Reveal' },
  { phase: PHASES.SCOREBOARD,     label: 'Score' },
]

function PhaseStepperBar({ phase }) {
  const currentIdx = PHASE_STEPS.findIndex(s => s.phase === phase)
  // Objection vote is same visual step as Objection
  const effectiveIdx = phase === PHASES.OBJECTION_VOTE ? 3 : currentIdx
  return (
    <div className="hidden sm:flex items-center gap-0.5">
      {PHASE_STEPS.map((step, i) => {
        const done    = i < effectiveIdx
        const active  = i === effectiveIdx
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

  const me = players.find(p => p.id === myId)
  const symbol = getChainNativeSymbol()
  const showTimer = [PHASES.WRITING, PHASES.VOTING, PHASES.OBJECTION, PHASES.OBJECTION_VOTE].includes(phase)

  const displayPotWei = phase === PHASES.SCOREBOARD ? winnerWinningsWei : prizePoolWei
  const showPot = (displayPotWei || 0n) > 0n

  const handleLeaveAndCreate = () => {
    if (!confirmLeave) {
      setConfirmLeave(true)
      setTimeout(() => setConfirmLeave(false), 3000)
      return
    }
    resetGame()
    setActiveTab('mistrial')
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-14 sm:h-16 glass border-b border-ghost-border flex items-center px-3 sm:px-4 gap-2 sm:gap-4 overflow-hidden">
      {/* Logo — always visible */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <img src="/logo.png" alt="" className="w-6 h-6 sm:w-7 sm:h-7 object-contain" />
        <span className="font-display font-800 text-base sm:text-lg text-white tracking-tight">
          Gen<span className="text-neon text-glow-neon">jury</span>
        </span>
      </div>

      {/* Room code — desktop only */}
      <div className="flex-shrink-0 hidden md:block">
        <span className="badge bg-ghost border border-ghost-border text-white/50 font-mono text-xs" title={roomCode}>
          {roomCode}
        </span>
      </div>

      {/* Prize pool — large screens only */}
      {showPot && (
        <div className="flex-shrink-0 hidden lg:flex items-center gap-1.5 badge bg-gold/10 border border-gold/30 text-gold font-mono text-xs">
          <Coins className="w-3.5 h-3.5" />
          <span>{formatGen(displayPotWei, 4)} {symbol}</span>
        </div>
      )}

      {/* Prize pool — compact on sm screens */}
      {showPot && (
        <div className="flex-shrink-0 hidden sm:flex lg:hidden items-center gap-1 badge bg-gold/10 border border-gold/30 text-gold font-mono text-[11px]">
          <Coins className="w-3 h-3" />
          <span>{formatGen(displayPotWei, 3)}</span>
        </div>
      )}

      {/* Phase label + stepper — grows to fill available space */}
      <div className="flex-1 flex flex-col items-center min-w-0 px-1 gap-1">
        <div className="badge bg-plasma/15 text-plasma border border-plasma/30 text-[10px] sm:text-xs tracking-widest truncate max-w-full">
          {PHASE_LABELS[phase] || ''}
        </div>
        <PhaseStepperBar phase={phase} />
        {category && phase !== PHASES.SCOREBOARD && (
          <span className="text-white/30 text-[10px] font-mono truncate max-w-full hidden lg:block">{category}</span>
        )}
      </div>

      {/* Round indicator — dots hidden on mobile, text always visible */}
      <div className="flex-shrink-0 flex items-center gap-1">
        {Array.from({ length: maxRounds }).map((_, i) => (
          <div
            key={i}
            className={`hidden sm:block w-2 h-2 rounded-full transition-all duration-300 ${
              i < round - 1 ? 'bg-neon' : i === round - 1 ? 'bg-plasma animate-pulse' : 'bg-white/15'
            }`}
          />
        ))}
        <span className="text-white/40 text-xs sm:ml-1 font-mono">{round}/{maxRounds}</span>
      </div>

      {/* Timer */}
      {showTimer && (
        <div className="flex-shrink-0">
          <TimerRing seconds={timer} max={timerMax} size={32} />
        </div>
      )}

      {/* New case button — lets users leave and open/join another game */}
      <button
        onClick={handleLeaveAndCreate}
        title={confirmLeave ? 'Click again to confirm — you will leave this game' : 'Open or join a new case'}
        className={`flex-shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-xs font-mono transition-all ${
          confirmLeave
            ? 'border-signal/60 bg-signal/15 text-signal animate-pulse'
            : 'border-neon/30 bg-neon/10 text-neon hover:bg-neon/20'
        }`}
      >
        {confirmLeave
          ? <><X className="w-3 h-3" />Leave?</>
          : <><Plus className="w-3 h-3" /><span className="hidden sm:inline">New case</span></>
        }
      </button>

      {/* My avatar + XP */}
      {me && (
        <div className="flex-shrink-0 flex items-center gap-2">
          <div className="avatar w-7 h-7 sm:w-8 sm:h-8 text-xs sm:text-sm" style={{ background: me.color + '22', color: me.color }}>
            {me.avatar}
          </div>
          <div className="text-right hidden sm:block">
            <div className="text-xs font-mono text-white/60">{me.xp} XP</div>
            <div className="text-xs text-white/30">Lv.{me.level}</div>
          </div>
        </div>
      )}
    </header>
  )
}
