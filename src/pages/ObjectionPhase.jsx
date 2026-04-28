import React, { useEffect } from 'react'
import useGameStore, { PHASES } from '../lib/store'
import StatementCard from '../components/StatementCard'

export default function ObjectionPhase() {
  const phase = useGameStore(s => s.phase)
  const players = useGameStore(s => s.players)
  const myId = useGameStore(s => s.myId)
  const statements = useGameStore(s => s.statements)
  const aiVerdict = useGameStore(s => s.aiVerdict)
  const objectionRaised = useGameStore(s => s.objectionRaised)
  const objectionBy = useGameStore(s => s.objectionBy)
  const objectionVotes = useGameStore(s => s.objectionVotes)
  const raiseObjection = useGameStore(s => s.raiseObjection)
  const castObjectionVote = useGameStore(s => s.castObjectionVote)
  const finalizeRound = useGameStore(s => s.finalizeRound)
  const timer = useGameStore(s => s.timer)
  const deceiverIndex = useGameStore(s => s.deceiverIndex)

  const deceiver = players[deceiverIndex]
  const objector = players.find(p => p.id === objectionBy)
  const myObjVote = objectionVotes[myId]
  const sustainCount = Object.values(objectionVotes).filter(v => v === 'sustain').length
  const overruleCount = Object.values(objectionVotes).filter(v => v === 'overrule').length
  const totalObjVotes = Object.keys(objectionVotes).length
  const eligibleVoters = players.filter(p => p.id !== objectionBy).length

  // Auto finalize when timer out
  useEffect(() => {
    if (timer === 0) finalizeRound()
  }, [timer])

  // Finalize when all objection votes in
  useEffect(() => {
    if (phase === PHASES.OBJECTION_VOTE && totalObjVotes >= eligibleVoters) {
      const timeout = setTimeout(() => finalizeRound(), 2000)
      return () => clearTimeout(timeout)
    }
  }, [totalObjVotes, eligibleVoters])

  if (phase === PHASES.OBJECTION) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 gap-6 animate-slide-up">
        <div className="w-full max-w-lg">
          {/* AI Verdict */}
          <div className="card mb-6 text-center" style={{ borderColor: 'rgba(162,89,255,0.3)', background: 'rgba(162,89,255,0.05)' }}>
            <div className="text-4xl mb-3">🤖</div>
            <h2 className="font-display text-xl font-700 text-plasma mb-2">AI Judge's Verdict</h2>
            <div className="badge bg-plasma/20 text-plasma border border-plasma/30 text-sm mb-4 mx-auto">
              Statement {['A','B','C'][aiVerdict?.verdict]} is the lie
            </div>
            <p className="text-white/50 text-sm italic mb-3">"{aiVerdict?.reasoning}"</p>
            <div className="flex items-center justify-center gap-2 text-xs text-white/30 font-mono">
              <span>Confidence:</span>
              <div className="w-24 progress-bar">
                <div className="progress-fill bg-plasma" style={{ width: `${(aiVerdict?.confidence || 0.5) * 100}%` }} />
              </div>
              <span>{Math.round((aiVerdict?.confidence || 0.5) * 100)}%</span>
            </div>
          </div>

          {/* Statements summary */}
          <div className="space-y-2 mb-6">
            {statements.map((text, i) => (
              <StatementCard
                key={i}
                index={i}
                text={text}
                selected={aiVerdict?.verdict === i}
                disabled={true}
              />
            ))}
          </div>

          {/* Objection section */}
          <div className="card text-center" style={{ borderColor: 'rgba(245,200,66,0.2)', background: 'rgba(245,200,66,0.04)' }}>
            <h3 className="font-display text-lg font-700 text-gold mb-2">✊ Raise an Objection?</h3>
            <p className="text-white/40 text-sm mb-4">
              If you believe the AI Judge ruled incorrectly, raise an Objection.<br />
              Players will vote to <strong className="text-neon">Sustain</strong> or <strong className="text-signal">Overrule</strong> — this is GenLayer's <em>Optimistic Democracy</em> in action.
            </p>
            {myId !== deceiver?.id && (
              <button
                className="btn btn-gold"
                onClick={() => raiseObjection(myId)}
              >
                ✊ I Object!
              </button>
            )}
            {myId === deceiver?.id && (
              <p className="text-white/30 text-xs">Deceivers cannot raise objections</p>
            )}
            <p className="text-white/20 text-xs mt-3 font-mono">{timer}s remaining to object</p>
          </div>
        </div>
      </div>
    )
  }

  // OBJECTION VOTE phase
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 gap-6 animate-slide-up">
      <div className="w-full max-w-lg">
        <div className="card mb-6 text-center" style={{ borderColor: 'rgba(245,200,66,0.3)', background: 'rgba(245,200,66,0.05)' }}>
          <div className="text-4xl mb-2">⚖️</div>
          <h2 className="font-display text-2xl font-700 text-gold mb-2">Objection Raised!</h2>
          <p className="text-white/50 text-sm">
            <span style={{ color: objector?.color }}>{objector?.name}</span> has objected to the AI's verdict.
            <br />Players must now vote — Sustain or Overrule.
          </p>
          <div className="badge bg-gold/20 text-gold border border-gold/30 text-xs mt-3 mx-auto">
            Optimistic Democracy in Action
          </div>
        </div>

        {/* AI verdict reminder */}
        <div className="card mb-4 bg-plasma/5 border-plasma/20 text-sm text-center">
          <span className="text-white/40">AI said: </span>
          <span className="text-plasma font-600">Statement {['A','B','C'][aiVerdict?.verdict]}</span>
          <span className="text-white/40"> is the lie</span>
        </div>

        {/* Vote buttons */}
        {myId !== objectionBy && !myObjVote && (
          <div className="grid grid-cols-2 gap-4 mb-6">
            <button
              className="btn btn-neon flex-col py-6 text-base h-auto"
              onClick={() => castObjectionVote(myId, 'sustain')}
            >
              <span className="text-2xl mb-1">✅</span>
              <span className="font-700">Sustain</span>
              <span className="text-black/60 text-xs font-body font-400">AI was wrong</span>
            </button>
            <button
              className="btn btn-ghost flex-col py-6 text-base h-auto border-signal/30 hover:border-signal/60"
              onClick={() => castObjectionVote(myId, 'overrule')}
            >
              <span className="text-2xl mb-1">❌</span>
              <span className="font-700">Overrule</span>
              <span className="text-white/40 text-xs font-body font-400">AI was right</span>
            </button>
          </div>
        )}

        {myObjVote && (
          <div className={`card text-center mb-4 ${myObjVote === 'sustain' ? 'border-neon/30 bg-neon/5' : 'border-signal/30 bg-signal/5'}`}>
            <p className={`font-600 ${myObjVote === 'sustain' ? 'text-neon' : 'text-signal'}`}>
              You voted to {myObjVote === 'sustain' ? '✅ Sustain' : '❌ Overrule'}
            </p>
          </div>
        )}

        {myId === objectionBy && (
          <div className="card text-center mb-4 border-gold/30 bg-gold/5">
            <p className="text-gold text-sm">You raised this objection — other players are voting</p>
          </div>
        )}

        {/* Tally */}
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <span className="text-white/40 text-sm">Live Tally</span>
            <span className="text-white/30 text-xs font-mono">{totalObjVotes}/{players.length - 1} voted</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl p-3 bg-neon/10 border border-neon/20 text-center">
              <div className="font-display text-3xl font-800 text-neon">{sustainCount}</div>
              <div className="text-xs text-neon/70 mt-1">Sustain</div>
            </div>
            <div className="rounded-xl p-3 bg-signal/10 border border-signal/20 text-center">
              <div className="font-display text-3xl font-800 text-signal">{overruleCount}</div>
              <div className="text-xs text-signal/70 mt-1">Overrule</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
