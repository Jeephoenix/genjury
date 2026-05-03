import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Eye, Check, Drama, TrendingUp, TrendingDown, Zap, AlertTriangle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import useGameStore from '../lib/store'
import StatementCard from '../components/StatementCard'
import Avatar from '../components/Avatar'

// ── XP math ──────────────────────────────────────────────────────────────────
// Base XP for a correct vote at minimum confidence is 30.
// Multiplier scales linearly from ×0.8 at 10% confidence to ×3.0 at 100%.
// Penalty for wrong vote = floor(base × confidence × 0.6).
const BASE_XP = 30

function getMultiplier(confidence) {
  return 0.8 + confidence * 2.2
}

function getXpIfRight(confidence) {
  return Math.round(BASE_XP * getMultiplier(confidence))
}

function getPenaltyIfWrong(confidence) {
  return Math.max(0, Math.round(BASE_XP * confidence * 0.55))
}

// ── Risk tier ─────────────────────────────────────────────────────────────────
function getRiskTier(confidence) {
  if (confidence < 0.35) return { label: 'Safe bet',    color: '#7fff6e', bg: 'rgba(127,255,110,0.10)', border: 'rgba(127,255,110,0.25)' }
  if (confidence < 0.65) return { label: 'Confident',   color: '#38d9f5', bg: 'rgba(56,217,245,0.10)',  border: 'rgba(56,217,245,0.25)' }
  if (confidence < 0.85) return { label: 'High stakes', color: '#f5c842', bg: 'rgba(245,200,66,0.09)',  border: 'rgba(245,200,66,0.25)' }
  return                         { label: 'All-in',      color: '#ff6b35', bg: 'rgba(255,107,53,0.09)',  border: 'rgba(255,107,53,0.3)' }
}

// ── Track gradient string ─────────────────────────────────────────────────────
function trackGradient(pct) {
  // Filled portion blends neon → ice → gold → signal across the track
  return `linear-gradient(90deg,
    #7fff6e 0%,
    #38d9f5 40%,
    #f5c842 70%,
    #ff6b35 100%
  )`
}

// ── Custom slider ─────────────────────────────────────────────────────────────
function ConfidenceSlider({ value, onChange }) {
  const pct     = Math.round(value * 100)
  const tier    = getRiskTier(value)
  const trackEl = useRef(null)

  // Compute thumb left% for positioning the floating label
  const thumbLeft = `calc(${pct}% - ${pct * 0.18}px)`

  return (
    <div className="relative select-none">
      {/* Floating percentage pill above the thumb */}
      <div
        className="absolute -top-8 flex flex-col items-center pointer-events-none"
        style={{ left: thumbLeft, transform: 'translateX(-50%)' }}
        aria-hidden="true"
      >
        <motion.div
          key={Math.round(value * 10)}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1,   opacity: 1 }}
          transition={{ type: 'spring', stiffness: 420, damping: 28 }}
          className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold shadow-lg"
          style={{
            background: tier.bg,
            border:     `1px solid ${tier.border}`,
            color:      tier.color,
          }}
        >
          {pct}%
        </motion.div>
        {/* Caret */}
        <div
          className="w-0 h-0"
          style={{
            borderLeft:  '4px solid transparent',
            borderRight: '4px solid transparent',
            borderTop:   `5px solid ${tier.color}`,
            opacity: 0.6,
          }}
        />
      </div>

      {/* Custom track */}
      <div
        ref={trackEl}
        className="relative h-3 rounded-full overflow-hidden"
        style={{ background: 'rgba(255,255,255,0.08)' }}
      >
        {/* Filled portion */}
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ background: trackGradient(pct) }}
          animate={{ width: `${pct}%` }}
          transition={{ type: 'spring', stiffness: 300, damping: 30, mass: 0.5 }}
        />
        {/* Glow on filled edge */}
        <motion.div
          className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full shadow-lg ring-2 ring-void"
          style={{
            background: tier.color,
            boxShadow:  `0 0 10px ${tier.color}, 0 0 20px ${tier.color}55`,
          }}
          animate={{ left: `calc(${pct}% - 7px)` }}
          transition={{ type: 'spring', stiffness: 300, damping: 30, mass: 0.5 }}
        />
      </div>

      {/* Hidden native range for interaction */}
      <input
        type="range"
        min={10}
        max={100}
        value={pct}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        className="absolute inset-0 w-full opacity-0 cursor-pointer h-3"
        aria-label={`Confidence level: ${pct}%`}
        aria-valuemin={10}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-valuetext={`${pct}% — ${tier.label}`}
      />
    </div>
  )
}

