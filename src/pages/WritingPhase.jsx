import React from 'react'
import { Drama, Lightbulb, Send, PenLine } from 'lucide-react'
import useGameStore from '../lib/store'
import TimerRing from '../components/TimerRing'
import Avatar from '../components/Avatar'

export default function WritingPhase() {
  const players        = useGameStore((s) => s.players)
  const myId           = useGameStore((s) => s.myId)
  const deceiverIndex  = useGameStore((s) => s.deceiverIndex)
  const category       = useGameStore((s) => s.category)
  const statements     = useGameStore((s) => s.statements)
  const lieIndex       = useGameStore((s) => s.lieIndex)
  const setStatement   = useGameStore((s) => s.setStatement)
  const setLieIndex    = useGameStore((s) => s.setLieIndex)
  const submitStatements = useGameStore((s) => s.submitStatements)
  const timer          = useGameStore((s) => s.timer)
  const timerMax       = useGameStore((s) => s.timerMax)

  const deceiver   = players[deceiverIndex]
  const isDeceiver = deceiver?.id === myId
  const letters    = ['A', 'B', 'C']
  const canSubmit  = statements.every((s) => s.trim().length >= 3) && lieIndex !== null

  React.useEffect(() => {
    if (timer === 0 && isDeceiver && canSubmit) submitStatements()
  }, [timer])

  // ── Waiting screen (non-deceiver) ──
  if (!isDeceiver) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 gap-8 animate-fade-in">
        <div className="text-center">
          <div className="relative inline-block mb-5">
            <Avatar name={deceiver?.name} color={deceiver?.color} size={72} />
            <div
              className="absolute -inset-3 rounded-full blur-2xl pointer-events-none"
              style={{ background: (deceiver?.color || '#a259ff') + '30' }}
            />
          </div>
          <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/35 mb-2">Deceiver is writing</div>
          <h2 className="font-display font-bold text-2xl sm:text-3xl text-white mb-2">
            <span style={{ color: deceiver?.color }}>{deceiver?.name}</span> is the Deceiver
          </h2>
          <p className="text-white/40 text-sm">
            They're crafting their web of lies in the{' '}
            <span className="text-plasma font-medium">{category}</span> category…
          </p>
        </div>

        <div className="glass rounded-2xl border border-white/[0.08] p-6 w-full max-w-sm text-center">
          <TimerRing seconds={timer} max={timerMax} size={80} />
          <p className="text-white/25 text-xs mt-4 font-mono tracking-wider">
            Waiting for statements…
          </p>
        </div>

        {/* Placeholder statement cards */}
        <div className="flex flex-col gap-2.5 w-full max-w-sm">
          {letters.map((letter, i) => (
            <div key={i} className="glass rounded-2xl border border-white/[0.06] p-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/[0.06] flex items-center justify-center font-display font-bold text-white/20">
                  {letter}
                </div>
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 bg-white/[0.05] rounded-full animate-pulse w-4/5" />
                  <div className="h-2.5 bg-white/[0.03] rounded-full animate-pulse w-3/5" style={{ animationDelay: `${i * 0.15}s` }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ── Deceiver writing screen ──
  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-10 gap-6 animate-slide-up">
      <div className="w-full max-w-lg">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 badge bg-signal/15 text-signal border border-signal/30 mb-4">
            <Drama className="w-3.5 h-3.5" strokeWidth={2.25} /> You are the Deceiver
          </div>
          <h2 className="font-display font-bold text-2xl sm:text-3xl text-white mb-2">
            Write 2 truths and 1 lie
          </h2>
          <p className="text-white/40 text-sm">
            Category:{' '}
            <span className="text-neon font-medium">{category}</span>
          </p>
        </div>

        {/* Statement inputs */}
        <div className="space-y-4 mb-6">
          {statements.map((stmt, i) => {
            const isLie = lieIndex === i
            return (
              <div key={i} className="relative">
                <div className="flex items-start gap-3">
                  {/* Letter / lie marker button */}
                  <button
                    onClick={() => setLieIndex(i)}
                    className={`flex-shrink-0 mt-3 w-10 h-10 rounded-xl flex items-center justify-center font-display font-bold text-sm transition-all duration-200 ${
                      isLie
                        ? 'bg-signal text-white shadow-[0_0_18px_rgba(255,107,53,0.4)] scale-105'
                        : 'bg-white/[0.07] text-white/40 hover:bg-white/12 hover:text-white/70'
                    }`}
                    title="Mark as the lie"
                  >
                    {letters[i]}
                  </button>

                  <div className="flex-1">
                    <textarea
                      className="input"
                      placeholder={`Statement ${letters[i]}${isLie ? ' — THE LIE' : ' — truth or lie…'}`}
                      value={stmt}
                      onChange={(e) => setStatement(i, e.target.value)}
                      rows={2}
                      maxLength={200}
                      style={{
                        borderColor: isLie ? 'rgba(255,107,53,0.5)' : undefined,
                        background:  isLie ? 'rgba(255,107,53,0.05)' : undefined,
                        boxShadow:   isLie ? '0 0 0 3px rgba(255,107,53,0.08)' : undefined,
                      }}
                    />
                    <div className="flex justify-between items-center mt-1.5 px-0.5">
                      <span className={`text-[11px] font-mono inline-flex items-center gap-1.5 transition-colors ${
                        isLie ? 'text-signal' : 'text-white/20'
                      }`}>
                        {isLie ? (
                          <><Drama className="w-3 h-3" /> This is the LIE</>
                        ) : (
                          <>Tap letter to mark as lie</>
                        )}
                      </span>
                      <span className="text-white/20 text-[11px] font-mono">{stmt.length}/200</span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Hint */}
        <div className="glass rounded-xl border border-white/[0.07] px-4 py-3.5 mb-6 flex gap-3">
          <Lightbulb className="w-4 h-4 flex-shrink-0 mt-0.5 text-gold/65" strokeWidth={2.25} />
          <p className="text-white/40 text-sm leading-relaxed">
            Make your lie believable. Specific, plausible statements are harder to detect.
            Tap a letter badge to mark it as the lie.
          </p>
        </div>

        {/* Submit */}
        <button
          className="btn btn-signal w-full py-4 text-base inline-flex items-center justify-center gap-2"
          disabled={!canSubmit}
          onClick={submitStatements}
        >
          {canSubmit ? (
            <><Send className="w-4 h-4" strokeWidth={2.25} /> Submit & Let the Game Begin</>
          ) : (
            <><PenLine className="w-4 h-4" strokeWidth={2.25} /> Fill all 3 statements and mark the lie</>
          )}
        </button>
      </div>
    </div>
  )
}
