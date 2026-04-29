import React from 'react'
import useGameStore from '../lib/store'
import StatementCard from '../components/StatementCard'
import Confetti from '../components/Confetti'

export default function RevealPhase() {
  const players = useGameStore(s => s.players)
  const myId = useGameStore(s => s.myId)
  const statements = useGameStore(s => s.statements)
  const revealData = useGameStore(s => s.revealData)
  const nextRound = useGameStore(s => s.nextRound)
  const round = useGameStore(s => s.round)
  const maxRounds = useGameStore(s => s.maxRounds)
  const deceiverIndex = useGameStore(s => s.deceiverIndex)

  if (!revealData) return null

  const { lieIndex, votes, aiVerdict, aiWasFooled, fooledPlayers, xpGained, objectionRaised, objectionVotes, deceiverId } = revealData
  const deceiver = players.find(p => p.id === deceiverId)
  const myXP = xpGained[myId] || 0
  const myVote = votes[myId]
  const iWasRight = myVote === lieIndex
  const deceived = fooledPlayers.length

  const sustainCount = Object.values(objectionVotes || {}).filter(v => v === 'sustain').length
  const overruleCount = Object.values(objectionVotes || {}).filter(v => v === 'overrule').length

  const totalVotes = Object.keys(votes).length
  const votesPerStatement = [0, 1, 2].map(i => Object.values(votes).filter(v => v === i).length)

  const showConfetti = iWasRight || myXP > 100

  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-8 gap-6 animate-slide-up relative">
      {showConfetti && <Confetti />}

      <div className="w-full max-w-lg relative z-10">
        {/* Header result */}
        <div className={`card text-center mb-6 ${aiWasFooled ? 'border-signal/30' : 'border-neon/30'}`}
          style={{ background: aiWasFooled ? 'rgba(255,107,53,0.06)' : 'rgba(127,255,110,0.06)' }}>
          <div className="text-5xl mb-3">{aiWasFooled ? '🎭' : '🔍'}</div>
          <h2 className="font-display text-2xl font-700 text-white mb-1">
            {aiWasFooled ? 'The AI was fooled!' : 'The AI cracked it!'}
          </h2>
          <p className="text-white/50 text-sm">
            {deceived} of {players.length - 1} player{players.length - 1 !== 1 ? 's' : ''} were also {deceived === 0 ? 'not ' : ''}fooled
          </p>
          <div className="flex justify-center gap-3 mt-4">
            <div className="badge bg-signal/20 text-signal border border-signal/30">
              🎭 {deceiver?.name} was the Deceiver
            </div>
          </div>
        </div>

        {/* Statements revealed */}
        <div className="space-y-3 mb-6">
          {statements.map((text, i) => (
            <StatementCard
              key={i}
              index={i}
              text={text}
              revealed
              isLie={i === lieIndex}
              aiPicked={aiVerdict?.verdict === i}
              playerVoted={myVote === i}
              voteCount={votesPerStatement[i]}
              totalVotes={totalVotes}
              disabled
            />
          ))}
        </div>

        {/* AI verdict card */}
        <div className="card bg-plasma/5 border-plasma/20 mb-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">🤖</span>
            <div>
              <p className="text-plasma font-600 text-sm mb-1">AI Judge's Reasoning</p>
              <p className="text-white/50 text-sm italic">"{aiVerdict?.reasoning}"</p>
              <p className={`text-xs mt-2 font-mono ${aiWasFooled ? 'text-signal' : 'text-neon'}`}>
                AI was {aiWasFooled ? '❌ FOOLED' : '✓ CORRECT'}
              </p>
            </div>
          </div>
        </div>

        {/* Objection result */}
        {objectionRaised && (
          <div className="card bg-gold/5 border-gold/20 mb-4">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-xl">✊</span>
              <span className="text-gold font-600 text-sm">Objection Result</span>
            </div>
            <div className="flex gap-4 text-sm">
              <span className="text-neon">✅ Sustain: {sustainCount}</span>
              <span className="text-signal">❌ Overrule: {overruleCount}</span>
            </div>
            <p className="text-white/30 text-xs mt-2">
              {sustainCount > overruleCount ? 'Objection sustained — AI verdict overturned' : 'Objection overruled — AI verdict stands'}
            </p>
          </div>
        )}

        {/* XP Breakdown */}
        <div className="card mb-6">
          <h3 className="font-display font-700 text-white mb-4">XP Awarded</h3>
          <div className="space-y-2">
            {players.sort((a, b) => (xpGained[b.id] || 0) - (xpGained[a.id] || 0)).map(p => (
              <div
                key={p.id}
                className="flex items-center gap-3 p-3 rounded-xl"
                style={{ background: p.id === myId ? p.color + '11' : 'rgba(255,255,255,0.03)', border: `1px solid ${p.id === myId ? p.color + '33' : 'rgba(255,255,255,0.05)'}` }}
              >
                <div className="avatar w-8 h-8 text-sm" style={{ background: p.color + '22', color: p.color }}>
                  {p.avatar}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-600 text-sm text-white">{p.name}</span>
                    {p.id === myId && <span className="text-xs text-white/30">(you)</span>}
                    {p.id === deceiverId && <span className="badge bg-signal/20 text-signal border-signal/30 text-xs ml-1">Deceiver</span>}
                  </div>
                </div>
                <div className="text-right">
                  <span className={`font-display font-700 ${(xpGained[p.id] || 0) > 0 ? 'text-gold' : 'text-white/20'}`}>
                    {(xpGained[p.id] || 0) > 0 ? `+${xpGained[p.id]}` : '—'}
                  </span>
                  <div className="text-white/30 text-xs">XP</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* My result summary */}
        {myId !== deceiverId && (
          <div className={`card text-center mb-6 ${iWasRight ? 'border-neon/30 bg-neon/5' : 'border-signal/30 bg-signal/5'}`}>
            <p className={`font-display font-700 text-lg ${iWasRight ? 'text-neon' : 'text-signal'}`}>
              {iWasRight ? '🎯 You spotted the lie!' : '🎭 You were deceived!'}
            </p>
            {myXP > 0 && (
              <p className="text-gold text-sm mt-1">+{myXP} XP earned this round</p>
            )}
          </div>
        )}

        <button
          className="btn btn-neon w-full py-4 text-base"
          onClick={nextRound}
        >
          {round >= maxRounds ? '🏆 See Final Scores' : `➡️ Round ${round + 1} of ${maxRounds}`}
        </button>
      </div>
    </div>
  )
}
