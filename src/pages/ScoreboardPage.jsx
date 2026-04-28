import React from 'react'
import useGameStore from '../lib/store'

const RANK_ICONS = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣']
const RANK_LABELS = ['Champion', 'Runner-Up', 'Third Place', '4th Place', '5th Place']

export default function ScoreboardPage() {
  const players = useGameStore(s => s.players)
  const myId = useGameStore(s => s.myId)
  const scoreHistory = useGameStore(s => s.scoreHistory)
  const resetGame = useGameStore(s => s.resetGame)

  const sorted = [...players].sort((a, b) => b.xp - a.xp)
  const winner = sorted[0]
  const me = players.find(p => p.id === myId)
  const myRank = sorted.findIndex(p => p.id === myId) + 1

  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-16 gap-8 animate-slide-up">
      <div className="w-full max-w-lg">
        {/* Winner */}
        <div className="text-center mb-10">
          <div className="relative inline-block mb-4">
            <div className="avatar w-24 h-24 text-4xl mx-auto" style={{ background: winner.color + '22', color: winner.color }}>
              {winner.avatar}
            </div>
            <div className="absolute -top-3 -right-3 text-3xl">👑</div>
            <div className="absolute inset-0 rounded-full blur-2xl opacity-30" style={{ background: winner.color }} />
          </div>
          <h2 className="font-display text-4xl font-800 text-white mb-1">
            <span style={{ color: winner.color }}>{winner.name}</span> wins!
          </h2>
          <p className="text-white/40 text-sm">{winner.xp} XP · Level {winner.level}</p>
          <div className="badge bg-gold/20 text-gold border border-gold/30 mt-3 mx-auto text-sm">
            🏆 Genjury Champion
          </div>
        </div>

        {/* Leaderboard */}
        <div className="space-y-3 mb-8">
          {sorted.map((p, i) => (
            <div
              key={p.id}
              className={`relative overflow-hidden rounded-2xl p-4 flex items-center gap-4 animate-slide-up transition-all ${p.id === myId ? 'ring-1' : ''}`}
              style={{
                background: i === 0 ? `linear-gradient(135deg, ${p.color}18, rgba(12,12,20,0.9))` : 'rgba(12,12,20,0.8)',
                border: `1px solid ${i === 0 ? p.color + '44' : 'rgba(255,255,255,0.07)'}`,
                ringColor: p.color,
                animationDelay: `${i * 0.08}s`,
              }}
            >
              {/* Rank */}
              <div className="text-2xl flex-shrink-0 w-8 text-center">{RANK_ICONS[i]}</div>

              {/* Avatar */}
              <div className="avatar" style={{ background: p.color + '22', color: p.color }}>
                {p.avatar}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-display font-700 text-white">{p.name}</span>
                  {p.id === myId && <span className="badge bg-plasma/20 text-plasma border border-plasma/30 text-xs">YOU</span>}
                </div>
                <div className="text-white/30 text-xs font-mono mt-0.5">{RANK_LABELS[i]}</div>

                {/* XP bar */}
                <div className="mt-2 progress-bar">
                  <div
                    className="progress-fill transition-all duration-1000"
                    style={{ width: `${(p.xp / (sorted[0]?.xp || 1)) * 100}%`, background: p.color }}
                  />
                </div>
              </div>

              {/* XP */}
              <div className="text-right flex-shrink-0">
                <div className="font-display font-800 text-xl" style={{ color: p.color }}>{p.xp}</div>
                <div className="text-white/30 text-xs font-mono">XP</div>
                <div className="text-white/20 text-xs">Lv.{p.level}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Round breakdown */}
        {scoreHistory.length > 0 && (
          <div className="card mb-8">
            <h3 className="font-display font-700 text-white mb-4">Round Breakdown</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="text-white/30 text-xs font-mono pb-2 text-left">Player</th>
                    {scoreHistory.map((_, i) => (
                      <th key={i} className="text-white/30 text-xs font-mono pb-2 text-center">R{i + 1}</th>
                    ))}
                    <th className="text-white/30 text-xs font-mono pb-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map(p => (
                    <tr key={p.id} className="border-b border-white/[0.04]">
                      <td className="py-2 pr-3">
                        <div className="flex items-center gap-2">
                          <span style={{ color: p.color }}>{p.avatar}</span>
                          <span className="text-white/70 text-xs">{p.name}</span>
                        </div>
                      </td>
                      {scoreHistory.map((rnd, i) => (
                        <td key={i} className="py-2 text-center">
                          <span className={`text-xs font-mono ${(rnd.xpGained[p.id] || 0) > 0 ? 'text-gold' : 'text-white/20'}`}>
                            {(rnd.xpGained[p.id] || 0) > 0 ? `+${rnd.xpGained[p.id]}` : '—'}
                          </span>
                        </td>
                      ))}
                      <td className="py-2 text-right font-display font-700" style={{ color: p.color }}>{p.xp}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Personal result */}
        {me && (
          <div className="card text-center mb-6" style={{ borderColor: me.color + '33', background: me.color + '08' }}>
            <p className="text-white/50 text-sm">Your result</p>
            <p className="font-display text-2xl font-700 mt-1" style={{ color: me.color }}>
              {RANK_ICONS[myRank - 1]} {RANK_LABELS[myRank - 1]}
            </p>
            <p className="text-white/30 text-xs mt-1">{me.xp} XP · Level {me.level}</p>
          </div>
        )}

        {/* Actions */}
        <div className="grid grid-cols-2 gap-4">
          <button className="btn btn-ghost py-4" onClick={resetGame}>
            🏠 Main Menu
          </button>
          <button
            className="btn btn-neon py-4"
            onClick={() => {
              useGameStore.getState().startGame()
            }}
          >
            🔄 Play Again
          </button>
        </div>

        <div className="text-center mt-8 text-white/15 text-xs font-mono">
          Genjury · Built on GenLayer · Intelligent Contracts + Optimistic Democracy
        </div>
      </div>
    </div>
  )
}
