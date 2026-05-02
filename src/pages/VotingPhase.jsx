import React, { useState, useEffect } from 'react'
import { Eye, Check, Drama } from 'lucide-react'
import useGameStore from '../lib/store'
import StatementCard from '../components/StatementCard'
import Avatar from '../components/Avatar'

export default function VotingPhase() {
  const players       = useGameStore((s) => s.players)
  const myId          = useGameStore((s) => s.myId)
  const deceiverIndex = useGameStore((s) => s.deceiverIndex)
  const statements    = useGameStore((s) => s.statements)
  const votes         = useGameStore((s) => s.votes)
  const castVote      = useGameStore((s) => s.castVote)
  const proceedToAIJudge = useGameStore((s) => s.proceedToAIJudge)
  const timer         = useGameStore((s) => s.timer)

  const [myVote,       setMyVote]       = useState(null)
  const [myConfidence, setMyConfidence] = useState(0.6)
  const [submitted,    setSubmitted]    = useState(false)

  const deceiver      = players[deceiverIndex]
  const isDeceiver    = deceiver?.id === myId
  const voterCount    = Object.keys(votes).length
  const detectorCount = players.filter((p) => p.id !== deceiver?.id).length

  useEffect(() => {
    if (timer === 0 || voterCount >= detectorCount) {
      const t = setTimeout(() => proceedToAIJudge(), 1500)
      return () => clearTimeout(t)
    }
  }, [timer, voterCount, detectorCount])

  const handleSubmit = () => {
    if (myVote === null) return
    castVote(myId, myVote, myConfidence)
    setSubmitted(true)
  }

  const votePct = detectorCount > 0 ? (voterCount / detectorCount) * 100 : 0

  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-10 gap-6 animate-slide-up">
      <div className="w-full max-w-lg">

        {/* Header */}
        <div className="text-center mb-7">
          <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-white/35 mb-2">
            Voting phase
          </div>
          <h2 className="font-display font-bold text-2xl sm:text-3xl text-white mb-3">
            Which statement is the lie?
          </h2>
          <div className="inline-flex items-center gap-2.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-2">
            <Avatar name={deceiver?.name} color={deceiver?.color} size={24} />
            <p className="text-white/45 text-sm">
              <span style={{ color: deceiver?.color }} className="font-semibold">{deceiver?.name}</span>
              {' '}wrote these. Spot the lie.
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
          <div className="glass rounded-2xl border border-white/[0.08] p-5 mb-5 animate-slide-up">
            <div className="flex items-center justify-between mb-3">
              <span className="text-white/55 text-sm font-medium">Confidence level</span>
              <span className="font-mono font-bold text-sm text-plasma text-glow-plasma">
                {Math.round(myConfidence * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="10" max="100"
              value={Math.round(myConfidence * 100)}
              onChange={(e) => setMyConfidence(e.target.value / 100)}
              className="w-full mb-2"
              style={{ accentColor: '#a259ff' }}
            />
            <div className="flex justify-between text-[10px] font-mono text-white/25 mb-2">
              <span>Uncertain</span>
              <span>Very sure</span>
            </div>
            <p className="text-white/25 text-xs">
              Higher confidence = more XP if correct, but you lose more credibility if wrong
            </p>
          </div>
        )}

        {/* Submit / status */}
        {isDeceiver ? (
          <div className="glass rounded-2xl border border-signal/20 px-5 py-4 text-center mb-5"
            style={{ background: 'rgba(255,107,53,0.05)' }}>
            <p className="text-signal text-sm inline-flex items-center gap-2 justify-center font-medium">
              <Drama className="w-4 h-4" strokeWidth={2} />
              You're the Deceiver — sit back and watch them squirm
            </p>
          </div>
        ) : submitted ? (
          <div className="glass rounded-2xl border border-neon/25 px-5 py-4 text-center mb-5"
            style={{ background: 'rgba(127,255,110,0.05)' }}>
            <p className="text-neon text-sm inline-flex items-center gap-2 justify-center font-semibold mb-1">
              <Check className="w-4 h-4" strokeWidth={2.5} />
              Vote submitted at {Math.round(myConfidence * 100)}% confidence
            </p>
            <p className="text-white/25 text-xs">Waiting for other players…</p>
          </div>
        ) : (
          <button
            className="btn btn-plasma w-full py-4 text-base inline-flex items-center justify-center gap-2 mb-5"
            disabled={myVote === null}
            onClick={handleSubmit}
          >
            <Eye className="w-4.5 h-4.5" strokeWidth={2.25} />
            Lock in My Vote
          </button>
        )}

        {/* Vote progress */}
        <div className="glass rounded-2xl border border-white/[0.06] p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-white/35 text-xs font-mono uppercase tracking-wider">Votes cast</span>
            <span className="text-white/50 text-xs font-mono font-medium">
              {voterCount} / {detectorCount}
            </span>
          </div>

          <div className="h-1.5 bg-white/[0.07] rounded-full overflow-hidden mb-4">
            <div
              className="h-full bg-gradient-to-r from-plasma to-ice rounded-full transition-all duration-700"
              style={{
                width:     `${votePct}%`,
                boxShadow: '0 0 8px rgba(162,89,255,0.4)',
              }}
            />
          </div>

          <div className="flex gap-2 flex-wrap">
            {players.filter((p) => p.id !== deceiver?.id).map((p) => {
              const voted = votes[p.id] !== undefined
              return (
                <div
                  key={p.id}
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs transition-all duration-300"
                  style={{
                    background: voted ? p.color + '18' : 'rgba(255,255,255,0.03)',
                    border:     `1px solid ${voted ? p.color + '40' : 'rgba(255,255,255,0.06)'}`,
                  }}
                >
                  <Avatar name={p.name} color={p.color} size={16} />
                  <span style={{ color: voted ? p.color : 'rgba(255,255,255,0.3)' }}>
                    {p.name}
                  </span>
                  {voted && <Check className="w-3 h-3" style={{ color: p.color }} strokeWidth={2.5} />}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
