import React from 'react'
import {
  Drama,
  Search,
  Bot,
  Hand,
  Check,
  X as XIcon,
  Target,
  Trophy,
  ArrowRight,
  Sparkles,
} from 'lucide-react'
import useGameStore from '../lib/store'
import StatementCard from '../components/StatementCard'
import Confetti from '../components/Confetti'
import Avatar from '../components/Avatar'

export default function RevealPhase() {
  const players    = useGameStore((s) => s.players)
  const myId       = useGameStore((s) => s.myId)
  const statements = useGameStore((s) => s.statements)
  const revealData = useGameStore((s) => s.revealData)
  const nextRound  = useGameStore((s) => s.nextRound)
  const round      = useGameStore((s) => s.round)
  const maxRounds  = useGameStore((s) => s.maxRounds)

  if (!revealData) return null

  const { lieIndex, votes, aiVerdict, aiWasFooled, fooledPlayers, xpGained, objectionRaised, objectionVotes, deceiverId } = revealData
  const deceiver  = players.find((p) => p.id === deceiverId)
  const myXP      = xpGained[myId] || 0
  const myVote    = votes[myId]
  const iWasRight = myVote === lieIndex
  const deceived  = fooledPlayers.length

  const sustainCount  = Object.values(objectionVotes || {}).filter((v) => v === 'sustain').length
  const overruleCount = Object.values(objectionVotes || {}).filter((v) => v === 'overrule').length

  const totalVotes        = Object.keys(votes).length
  const votesPerStatement = [0, 1, 2].map((i) =>
    Object.values(votes).filter((v) => v === i).length
  )

  const showConfetti = iWasRight || myXP > 100

  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-10 gap-6 animate-slide-up relative overflow-x-hidden">
      {showConfetti && <Confetti />}

      <div className="w-full max-w-lg relative z-10">

        {/* Main result header */}
        <div
          className={`relative glass rounded-2xl border overflow-hidden text-center p-7 mb-6 ${
            aiWasFooled ? 'border-signal/30' : 'border-neon/30'
          }`}
          style={{ background: aiWasFooled ? 'rgba(192,91,48,0.05)' : 'rgba(61,184,122,0.05)' }}
        >
          <div className={`absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent ${aiWasFooled ? 'via-signal/50' : 'via-neon/50'} to-transparent`} />

          {/* Ambient glow */}
          <div className={`absolute inset-x-0 -top-10 h-20 blur-3xl pointer-events-none ${aiWasFooled ? 'bg-signal/15' : 'bg-neon/10'}`} />

          <div className="relative">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5 ${
              aiWasFooled ? 'bg-signal/12 border border-signal/25' : 'bg-neon/12 border border-neon/25'
            }`}>
              {aiWasFooled
                ? <Drama className="w-8 h-8 text-signal" strokeWidth={1.75} />
                : <Search className="w-8 h-8 text-neon" strokeWidth={1.75} />}
            </div>

            <h2 className="font-display font-bold text-2xl sm:text-3xl text-white mb-1.5">
              {aiWasFooled ? 'The AI was fooled!' : 'The AI cracked it!'}
            </h2>

            <p className="text-white/45 text-sm mb-4">
              {deceived} of {players.length - 1} player{players.length - 1 !== 1 ? 's' : ''} were{' '}
              {deceived === 0 ? 'not ' : ''}fooled
            </p>

            <span className="inline-flex items-center gap-1.5 badge bg-signal/15 text-signal border border-signal/30">
              <Drama className="w-3.5 h-3.5" />
              {deceiver?.name} was the Deceiver
            </span>
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

        {/* AI reasoning card */}
        <div className="glass rounded-2xl border border-plasma/20 p-5 mb-4"
          style={{ background: 'rgba(162,89,255,0.04)' }}>
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-plasma/15 border border-plasma/25 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Bot className="w-4.5 h-4.5 text-plasma" strokeWidth={2} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-plasma font-semibold text-sm mb-1.5">AI Judge's Reasoning</p>
              <p className="text-white/45 text-sm italic leading-relaxed mb-2">"{aiVerdict?.reasoning}"</p>
              <span className={`inline-flex items-center gap-1.5 text-xs font-mono font-medium ${aiWasFooled ? 'text-signal' : 'text-neon'}`}>
                AI was{' '}
                {aiWasFooled
                  ? <><XIcon className="w-3.5 h-3.5" /> FOOLED</>
                  : <><Check className="w-3.5 h-3.5" /> CORRECT</>}
              </span>
            </div>
          </div>
        </div>

        {/* Objection result */}
        {objectionRaised && (
          <div className="glass rounded-2xl border border-gold/20 p-5 mb-4"
            style={{ background: 'rgba(245,200,66,0.04)' }}>
            <div className="flex items-center gap-2.5 mb-3">
              <Hand className="w-4.5 h-4.5 text-gold" strokeWidth={2.25} />
              <span className="text-gold font-semibold text-sm">Objection Result</span>
            </div>
            <div className="flex gap-5 text-sm mb-2">
              <span className="text-neon inline-flex items-center gap-1.5 font-medium">
                <Check className="w-3.5 h-3.5" /> Sustain: {sustainCount}
              </span>
              <span className="text-signal inline-flex items-center gap-1.5 font-medium">
                <XIcon className="w-3.5 h-3.5" /> Overrule: {overruleCount}
              </span>
            </div>
            <p className="text-white/30 text-xs font-mono">
              {sustainCount > overruleCount
                ? 'Objection sustained — AI verdict overturned'
                : 'Objection overruled — AI verdict stands'}
            </p>
          </div>
        )}

        {/* XP Breakdown */}
        <div className="glass rounded-2xl border border-white/[0.08] p-5 mb-5">
          <h3 className="font-display font-bold text-white mb-4 inline-flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-gold" strokeWidth={2} />
            XP Awarded
          </h3>
          <div className="space-y-2.5">
            {players
              .sort((a, b) => (xpGained[b.id] || 0) - (xpGained[a.id] || 0))
              .map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-3 rounded-xl px-3.5 py-3 transition-all"
                  style={{
                    background: p.id === myId ? p.color + '0e' : 'rgba(255,255,255,0.025)',
                    border:     `1px solid ${p.id === myId ? p.color + '2a' : 'rgba(255,255,255,0.05)'}`,
                  }}
                >
                  <Avatar
                    name={p.name}
                    src={p.avatar && String(p.avatar).startsWith('data:') ? p.avatar : ''}
                    color={p.color}
                    size={32}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-semibold text-sm text-white truncate">{p.name}</span>
                      {p.id === myId && <span className="text-[10px] text-white/25 font-mono">(you)</span>}
                      {p.id === deceiverId && (
                        <span className="badge bg-signal/15 text-signal border border-signal/25 text-[9px]">Deceiver</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className={`font-display font-bold text-sm ${
                      (xpGained[p.id] || 0) > 0 ? 'text-gold text-glow-gold' : 'text-white/20'
                    }`}>
                      {(xpGained[p.id] || 0) > 0 ? `+${xpGained[p.id]}` : '—'}
                    </span>
                    <div className="text-white/25 text-[10px] font-mono">XP</div>
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* My personal result */}
        {myId !== deceiverId && (
          <div
            className={`glass rounded-2xl border text-center p-5 mb-5 ${
              iWasRight ? 'border-neon/30' : 'border-signal/30'
            }`}
            style={{ background: iWasRight ? 'rgba(61,184,122,0.05)' : 'rgba(192,91,48,0.05)' }}
          >
            <p className={`font-display font-bold text-lg inline-flex items-center gap-2 justify-center ${
              iWasRight ? 'text-neon' : 'text-signal'
            }`}>
              {iWasRight
                ? <><Target className="w-5 h-5" strokeWidth={2.25} /> You spotted the lie!</>
                : <><Drama className="w-5 h-5" strokeWidth={2.25} /> You were deceived!</>}
            </p>
            {myXP > 0 && (
              <p className="text-gold text-sm mt-1.5">+{myXP} XP earned this round</p>
            )}
          </div>
        )}

        {/* Continue CTA */}
        <button
          className="btn btn-crimson w-full py-4 text-base inline-flex items-center justify-center gap-2"
          onClick={nextRound}
        >
          {round >= maxRounds ? (
            <><Trophy className="w-4.5 h-4.5" strokeWidth={2.25} /> See Final Scores</>
          ) : (
            <>Round {round + 1} of {maxRounds} <ArrowRight className="w-4 h-4" strokeWidth={2.25} /></>
          )}
        </button>
      </div>
    </div>
  )
}
