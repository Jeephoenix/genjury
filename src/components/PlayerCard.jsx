import React from 'react'
import Avatar from './Avatar'
import { Crown, Bot as BotIcon } from 'lucide-react'
import XpFlyout from './XpFlyout'

export default function PlayerCard({ player, showXP = false, xpGained = 0, isDeceiver = false, rank = null }) {
  const xpToNextLevel = 500
  const xpProgress    = ((player.xp % xpToNextLevel) / xpToNextLevel) * 100

  const rankMeta = {
    1: { color: 'text-gold',    bg: 'bg-gold/10',   border: 'border-gold/30',   icon: true },
    2: { color: 'text-white/60', bg: 'bg-white/5',  border: 'border-white/15',  icon: false },
    3: { color: 'text-signal/80', bg: 'bg-signal/8', border: 'border-signal/20', icon: false },
  }

  const rm = rankMeta[rank]

  return (
    <div
      className="card relative overflow-visible hover-highlight transition-all duration-200"
      style={{
        borderColor:  isDeceiver ? player.color + '33' : undefined,
        background:   isDeceiver ? player.color + '08' : undefined,
      }}
    >
      {/* Floating XP flyout — fires whenever xpGained changes to > 0 */}
      <XpFlyout value={xpGained} color={player.color} origin="top-1 right-2" />
      {/* Deceiver badge — top-right corner */}
      {isDeceiver && (
        <div
          className="absolute top-0 right-0 text-[10px] font-mono uppercase tracking-[0.15em] px-2.5 py-1.5 rounded-bl-xl rounded-tr-2xl"
          style={{
            background: player.color + '22',
            color:      player.color,
            border:     `0 0 0 1px ${player.color}33`,
          }}
        >
          DECEIVER
        </div>
      )}

      <div className="flex items-center gap-3">
        {/* Rank badge */}
        {rank && (
          <div className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ${rm?.bg || 'bg-white/5'} border ${rm?.border || 'border-white/10'}`}>
            {rank === 1 ? (
              <Crown className="w-4.5 h-4.5 text-gold" strokeWidth={2} />
            ) : (
              <span className={`font-display font-bold text-base ${rm?.color || 'text-white/25'}`}>
                {rank}
              </span>
            )}
          </div>
        )}

        <Avatar
          name={player.name}
          src={player.avatar && String(player.avatar).startsWith('data:') ? player.avatar : ''}
          color={player.color}
          size={40}
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-display font-semibold text-white text-sm truncate">
              {player.name}
            </span>
            {player.isBot && (
              <span className="badge bg-white/[0.04] text-white/25 border border-white/10 text-[9px] font-mono inline-flex items-center gap-1">
                <BotIcon className="w-2.5 h-2.5" strokeWidth={2.5} /> BOT
              </span>
            )}
            {player.isHost && (
              <span
                className="badge text-[9px]"
                style={{
                  background: player.color + '1a',
                  color:      player.color,
                  border:     `1px solid ${player.color}33`,
                }}
              >
                HOST
              </span>
            )}
          </div>

          {showXP && (
            <div className="mt-1.5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-white/35 text-[10px] font-mono">Lv.{player.level}</span>
                <span className="text-white/45 text-[10px] font-mono">{player.xp} XP</span>
              </div>
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{
                    width:      `${xpProgress}%`,
                    background: player.color,
                    boxShadow:  `0 0 8px ${player.color}55`,
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* XP gained badge */}
        {xpGained > 0 && (
          <div className="flex-shrink-0 text-right animate-bounce-in">
            <span className="font-display font-bold text-sm text-gold text-glow-gold">
              +{xpGained}
            </span>
            <div className="text-gold/50 text-[10px] font-mono">XP</div>
          </div>
        )}
      </div>
    </div>
  )
}
