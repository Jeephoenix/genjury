import React from 'react'
import { Coins } from 'lucide-react'
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

  const me = players.find(p => p.id === myId)
  const symbol = getChainNativeSymbol()
  const showTimer = [PHASES.WRITING, PHASES.VOTING, PHASES.OBJECTION, PHASES.OBJECTION_VOTE].includes(phase)

  const displayPotWei = phase === PHASES.SCOREBOARD ? winnerWinningsWei : prizePoolWei
  const showPot = (displayPotWei || 0n) > 0n

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

      {/* Phase label — grows to fill available space */}
      <div className="flex-1 flex flex-col items-center min-w-0 px-1">
        <div className="badge bg-plasma/15 text-plasma border border-plasma/30 text-[10px] sm:text-xs tracking-widest truncate max-w-full">
          {PHASE_LABELS[phase] || ''}
        </div>
        {category && phase !== PHASES.SCOREBOARD && (
          <span className="text-white/30 text-[10px] font-mono mt-0.5 truncate max-w-full hidden sm:block">{category}</span>
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
