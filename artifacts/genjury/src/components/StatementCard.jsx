import React from 'react'
import { Drama, Bot, Eye, Check } from 'lucide-react'

export default function StatementCard({
  index,
  text,
  selected,
  onClick,
  disabled,
  revealed,
  isLie,
  voteCount = 0,
  totalVotes = 0,
  aiPicked,
  playerVoted,
}) {
  const letters     = ['A', 'B', 'C']
  const votePercent = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0

  const borderColor = () => {
    if (revealed && isLie) return '#c05b30'
    if (revealed)          return selected ? 'rgba(127,255,110,0.3)' : 'rgba(255,255,255,0.07)'
    if (selected)          return '#a259ff'
    return 'rgba(255,255,255,0.07)'
  }

  const bgColor = () => {
    if (revealed && isLie) return 'rgba(192,91,48,0.06)'
    if (selected)          return 'rgba(162,89,255,0.07)'
    return 'rgba(12,12,20,0.9)'
  }

  const boxShadow = () => {
    if (revealed && isLie) return '0 0 22px rgba(192,91,48,0.14), 0 0 0 1px rgba(192,91,48,0.20)'
    if (selected)          return '0 0 28px rgba(162,89,255,0.2), 0 0 0 1px rgba(162,89,255,0.35)'
    return 'none'
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`statement-card w-full text-left rounded-2xl p-5 relative overflow-hidden ${
        disabled && !revealed ? 'cursor-default' : 'cursor-pointer'
      } ${selected && !revealed ? 'scale-[1.015]' : ''}`}
      style={{
        background:  bgColor(),
        border:      `1px solid ${borderColor()}`,
        boxShadow:   boxShadow(),
        transition:  'all 0.22s cubic-bezier(0.16,1,0.3,1)',
      }}
    >
      {/* Vote bar background fill */}
      {revealed && votePercent > 0 && (
        <div
          className="absolute inset-y-0 left-0 opacity-[0.07] transition-all duration-700"
          style={{
            width:      `${votePercent}%`,
            background: isLie ? '#c05b30' : '#7fff6e',
          }}
        />
      )}

      {/* Hover shimmer on non-disabled */}
      {!disabled && !revealed && !selected && (
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.02] to-transparent opacity-0 hover:opacity-100 transition-opacity duration-200 pointer-events-none" />
      )}

      <div className="relative flex items-start gap-4">
        {/* Letter badge */}
        <div
          className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center font-display font-bold text-sm transition-all duration-200"
          style={{
            background: revealed && isLie
              ? '#c05b30'
              : selected
              ? '#a259ff'
              : 'rgba(255,255,255,0.07)',
            color: (revealed && isLie) || selected ? '#fff' : 'rgba(255,255,255,0.45)',
            boxShadow: revealed && isLie
              ? '0 0 10px rgba(192,91,48,0.28)'
              : selected
              ? '0 0 14px rgba(162,89,255,0.4)'
              : 'none',
          }}
        >
          {letters[index]}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-white/85 text-sm leading-relaxed">
            {text || <span className="text-white/20 italic">Statement {letters[index]}</span>}
          </p>

          {revealed && (
            <div className="mt-3 flex items-center flex-wrap gap-2">
              {isLie && (
                <span className="badge bg-signal/15 text-signal border border-signal/30 inline-flex items-center gap-1 font-semibold">
                  <Drama className="w-3 h-3" /> THE LIE
                </span>
              )}
              {aiPicked && (
                <span className="badge bg-plasma/15 text-plasma border border-plasma/30 inline-flex items-center gap-1">
                  <Bot className="w-3 h-3" /> AI PICKED
                </span>
              )}
              {playerVoted && (
                <span className="badge bg-ice/15 text-ice border border-ice/30 inline-flex items-center gap-1">
                  <Eye className="w-3 h-3" /> YOU VOTED
                </span>
              )}
              <span className="badge bg-white/[0.05] text-white/35 border border-white/10 font-mono">
                {voteCount} vote{voteCount !== 1 ? 's' : ''} · {votePercent}%
              </span>
            </div>
          )}
        </div>

        {/* Selection check */}
        {selected && !revealed && (
          <div className="flex-shrink-0 w-5 h-5 rounded-full bg-plasma flex items-center justify-center shadow-[0_0_10px_rgba(162,89,255,0.5)]">
            <Check className="w-3 h-3 text-white" strokeWidth={3} />
          </div>
        )}
      </div>
    </button>
  )
}
