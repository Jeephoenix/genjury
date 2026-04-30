import React from 'react'
import Avatar from './Avatar'

export default function PlayerCard({ player, showXP = false, xpGained = 0, isDeceiver = false, rank = null }) {
  const xpToNextLevel = 500
  const xpProgress = (player.xp % xpToNextLevel) / xpToNextLevel * 100

  return (
    <div className="card flex items-center gap-3 relative overflow-hidden"
      style={{ borderColor: isDeceiver ? player.color + '44' : undefined }}>
      {isDeceiver && (
        <div className="absolute top-0 right-0">
          <span className="badge bg-signal/20 text-signal border border-signal/30 rounded-none rounded-bl-lg text-xs">
            DECEIVER
          </span>
        </div>
      )}

      {rank && (
        <div className="flex-shrink-0 w-8 text-center">
          <span className={`font-display font-800 text-lg ${rank === 1 ? 'text-gold' : rank === 2 ? 'text-white/60' : rank === 3 ? 'text-signal/80' : 'text-white/30'}`}>
            #{rank}
          </span>
        </div>
      )}

      <Avatar
        name={player.name}
        src={player.avatar && String(player.avatar).startsWith('data:') ? player.avatar : ''}
        color={player.color}
        size={40}
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-display font-600 text-white text-sm truncate">{player.name}</span>
          {player.isBot && <span className="badge bg-white/5 text-white/30 border border-white/10 text-xs">BOT</span>}
          {player.isHost && <span className="badge text-xs" style={{ background: player.color + '22', color: player.color, border: `1px solid ${player.color}44` }}>HOST</span>}
        </div>

        {showXP && (
          <div className="mt-1.5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-white/40 text-xs font-mono">Lv.{player.level}</span>
              <span className="text-white/50 text-xs font-mono">{player.xp} XP</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${xpProgress}%`, background: player.color }} />
            </div>
          </div>
        )}
      </div>

      {xpGained > 0 && (
        <div className="flex-shrink-0 text-right">
          <span className="text-gold font-display font-700 text-sm animate-bounce-in">
            +{xpGained}
          </span>
          <div className="text-gold/60 text-xs">XP</div>
        </div>
      )}
    </div>
  )
}
