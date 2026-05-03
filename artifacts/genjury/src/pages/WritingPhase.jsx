import React, { useRef, useCallback } from 'react'
import { Drama, Lightbulb, Send, PenLine, CheckCircle2, AlertCircle } from 'lucide-react'
import { motion, AnimatePresence, useAnimate } from 'framer-motion'
import useGameStore from '../lib/store'
import TimerRing from '../components/TimerRing'
import Avatar from '../components/Avatar'

const MIN_LEN  = 3
const MAX_LEN  = 200
const WARN_LEN = 160
const DANGER_LEN = 190
const LETTERS = ['A', 'B', 'C']

// ── Per-statement character count helpers ────────────────────────────────────
function countColor(len) {
  if (len < MIN_LEN)    return 'text-signal'
  if (len >= DANGER_LEN) return 'text-signal'
  if (len >= WARN_LEN)   return 'text-gold'
  return 'text-white/25'
}

function barColor(len) {
  if (len < MIN_LEN)    return 'rgba(192,91,48,0.70)'
  if (len >= DANGER_LEN) return 'rgba(192,91,48,0.85)'
  if (len >= WARN_LEN)   return 'rgba(245,200,66,0.75)'
  return 'rgba(61,184,122,0.55)'
}

// ── Small animated character-count bar ───────────────────────────────────────
function CharBar({ len }) {
  const pct   = Math.min((len / MAX_LEN) * 100, 100)
  const ready = len >= MIN_LEN
  const color = barColor(len)

  return (
    <div className="relative h-[2px] w-full bg-white/[0.06] rounded-full overflow-hidden mt-1.5">
      <motion.div
        className="absolute inset-y-0 left-0 rounded-full"
        style={{ background: color }}
        animate={{ width: `${pct}%` }}
        transition={{ type: 'spring', stiffness: 320, damping: 28, mass: 0.6 }}
      />
      {/* Glow pulse when exactly hitting MIN_LEN */}
      <AnimatePresence>
        {ready && len === MIN_LEN && (
          <motion.div
            key="ready-flash"
            className="absolute inset-0 rounded-full"
            style={{ background: color }}
            initial={{ opacity: 0.8 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Count pill (animates on every keystroke) ─────────────────────────────────
function CountPill({ len }) {
  const remaining = MAX_LEN - len
  const color     = countColor(len)
  const isShort   = len < MIN_LEN
  const isNear    = len >= WARN_LEN

  return (
    <div className={`flex items-center gap-1.5 text-[11px] font-mono transition-colors duration-200 ${color}`}>
      {/* Animated digit */}
      <AnimatePresence mode="popLayout">
        <motion.span
          key={len}
          initial={{ y: -5, opacity: 0 }}
          animate={{ y: 0,  opacity: 1 }}
          exit={{    y:  5, opacity: 0 }}
          transition={{ duration: 0.12, ease: 'easeOut' }}
          className="tabular-nums inline-block"
        >
          {len}
        </motion.span>
      </AnimatePresence>
      <span className="text-white/20">/ {MAX_LEN}</span>

      {/* Context label */}
      <AnimatePresence mode="wait">
        {isShort && len > 0 && (
          <motion.span
            key="short"
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{    opacity: 0, x:  4 }}
            transition={{ duration: 0.15 }}
            className="text-signal/70"
          >
            · need {MIN_LEN - len} more
          </motion.span>
        )}
        {isNear && (
          <motion.span
            key="near"
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{    opacity: 0, x:  4 }}
            transition={{ duration: 0.15 }}
          >
            · {remaining} left
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Statement readiness dot on the letter badge ──────────────────────────────
function ReadinessDot({ ready }) {
  return (
    <AnimatePresence>
      {ready && (
        <motion.span
          key="dot"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{    scale: 0, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 22 }}
          className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-neon border-2 border-void flex items-center justify-center"
          style={{ boxShadow: '0 0 5px rgba(61,184,122,0.45)' }}
        />
      )}
    </AnimatePresence>
  )
}

// ── Overall completion tracker ───────────────────────────────────────────────
function CompletionTracker({ statements, lieIndex }) {
  const filled  = statements.filter(s => s.trim().length >= MIN_LEN).length
  const hasLie  = lieIndex !== null
  const allDone = filled === 3 && hasLie

  return (
    <div className="flex items-center gap-3 mb-6">
      {/* Statement dots */}
      <div className="flex items-center gap-1.5">
        {statements.map((s, i) => {
          const ok = s.trim().length >= MIN_LEN
          return (
            <motion.div
              key={i}
              animate={{
                background: ok ? 'rgba(61,184,122,0.80)' : 'rgba(255,255,255,0.12)',
                boxShadow:  ok ? '0 0 5px rgba(61,184,122,0.40)' : 'none',
                scale: ok ? 1.1 : 1,
              }}
              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
              className="w-2 h-2 rounded-full"
            />
          )
        })}
      </div>
      <span className="text-[10px] font-mono text-white/30 uppercase tracking-widest">
        {filled}/3 statements
      </span>

      <div className="h-3 w-px bg-white/10" />

      {/* Lie dot */}
      <motion.div
        animate={{
          background: hasLie ? 'rgba(192,91,48,0.85)' : 'rgba(255,255,255,0.12)',
          boxShadow:  hasLie ? '0 0 6px rgba(192,91,48,0.50)' : 'none',
          scale: hasLie ? 1.1 : 1,
        }}
        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
        className="w-2 h-2 rounded-full"
      />
      <span className={`text-[10px] font-mono uppercase tracking-widest transition-colors duration-300 ${
        hasLie ? 'text-signal/70' : 'text-white/30'
      }`}>
        {hasLie ? 'lie marked' : 'mark lie'}
      </span>

      {/* All done badge */}
      <AnimatePresence>
        {allDone && (
          <motion.span
            key="done"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{    scale: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 22 }}
            className="ml-auto inline-flex items-center gap-1 text-[10px] font-mono font-semibold text-neon"
          >
            <CheckCircle2 className="w-3 h-3" strokeWidth={2.5} />
            Ready
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── "Mark the lie" nudge (pulses when all filled but no lie picked) ───────────
function LieNudge({ visible }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="lie-nudge"
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{    opacity: 0, y: -4 }}
          transition={{ duration: 0.25 }}
          className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-signal/[0.08] border border-signal/25 mb-4"
        >
          <motion.span
            animate={{ opacity: [1, 0.4, 1] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
          >
            <AlertCircle className="w-4 h-4 text-signal flex-shrink-0" strokeWidth={2} />
          </motion.span>
          <p className="text-signal/80 text-xs font-medium">
            Now tap a letter badge to mark which statement is the lie
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function WritingPhase() {
  const players          = useGameStore((s) => s.players)
  const myId             = useGameStore((s) => s.myId)
  const deceiverIndex    = useGameStore((s) => s.deceiverIndex)
  const category         = useGameStore((s) => s.category)
  const statements       = useGameStore((s) => s.statements)
  const lieIndex         = useGameStore((s) => s.lieIndex)
  const setStatement     = useGameStore((s) => s.setStatement)
  const setLieIndex      = useGameStore((s) => s.setLieIndex)
  const submitStatements = useGameStore((s) => s.submitStatements)
  const timer            = useGameStore((s) => s.timer)
  const timerMax         = useGameStore((s) => s.timerMax)

  const deceiver   = players[deceiverIndex]
  const isDeceiver = deceiver?.id === myId
  const canSubmit  = statements.every((s) => s.trim().length >= MIN_LEN) && lieIndex !== null

  // All statements filled but no lie selected yet
  const allFilledNoLie = statements.every((s) => s.trim().length >= MIN_LEN) && lieIndex === null

  // Shake the button on invalid submit attempt
  const [btnScope, animateBtn] = useAnimate()

  const handleSubmitClick = useCallback(() => {
    if (!canSubmit) {
      animateBtn(btnScope.current, {
        x: [0, -8, 8, -6, 6, -3, 3, 0],
      }, {
        duration: 0.45,
        ease:     'easeInOut',
      })
      return
    }
    submitStatements()
  }, [canSubmit, submitStatements, animateBtn, btnScope])

  React.useEffect(() => {
    if (timer === 0 && isDeceiver && canSubmit) submitStatements()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timer])

  // ── Waiting screen (non-deceiver) ────────────────────────────────────────
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
          <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/35 mb-2">
            Deceiver is writing
          </div>
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

        {/* Skeleton placeholder cards */}
        <div className="flex flex-col gap-2.5 w-full max-w-sm">
          {LETTERS.map((letter, i) => (
            <div key={i} className="glass rounded-2xl border border-white/[0.06] p-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/[0.06] flex items-center justify-center font-display font-bold text-white/20">
                  {letter}
                </div>
                <div className="flex-1 space-y-1.5">
                  <div
                    className="h-3 bg-white/[0.05] rounded-full skeleton"
                    style={{ width: `${65 + i * 10}%`, animationDelay: `${i * 0.2}s` }}
                  />
                  <div
                    className="h-2.5 bg-white/[0.03] rounded-full skeleton"
                    style={{ width: `${45 + i * 8}%`, animationDelay: `${i * 0.2 + 0.1}s` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ── Deceiver writing screen ───────────────────────────────────────────────
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

        {/* Completion tracker */}
        <CompletionTracker statements={statements} lieIndex={lieIndex} />

        {/* Lie nudge */}
        <LieNudge visible={allFilledNoLie} />

        {/* Statement inputs */}
        <div className="space-y-4 mb-6">
          {statements.map((stmt, i) => {
            const isLie  = lieIndex === i
            const len    = stmt.length
            const ready  = stmt.trim().length >= MIN_LEN
            const isNear = len >= WARN_LEN

            return (
              <motion.div
                key={i}
                layout
                className="relative"
                animate={{
                  // Subtle lift on the active lie card
                  y: isLie ? -2 : 0,
                }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              >
                <div className="flex items-start gap-3">
                  {/* Letter / lie marker button */}
                  <div className="relative flex-shrink-0 mt-3">
                    <motion.button
                      onClick={() => setLieIndex(i)}
                      aria-label={`Mark statement ${LETTERS[i]} as the lie`}
                      aria-pressed={isLie}
                      className={`w-10 h-10 rounded-xl flex items-center justify-center font-display font-bold text-sm transition-colors duration-200 ${
                        isLie
                          ? 'bg-signal text-white'
                          : 'bg-white/[0.07] text-white/40 hover:bg-white/12 hover:text-white/70'
                      }`}
                      style={{
                        boxShadow: isLie ? '0 0 14px rgba(192,91,48,0.32)' : undefined,
                      }}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{  scale: 0.92 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 22 }}
                    >
                      {LETTERS[i]}
                    </motion.button>
                    <ReadinessDot ready={ready} />
                  </div>

                  <div className="flex-1">
                    <textarea
                      className="input"
                      placeholder={`Statement ${LETTERS[i]}${isLie ? ' — THE LIE' : ' — truth or lie…'}`}
                      value={stmt}
                      onChange={(e) => setStatement(i, e.target.value)}
                      rows={2}
                      maxLength={MAX_LEN}
                      aria-label={`Statement ${LETTERS[i]}`}
                      aria-describedby={`char-count-${i}`}
                      style={{
                        borderColor: isLie
                          ? 'rgba(192,91,48,0.40)'
                          : ready
                          ? 'rgba(61,184,122,0.14)'
                          : undefined,
                        background: isLie
                          ? 'rgba(192,91,48,0.05)'
                          : undefined,
                        boxShadow: isLie
                          ? '0 0 0 3px rgba(192,91,48,0.07)'
                          : ready
                          ? '0 0 0 2px rgba(61,184,122,0.05)'
                          : undefined,
                      }}
                    />

                    {/* Animated fill bar */}
                    <CharBar len={len} />

                    {/* Bottom row: lie label + count */}
                    <div
                      id={`char-count-${i}`}
                      className="flex justify-between items-center mt-1.5 px-0.5"
                    >
                      <span className={`text-[11px] font-mono inline-flex items-center gap-1.5 transition-colors duration-200 ${
                        isLie ? 'text-signal' : 'text-white/20'
                      }`}>
                        {isLie ? (
                          <><Drama className="w-3 h-3" /> This is the LIE</>
                        ) : (
                          <>Tap letter to mark as lie</>
                        )}
                      </span>
                      <CountPill len={len} />
                    </div>
                  </div>
                </div>
              </motion.div>
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

        {/* Submit — shakes on invalid click */}
        <motion.button
          ref={btnScope}
          onClick={handleSubmitClick}
          aria-disabled={!canSubmit}
          className={`btn w-full py-4 text-base inline-flex items-center justify-center gap-2 transition-all duration-300 ${
            canSubmit
              ? 'btn-signal cursor-pointer'
              : 'bg-white/[0.05] border border-white/10 text-white/30 cursor-pointer'
          }`}
          whileHover={canSubmit ? { y: -1 } : {}}
          whileTap={canSubmit ? { scale: 0.97 } : {}}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        >
          {canSubmit ? (
            <>
              <Send className="w-4 h-4" strokeWidth={2.25} />
              Submit &amp; Let the Game Begin
            </>
          ) : (
            <>
              <PenLine className="w-4 h-4" strokeWidth={2.25} />
              {statements.some(s => s.trim().length < MIN_LEN)
                ? 'Fill all 3 statements (min 3 chars each)'
                : 'Tap a letter badge to mark the lie'}
            </>
          )}
        </motion.button>

        {/* Validation summary below the button */}
        <AnimatePresence>
          {!canSubmit && statements.some(s => s.length > 0) && (
            <motion.div
              key="validation"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{    opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="mt-3 overflow-hidden"
            >
              <div className="flex flex-wrap gap-2 justify-center">
                {statements.map((s, i) => {
                  const ok = s.trim().length >= MIN_LEN
                  return (
                    <span
                      key={i}
                      className={`inline-flex items-center gap-1 text-[11px] font-mono px-2 py-1 rounded-lg border ${
                        ok
                          ? 'bg-neon/[0.07] border-neon/20 text-neon/70'
                          : 'bg-signal/[0.07] border-signal/20 text-signal/60'
                      }`}
                    >
                      {ok
                        ? <CheckCircle2 className="w-3 h-3" strokeWidth={2.5} />
                        : <AlertCircle  className="w-3 h-3" strokeWidth={2.5} />}
                      {LETTERS[i]}: {ok ? 'ready' : `${s.trim().length}/${MIN_LEN}`}
                    </span>
                  )
                })}
                <span className={`inline-flex items-center gap-1 text-[11px] font-mono px-2 py-1 rounded-lg border ${
                  lieIndex !== null
                    ? 'bg-neon/[0.07] border-neon/20 text-neon/70'
                    : 'bg-signal/[0.07] border-signal/20 text-signal/60'
                }`}>
                  {lieIndex !== null
                    ? <CheckCircle2 className="w-3 h-3" strokeWidth={2.5} />
                    : <AlertCircle  className="w-3 h-3" strokeWidth={2.5} />}
                  lie: {lieIndex !== null ? `${LETTERS[lieIndex]} marked` : 'none'}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  )
}
