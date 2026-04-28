import React from 'react'

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
  const letters = ['A', 'B', 'C']
  const votePercent = totalVotes > 0 ? Math.round(voteCount / totalVotes * 100) : 0

  const getBorderColor = () => {
    if (revealed) {
      if (isLie) return '#ff6b35'
      return 'rgba(255,255,255,0.07)'
    }
    if (selected) return '#a259ff'
    return 'rgba(255,255,255,0.07)'
  }

  const getBg = () => {
    if (revealed && isLie) return 'rgba(255,107,53,0.08)'
    if (selected) return 'rgba(162,89,255,0.08)'
    return 'rgba(12,12,20,0.8)'
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`statement-card w-full text-left rounded-2xl p-5 transition-all cursor-pointer relative overflow-hidden ${disabled && !revealed ? 'cursor-default' : ''}`}
      style={{
        background: getBg(),
        border: `1px solid ${getBorderColor()}`,
        boxShadow: revealed && isLie ? '0 0 20px rgba(255,107,53,0.2)' : selected ? '0 0 20px rgba(162,89,255,0.15)' : 'none',
      }}
    >
      {/* Vote bar fill */}
      {revealed && (
        <div
          className="absolute inset-0 opacity-10 transition-all duration-700"
          style={{
            width: `${votePercent}%`,
            background: isLie ? '#ff6b35' : '#7fff6e',
          }}
        />
      )}

      <div className="relative flex items-start gap-4">
        {/* Letter badge */}
        <div
          className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center font-display font-700 text-sm transition-all`}
          style={{
            background: revealed && isLie ? '#ff6b35' : selected ? '#a259ff' : 'rgba(255,255,255,0.07)',
            color: revealed && isLie ? '#fff' : selected ? '#fff' : 'rgba(255,255,255,0.5)',
          }}
        >
          {letters[index]}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-white/90 text-sm leading-relaxed">{text || <span className="text-white/20 italic">Statement {letters[index]}</span>}</p>

          {revealed && (
            <div className="mt-3 flex items-center flex-wrap gap-2">
              {isLie && (
                <span className="badge bg-signal/20 text-signal border border-signal/30">
                  🎭 THE LIE
                </span>
              )}
              {aiPicked && (
                <span className="badge bg-plasma/20 text-plasma border border-plasma/30">
                  🤖 AI PICKED
                </span>
              )}
              {playerVoted && (
                <span className="badge bg-ice/20 text-ice border border-ice/30">
                  👁️ YOU VOTED
                </span>
              )}
              <span className="badge bg-white/5 text-white/40 border border-white/10 font-mono">
                {voteCount} vote{voteCount !== 1 ? 's' : ''} · {votePercent}%
              </span>
            </div>
          )}
        </div>

        {selected && !revealed && (
          <div className="flex-shrink-0 w-5 h-5 rounded-full bg-plasma flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-white" />
          </div>
        )}
      </div>
    </button>
  )
}
