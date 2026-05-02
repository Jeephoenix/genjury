import React, { useEffect } from 'react'
import { Bot, Scale, Hand, Check, X as XIcon, Zap } from 'lucide-react'
import useGameStore, { PHASES } from '../lib/store'
import StatementCard from '../components/StatementCard'

export default function ObjectionPhase() {
  const phase          = useGameStore((s) => s.phase)
  const players        = useGameStore((s) => s.players)
  const myId           = useGameStore((s) => s.myId)
  const statements     = useGameStore((s) => s.statements)
  const aiVerdict      = useGameStore((s) => s.aiVerdict)
  const objectionRaised    = useGameStore((s) => s.objectionRaised)
  const objectionBy        = useGameStore((s) => s.objectionBy)
  const objectionVotes     = useGameStore((s) => s.objectionVotes)
  const raiseObjection     = useGameStore((s) => s.raiseObjection)
  const castObjectionVote  = useGameStore((s) => s.castObjectionVote)
  const finalizeRound      = useGameStore((s) => s.finalizeRound)
  const timer          = useGameStore((s) => s.timer)
  const deceiverIndex  = useGameStore((s) => s.deceiverIndex)

  const deceiver      = players[deceiverIndex]
  const objector      = players.find((p) => p.id === objectionBy)
  const myObjVote     = objectionVotes[myId]
  const sustainCount  = Object.values(objectionVotes).filter((v) => v === 'sustain').length
  const overruleCount = Object.values(objectionVotes).filter((v) => v === 'overrule').length
  const totalObjVotes = Object.keys(objectionVotes).length
  const eligibleVoters = players.filter((p) => p.id !== objectionBy).length

  useEffect(() => { if (timer === 0) finalizeRound() }, [timer])

  useEffect(() => {
    if (phase === PHASES.OBJECTION_VOTE && totalObjVotes >= eligibleVoters) {
      const t = setTimeout(() => finalizeRound(), 2000)
      return () => clearTimeout(t)
    }
  }, [totalObjVotes, eligibleVoters])

  if (phase === PHASES.OBJECTION) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 gap-6 animate-slide-up">
        <div className="w-full max-w-lg">

          {/* AI Verdict card */}
          <div className="relative glass rounded-2xl border border-plasma/30 overflow-hidden mb-6 text-center p-6"
            style={{ background: 'rgba(162,89,255,0.05)' }}>
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-plasma/50 to-transparent" />

            <div className="w-14 h-14 rounded-2xl bg-plasma/15 border border-plasma/30 flex items-center justify-center mx-auto mb-4">
              <Bot className="w-7 h-7 text-plasma" strokeWidth={1.75} />
            </div>

            <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-plasma/60 mb-2">AI Judge</div>
            <h2 className="font-display font-bold text-xl text-white mb-3">The Verdict</h2>

            <div className="inline-flex items-center gap-2 badge bg-plasma/15 text-plasma border border-plasma/30 text-sm mb-4">
              Statement {['A','B','C'][aiVerdict?.verdict]} is the lie
            </div>

            <p className="text-white/45 text-sm italic mb-4 leading-relaxed">
              "{aiVerdict?.reasoning}"
            </p>

            <div className="flex items-center justify-center gap-3 text-xs text-white/30 font-mono">
              <span>Confidence</span>
              <div className="w-28 h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-plasma rounded-full"
                  style={{ width: `${(aiVerdict?.confidence || 0.5) * 100}%`, boxShadow: '0 0 8px rgba(162,89,255,0.5)' }}
                />
              </div>
              <span className="text-plasma/70">{Math.round((aiVerdict?.confidence || 0.5) * 100)}%</span>
            </div>
          </div>

          {/* Statements */}
          <div className="space-y-2.5 mb-6">
            {statements.map((text, i) => (
              <StatementCard
                key={i}
                index={i}
                text={text}
                selected={aiVerdict?.verdict === i}
                disabled
              />
            ))}
          </div>

          {/* Objection section */}
          <div className="relative glass rounded-2xl border border-gold/25 overflow-hidden p-5 text-center"
            style={{ background: 'rgba(245,200,66,0.04)' }}>
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent" />

            <div className="inline-flex items-center gap-2 text-gold font-display font-bold text-lg mb-2">
              <Hand className="w-5 h-5" strokeWidth={2.25} /> Raise an Objection?
            </div>

            <p className="text-white/40 text-sm mb-5 leading-relaxed max-w-sm mx-auto">
              If you believe the AI Judge ruled incorrectly, raise an Objection.{' '}
              Players will vote to{' '}
              <strong className="text-neon font-semibold">Sustain</strong> or{' '}
              <strong className="text-signal font-semibold">Overrule</strong> — GenLayer's <em>Optimistic Democracy</em> in action.
            </p>

            {myId !== deceiver?.id ? (
              <button
                className="btn btn-gold inline-flex items-center gap-2 px-6"
                onClick={() => raiseObjection(myId)}
              >
                <Hand className="w-4 h-4" strokeWidth={2.25} /> I Object!
              </button>
            ) : (
              <p className="text-white/25 text-xs font-mono">Deceivers cannot raise objections</p>
            )}

            <p className="text-white/20 text-xs font-mono mt-4">
              {timer}s remaining to object
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ── OBJECTION_VOTE phase ──
  const totalVoters = sustainCount + overruleCount
  const sustainPct  = totalVoters > 0 ? Math.round((sustainCount / totalVoters) * 100) : 50

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 gap-6 animate-slide-up">
      <div className="w-full max-w-lg">

        {/* Header */}
        <div className="relative glass rounded-2xl border border-gold/30 overflow-hidden mb-6 text-center p-6"
          style={{ background: 'rgba(245,200,66,0.05)' }}>
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/50 to-transparent" />

          <div className="w-14 h-14 rounded-2xl bg-gold/12 border border-gold/25 flex items-center justify-center mx-auto mb-4">
            <Scale className="w-7 h-7 text-gold" strokeWidth={2} />
          </div>

          <h2 className="font-display font-bold text-2xl text-white mb-2">Objection Raised!</h2>
          <p className="text-white/45 text-sm leading-relaxed">
            <span style={{ color: objector?.color }} className="font-semibold">{objector?.name}</span> objected
            to the AI's verdict. Players must now vote.
          </p>
          <div className="inline-flex items-center gap-1.5 badge bg-gold/12 text-gold border border-gold/25 text-xs mt-3">
            <Zap className="w-3 h-3" strokeWidth={2.5} /> Optimistic Democracy in Action
          </div>
        </div>

        {/* AI verdict reminder */}
        <div className="glass rounded-xl border border-plasma/20 px-4 py-3 mb-5 text-sm text-center"
          style={{ background: 'rgba(162,89,255,0.05)' }}>
          <span className="text-white/40">AI ruled: </span>
          <span className="text-plasma font-semibold">Statement {['A','B','C'][aiVerdict?.verdict]}</span>
          <span className="text-white/40"> is the lie</span>
        </div>

        {/* Vote buttons */}
        {myId !== objectionBy && !myObjVote && (
          <div className="grid grid-cols-2 gap-4 mb-5">
            <button
              className="vote-btn border-neon/35 bg-neon/8 text-neon hover:bg-neon/15 hover:border-neon/55 hover:shadow-[0_0_30px_rgba(127,255,110,0.15)]"
              onClick={() => castObjectionVote(myId, 'sustain')}
            >
              <div className="w-10 h-10 rounded-xl bg-neon/15 border border-neon/30 flex items-center justify-center">
                <Check className="w-5 h-5 text-neon" strokeWidth={2.5} />
              </div>
              <span className="font-display font-bold text-base">Sustain</span>
              <span className="text-neon/50 text-xs">AI was wrong</span>
            </button>

            <button
              className="vote-btn border-signal/35 bg-signal/8 text-signal hover:bg-signal/15 hover:border-signal/55 hover:shadow-[0_0_30px_rgba(255,107,53,0.15)]"
              onClick={() => castObjectionVote(myId, 'overrule')}
            >
              <div className="w-10 h-10 rounded-xl bg-signal/15 border border-signal/30 flex items-center justify-center">
                <XIcon className="w-5 h-5 text-signal" strokeWidth={2.5} />
              </div>
              <span className="font-display font-bold text-base">Overrule</span>
              <span className="text-signal/50 text-xs">AI was right</span>
            </button>
          </div>
        )}

        {/* Already voted */}
        {myObjVote && (
          <div className={`glass rounded-xl border px-4 py-3.5 text-center mb-5 ${
            myObjVote === 'sustain' ? 'border-neon/30 bg-neon/[0.06]' : 'border-signal/30 bg-signal/[0.06]'
          }`}>
            <p className={`font-semibold inline-flex items-center gap-1.5 justify-center text-sm ${
              myObjVote === 'sustain' ? 'text-neon' : 'text-signal'
            }`}>
              {myObjVote === 'sustain'
                ? <><Check className="w-4 h-4" /> You voted Sustain</>
                : <><XIcon className="w-4 h-4" /> You voted Overrule</>}
            </p>
          </div>
        )}

        {myId === objectionBy && (
          <div className="glass rounded-xl border border-gold/25 px-4 py-3.5 text-center mb-5">
            <p className="text-gold text-sm">You raised this objection — other players are voting</p>
          </div>
        )}

        {/* Live tally */}
        <div className="glass rounded-2xl border border-white/[0.08] p-5">
          <div className="flex items-center justify-between mb-4">
            <span className="text-white/45 text-sm font-medium">Live Tally</span>
            <span className="text-white/25 text-xs font-mono">{totalObjVotes}/{players.length - 1} voted</span>
          </div>

          {/* Split bar */}
          <div className="h-3 rounded-full overflow-hidden bg-signal/15 mb-4">
            <div
              className="h-full bg-neon rounded-full transition-all duration-700"
              style={{
                width: `${sustainPct}%`,
                boxShadow: '0 0 10px rgba(127,255,110,0.4)',
              }}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl bg-neon/8 border border-neon/20 px-4 py-3.5 text-center">
              <div className="font-display font-bold text-3xl text-neon text-glow-neon">{sustainCount}</div>
              <div className="text-neon/50 text-xs font-mono mt-1 uppercase tracking-wider">Sustain</div>
            </div>
            <div className="rounded-xl bg-signal/8 border border-signal/20 px-4 py-3.5 text-center">
              <div className="font-display font-bold text-3xl text-signal text-glow-signal">{overruleCount}</div>
              <div className="text-signal/50 text-xs font-mono mt-1 uppercase tracking-wider">Overrule</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
