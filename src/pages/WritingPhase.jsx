import React from 'react'
import { Drama, Lightbulb, Send } from 'lucide-react'
import useGameStore from '../lib/store'
import TimerRing from '../components/TimerRing'
import Avatar from '../components/Avatar'

export default function WritingPhase() {
  const players = useGameStore(s => s.players)
  const myId = useGameStore(s => s.myId)
  const deceiverIndex = useGameStore(s => s.deceiverIndex)
  const category = useGameStore(s => s.category)
  const statements = useGameStore(s => s.statements)
  const lieIndex = useGameStore(s => s.lieIndex)
  const setStatement = useGameStore(s => s.setStatement)
  const setLieIndex = useGameStore(s => s.setLieIndex)
  const submitStatements = useGameStore(s => s.submitStatements)
  const timer = useGameStore(s => s.timer)
  const timerMax = useGameStore(s => s.timerMax)

  const deceiver = players[deceiverIndex]
  const isDeceiver = deceiver?.id === myId
  const letters = ['A', 'B', 'C']
  const canSubmit = statements.every(s => s.trim().length >= 3) && lieIndex !== null

  // Auto-submit when timer runs out
  React.useEffect(() => {
    if (timer === 0 && isDeceiver) {
      // Auto-fill if needed and submit
      if (canSubmit) submitStatements()
    }
  }, [timer])

  if (!isDeceiver) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 gap-8 animate-fade-in">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <Avatar name={deceiver?.name} color={deceiver?.color} size={64} />
          </div>
          <h2 className="font-display text-3xl font-700 text-white mb-2">
            <span style={{ color: deceiver?.color }}>{deceiver?.name}</span> is the Deceiver
          </h2>
          <p className="text-white/40">They're crafting their web of lies in the <span className="text-plasma">{category}</span> category…</p>
        </div>

        <div className="card w-full max-w-sm text-center">
          <TimerRing seconds={timer} max={timerMax} size={80} />
          <p className="text-white/30 text-xs mt-4 font-mono">Waiting for statements…</p>
        </div>

        <div className="flex flex-col gap-3 w-full max-w-sm">
          {['Statement A', 'Statement B', 'Statement C'].map((label, i) => (
            <div key={i} className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/[0.07] flex items-center justify-center font-display font-700 text-white/30">
                  {letters[i]}
                </div>
                <div className="flex-1 h-4 bg-white/[0.06] rounded-full animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-8 gap-6 animate-slide-up">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <span className="badge bg-signal/20 text-signal border border-signal/30 text-sm mb-4 inline-flex items-center gap-1.5">
            <Drama className="w-3.5 h-3.5" strokeWidth={2.25} /> You are the Deceiver
          </span>
          <h2 className="font-display text-3xl font-700 text-white mb-2">
            Write 2 truths and 1 lie
          </h2>
          <p className="text-white/40">
            Category: <span className="text-neon">{category}</span>
          </p>
        </div>

        {/* Statements */}
        <div className="space-y-4 mb-6">
          {statements.map((stmt, i) => (
            <div key={i} className="relative">
              <div className="flex items-start gap-3">
                <button
                  onClick={() => setLieIndex(i)}
                  className={`flex-shrink-0 mt-3 w-9 h-9 rounded-xl flex items-center justify-center font-display font-700 text-sm transition-all ${
                    lieIndex === i
                      ? 'bg-signal text-white shadow-lg'
                      : 'bg-white/[0.07] text-white/40 hover:bg-white/10'
                  }`}
                  title="Mark as the lie"
                >
                  {letters[i]}
                </button>
                <div className="flex-1">
                  <textarea
                    className="input"
                    placeholder={`Statement ${letters[i]}${lieIndex === i ? ' (THE LIE)' : ' — write a truth or lie…'}`}
                    value={stmt}
                    onChange={e => setStatement(i, e.target.value)}
                    rows={2}
                    maxLength={200}
                    style={{ borderColor: lieIndex === i ? '#ff6b35' : undefined }}
                  />
                  <div className="flex justify-between mt-1">
                    <span className={`text-xs font-mono inline-flex items-center gap-1 ${lieIndex === i ? 'text-signal' : 'text-white/20'}`}>
                      {lieIndex === i ? (<><Drama className="w-3 h-3" /> This is the LIE</>) : 'Tap letter to mark as lie'}
                    </span>
                    <span className="text-white/20 text-xs">{stmt.length}/200</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Hint */}
        <div className="card bg-white/[0.03] border-white/[0.06] mb-6">
          <div className="flex gap-3 text-sm text-white/40">
            <Lightbulb className="w-4 h-4 flex-shrink-0 mt-0.5 text-gold/70" strokeWidth={2.25} />
            <p>Make your lie believable. The more specific and plausible it sounds, the harder it is to detect. Tap a letter to mark it as the lie.</p>
          </div>
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
            'Fill all 3 statements and mark the lie'
          )}
        </button>
      </div>
    </div>
  )
}
