import React, { useState, useEffect } from 'react'
import useGameStore from '../lib/store'
import StatementCard from '../components/StatementCard'

export default function VotingPhase() {
  const players = useGameStore(s => s.players)
  const myId = useGameStore(s => s.myId)
  const deceiverIndex = useGameStore(s => s.deceiverIndex)
  const statements = useGameStore(s => s.statements)
  const votes = useGameStore(s => s.votes)
  const castVote = useGameStore(s => s.castVote)
  const proceedToAIJudge = useGameStore(s => s.proceedToAIJudge)
  const timer = useGameStore(s => s.timer)

  const [myVote, setMyVote] = useState(null)
  const [myConfidence, setMyConfidence] = useState(0.6)
  const [submitted, setSubmitted] = useState(false)

  const deceiver = players[deceiverIndex]
  const isDeceiver = deceiver?.id === myId
  const voterCount = Object.keys(votes).length
  const detectorCount = players.filter(p => p.id !== deceiver?.id).length

  // Auto-proceed when timer runs out or all voted
  useEffect(() => {
    if (timer === 0 || voterCount >= detectorCount) {
      const timeout = setTimeout(() => proceedToAIJudge(), 1500)
      return () => clearTimeout(timeout)
    }
  }, [timer, voterCount, detectorCount])

  const handleSubmit = () => {
    if (myVote === null) return
    castVote(myId, myVote, myConfidence)
    setSubmitted(true)
  }

  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-8 gap-6 animate-slide-up">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-6">
          <h2 className="font-display text-2xl font-700 text-white mb-2">
            Which statement is the lie?
          </h2>
          <div className="flex items-center justify-center gap-2">
            <div className="avatar w-8 h-8 text-sm" style={{ background: deceiver?.color + '22', color: deceiver?.color }}>
              {deceiver?.avatar}
            </div>
            <p className="text-white/50 text-sm">
              <span style={{ color: deceiver?.color }}>{deceiver?.name}</span> wrote these. Spot the lie.
            </p>
          </div>
        </div>

        {/* Statements */}
        <div className="space-y-3 mb-6">
          {statements.map((text, i) => (
            <StatementCard
              key={i}
              index={i}
              text={text}
              selected={myVote === i}
              onClick={() => !submitted && !isDeceiver ? setMyVote(i) : null}
              disabled={submitted || isDeceiver}
            />
          ))}
        </div>

        {/* Confidence slider */}
        {!isDeceiver && !submitted && myVote !== null && (
          <div className="card mb-4 animate-slide-up">
            <div className="flex items-center justify-between mb-3">
              <span className="text-white/60 text-sm">Confidence</span>
              <span className="text-plasma font-mono font-600 text-sm">
                {Math.round(myConfidence * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="10" max="100"
              value={Math.round(myConfidence * 100)}
              onChange={e => setMyConfidence(e.target.value / 100)}
              className="w-full accent-plasma"
            />
            <div className="flex justify-between text-xs text-white/20 mt-1">
              <span>Uncertain</span>
              <span>Very sure</span>
            </div>
            <p className="text-white/30 text-xs mt-2">
              Higher confidence = more XP if correct, but you lose more credibility if wrong
            </p>
          </div>
        )}

        {/* Submit / Status */}
        {isDeceiver ? (
          <div className="card text-center bg-signal/5 border-signal/20">
            <p className="text-signal text-sm">🎭 You're the Deceiver — sit back and watch them squirm</p>
          </div>
        ) : submitted ? (
          <div className="card text-center bg-neon/5 border-neon/20">
            <p className="text-neon text-sm mb-1">✓ Vote submitted at {Math.round(myConfidence * 100)}% confidence</p>
            <p className="text-white/30 text-xs">Waiting for other players…</p>
          </div>
        ) : (
          <button
            className="btn btn-plasma w-full py-4 text-base"
            disabled={myVote === null}
            onClick={handleSubmit}
          >
            👁️ Lock in My Vote
          </button>
        )}

        {/* Vote progress */}
        <div className="mt-4 card bg-white/[0.03] border-white/[0.05]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-white/30 text-xs font-mono">Votes cast</span>
            <span className="text-white/50 text-xs font-mono">{voterCount}/{detectorCount}</span>
          </div>
          <div className="progress-bar">
            <div
              className="progress-fill bg-plasma"
              style={{ width: detectorCount > 0 ? `${voterCount / detectorCount * 100}%` : '0%' }}
            />
          </div>
          <div className="flex gap-2 mt-3 flex-wrap">
            {players.filter(p => p.id !== deceiver?.id).map(p => (
              <div
                key={p.id}
                className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs transition-all"
                style={{
                  background: votes[p.id] !== undefined ? p.color + '22' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${votes[p.id] !== undefined ? p.color + '44' : 'rgba(255,255,255,0.06)'}`,
                }}
              >
                <span>{p.avatar}</span>
                <span style={{ color: votes[p.id] !== undefined ? p.color : 'rgba(255,255,255,0.3)' }}>
                  {p.name}
                </span>
                {votes[p.id] !== undefined && <span>✓</span>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