// ── Bet preview card ──────────────────────────────────────────────────────────
function BetPreview({ confidence, visible }) {
  const xpRight   = getXpIfRight(confidence)
  const xpWrong   = getPenaltyIfWrong(confidence)
  const multiplier = getMultiplier(confidence).toFixed(1)
  const tier       = getRiskTier(confidence)

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="bet-preview"
          initial={{ opacity: 0, height: 0, marginTop: 0 }}
          animate={{ opacity: 1, height: 'auto', marginTop: 12 }}
          exit={{    opacity: 0, height: 0, marginTop: 0 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          style={{ overflow: 'hidden' }}
        >
          <div
            className="rounded-xl p-4 border"
            style={{ background: tier.bg, borderColor: tier.border }}
          >
            {/* Tier badge */}
            <div className="flex items-center justify-between mb-3">
              <span
                className="inline-flex items-center gap-1.5 text-[11px] font-mono font-semibold uppercase tracking-widest px-2.5 py-1 rounded-full"
                style={{ color: tier.color, background: 'rgba(0,0,0,0.25)', border: `1px solid ${tier.border}` }}
              >
                <Zap className="w-3 h-3" strokeWidth={2.5} />
                {tier.label}
              </span>
              <span
                className="text-xs font-mono font-bold"
                style={{ color: tier.color }}
              >
                ×{multiplier} XP
              </span>
            </div>

            {/* Win / Loss split */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-lg px-3 py-2.5 bg-neon/[0.08] border border-neon/25 flex items-center gap-2">
                <TrendingUp className="w-3.5 h-3.5 text-neon flex-shrink-0" strokeWidth={2.5} />
                <div>
                  <div className="text-[10px] text-white/35 font-mono uppercase tracking-wide mb-0.5">If correct</div>
                  <div className="font-display font-bold text-neon text-sm">+{xpRight} XP</div>
                </div>
              </div>
              <div className="rounded-lg px-3 py-2.5 bg-signal/[0.08] border border-signal/25 flex items-center gap-2">
                <TrendingDown className="w-3.5 h-3.5 text-signal flex-shrink-0" strokeWidth={2.5} />
                <div>
                  <div className="text-[10px] text-white/35 font-mono uppercase tracking-wide mb-0.5">If wrong</div>
                  <div className="font-display font-bold text-signal text-sm">
                    {xpWrong > 0 ? `-${xpWrong} XP` : '—'}
                  </div>
                </div>
              </div>
            </div>

            {/* High-stakes warning */}
            {confidence >= 0.85 && (
              <motion.p
                key="warning"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-2.5 text-[11px] font-mono text-signal/75 flex items-center gap-1.5"
              >
                <AlertTriangle className="w-3 h-3 flex-shrink-0" strokeWidth={2.5} />
                High risk — you'll take a credibility hit if wrong.
              </motion.p>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function VotingPhase() {
  const players          = useGameStore((s) => s.players)
  const myId             = useGameStore((s) => s.myId)
  const deceiverIndex    = useGameStore((s) => s.deceiverIndex)
  const statements       = useGameStore((s) => s.statements)
  const votes            = useGameStore((s) => s.votes)
  const castVote         = useGameStore((s) => s.castVote)
  const proceedToAIJudge = useGameStore((s) => s.proceedToAIJudge)
  const timer            = useGameStore((s) => s.timer)

  const [myVote,       setMyVote]       = useState(null)
  const [myConfidence, setMyConfidence] = useState(0.5)
  const [submitted,    setSubmitted]    = useState(false)
  const [prevConfidence, setPrevConfidence] = useState(0.5)

  const deceiver      = players[deceiverIndex]
  const isDeceiver    = deceiver?.id === myId
  const voterCount    = Object.keys(votes).length
  const detectorCount = players.filter((p) => p.id !== deceiver?.id).length
  const votePct       = detectorCount > 0 ? (voterCount / detectorCount) * 100 : 0

  const tier = getRiskTier(myConfidence)

  useEffect(() => {
    if (timer === 0 || voterCount >= detectorCount) {
      const t = setTimeout(() => proceedToAIJudge(), 1500)
      return () => clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timer, voterCount, detectorCount])

  const handleConfidenceChange = useCallback((val) => {
    setPrevConfidence(myConfidence)
    setMyConfidence(val)
  }, [myConfidence])

  const handleSubmit = () => {
    if (myVote === null) return
    castVote(myId, myVote, myConfidence)
    setSubmitted(true)
  }

  const confidencePct = Math.round(myConfidence * 100)
  const xpIfRight     = getXpIfRight(myConfidence)
  const penalty       = getPenaltyIfWrong(myConfidence)
  const multiplier    = getMultiplier(myConfidence).toFixed(1)

  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-10 gap-6 animate-slide-up">
      <div className="w-full max-w-lg">

        {/* ── Header ── */}
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

        {/* ── Statements ── */}
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

        {/* ── Confidence slider + bet preview ── */}
        {!isDeceiver && !submitted && (
          <AnimatePresence>
            {myVote !== null && (
              <motion.div
                key="slider-panel"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{    opacity: 0, y: 8 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className="glass rounded-2xl border border-white/[0.08] p-5 mb-5"
              >
                {/* Section heading */}
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <p className="text-white/70 text-sm font-semibold leading-tight">
                      How confident are you?
                    </p>
                    <p className="text-white/30 text-xs mt-0.5">
                      Higher confidence = bigger XP reward, bigger risk
                    </p>
                  </div>
                  {/* Live multiplier badge */}
                  <motion.div
                    key={Math.round(myConfidence * 10)}
                    initial={{ scale: 0.75, opacity: 0 }}
                    animate={{ scale: 1,    opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    className="flex-shrink-0 flex flex-col items-center justify-center w-14 h-14 rounded-xl border"
                    style={{
                      background:   tier.bg,
                      borderColor:  tier.border,
                      boxShadow:    `0 0 18px ${tier.color}22`,
                    }}
                  >
                    <span
                      className="font-display font-black text-lg leading-none"
                      style={{ color: tier.color }}
                    >
                      ×{multiplier}
                    </span>
                    <span className="text-[9px] font-mono uppercase tracking-wider mt-0.5" style={{ color: tier.color + 'aa' }}>
                      XP
                    </span>
                  </motion.div>
                </div>

                {/* Slider */}
                <div className="pt-8 pb-2">
                  <ConfidenceSlider
                    value={myConfidence}
                    onChange={handleConfidenceChange}
                  />
                </div>

                {/* Min / Max labels — animate opacity/scale near their extreme */}
                <div className="flex justify-between mt-3">
                  <motion.span
                    className="text-[11px] font-mono flex items-center gap-1"
                    animate={{
                      color:    myConfidence < 0.3 ? tier.color : 'rgba(255,255,255,0.3)',
                      scale:    myConfidence < 0.25 ? 1.05 : 1,
                      fontWeight: myConfidence < 0.3 ? 600 : 400,
                    }}
                    transition={{ duration: 0.2 }}
                  >
                    😬 Uncertain
                  </motion.span>
                  <motion.span
                    className="text-[11px] font-mono flex items-center gap-1"
                    animate={{
                      color:    myConfidence > 0.75 ? tier.color : 'rgba(255,255,255,0.3)',
                      scale:    myConfidence > 0.88 ? 1.05 : 1,
                      fontWeight: myConfidence > 0.75 ? 600 : 400,
                    }}
                    transition={{ duration: 0.2 }}
                  >
                    🔥 Dead sure
                  </motion.span>
                </div>

                {/* Bet preview */}
                <BetPreview confidence={myConfidence} visible={myVote !== null} />
              </motion.div>
            )}
          </AnimatePresence>
        )}

        {/* ── Submit / deceiver / submitted states ── */}
        {isDeceiver ? (
          <div
            className="glass rounded-2xl border border-signal/20 px-5 py-4 text-center mb-5"
            style={{ background: 'rgba(255,107,53,0.05)' }}
          >
            <p className="text-signal text-sm inline-flex items-center gap-2 justify-center font-medium">
              <Drama className="w-4 h-4" strokeWidth={2} />
              You're the Deceiver — sit back and watch them squirm
            </p>
          </div>
        ) : submitted ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            className="glass rounded-2xl border border-neon/25 px-5 py-4 text-center mb-5"
            style={{ background: 'rgba(127,255,110,0.05)' }}
          >
            <p className="text-neon text-sm inline-flex items-center gap-2 justify-center font-semibold mb-1.5">
              <Check className="w-4 h-4" strokeWidth={2.5} />
              Vote locked at {confidencePct}% confidence
            </p>
            {/* Summary of the bet */}
            <div className="flex items-center justify-center gap-4 text-xs font-mono mt-2">
              <span className="text-neon/70">
                <TrendingUp className="w-3 h-3 inline mr-1" strokeWidth={2.5} />
                +{getXpIfRight(myConfidence)} XP if right
              </span>
              {getPenaltyIfWrong(myConfidence) > 0 && (
                <span className="text-signal/60">
                  <TrendingDown className="w-3 h-3 inline mr-1" strokeWidth={2.5} />
                  -{getPenaltyIfWrong(myConfidence)} XP if wrong
                </span>
              )}
            </div>
            <p className="text-white/25 text-xs mt-2">Waiting for other players…</p>
          </motion.div>
        ) : (
          <motion.button
            layout
            className="btn w-full py-4 text-base inline-flex items-center justify-center gap-2 mb-5"
            style={
              myVote === null
                ? { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.35)', border: '1px solid rgba(255,255,255,0.1)', cursor: 'not-allowed' }
                : { background: tier.color, color: myConfidence < 0.35 ? '#000' : '#fff', boxShadow: `0 4px 24px ${tier.color}44, inset 0 1px 0 rgba(255,255,255,0.2)` }
            }
            disabled={myVote === null}
            onClick={handleSubmit}
            whileHover={myVote !== null ? { y: -1 } : {}}
            whileTap={myVote !== null ? { scale: 0.97 } : {}}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          >
            <Eye className="w-4.5 h-4.5" strokeWidth={2.25} />
            {myVote === null
              ? 'Pick a statement first'
              : `Lock in — ${confidencePct}% confident`}
          </motion.button>
        )}

        {/* ── Vote progress ── */}
        <div className="glass rounded-2xl border border-white/[0.06] p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-white/35 text-xs font-mono uppercase tracking-wider">Votes cast</span>
            <span className="text-white/50 text-xs font-mono font-medium">
              {voterCount} / {detectorCount}
            </span>
          </div>

          <div className="h-1.5 bg-white/[0.07] rounded-full overflow-hidden mb-4">
            <motion.div
              className="h-full rounded-full"
              style={{
                background: 'linear-gradient(90deg, #a259ff, #38d9f5)',
                boxShadow: '0 0 8px rgba(162,89,255,0.4)',
              }}
              animate={{ width: `${votePct}%` }}
              transition={{ type: 'spring', stiffness: 120, damping: 20 }}
            />
          </div>

          <div className="flex gap-2 flex-wrap">
            {players.filter((p) => p.id !== deceiver?.id).map((p) => {
              const voted = votes[p.id] !== undefined
              return (
                <motion.div
                  key={p.id}
                  layout
                  animate={{
                    background: voted ? p.color + '18' : 'rgba(255,255,255,0.03)',
                    borderColor: voted ? p.color + '40' : 'rgba(255,255,255,0.06)',
                  }}
                  transition={{ duration: 0.3 }}
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs border"
                >
                  <Avatar name={p.name} color={p.color} size={16} />
                  <motion.span
                    animate={{ color: voted ? p.color : 'rgba(255,255,255,0.3)' }}
                    transition={{ duration: 0.3 }}
                  >
                    {p.name}
                  </motion.span>
                  <AnimatePresence>
                    {voted && (
                      <motion.span
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{   scale: 0, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                      >
                        <Check className="w-3 h-3" style={{ color: p.color }} strokeWidth={2.5} />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
