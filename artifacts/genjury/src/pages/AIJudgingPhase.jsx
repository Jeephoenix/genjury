import React, { useEffect, useState } from 'react'
import { Bot, Check, Cpu, Network, Zap, Scale } from 'lucide-react'

const REASONING_STEPS = [
  { text: 'Loading Intelligent Contract on GenLayer…',                Icon: Cpu },
  { text: 'Applying Equivalence Principle to LLM output…',           Icon: Scale },
  { text: 'Cross-referencing validator nodes for consensus…',        Icon: Network },
  { text: 'Analyzing semantic patterns and plausibility scores…',    Icon: Bot },
  { text: 'Running Optimistic Democracy protocol…',                  Icon: Zap },
  { text: 'Finalizing verdict…',                                     Icon: Check },
]

export default function AIJudgingPhase() {
  const [step, setStep] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setStep((s) => Math.min(s + 1, REASONING_STEPS.length - 1))
    }, 950)
    return () => clearInterval(interval)
  }, [])

  const pct = Math.round(((step + 1) / REASONING_STEPS.length) * 100)

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 gap-10 animate-fade-in">

      {/* AI Brain — enhanced orbit animation */}
      <div className="relative flex items-center justify-center overflow-hidden" style={{ width: '14rem', height: '14rem' }}>
        {/* Outermost pulse rings */}
        <div className="absolute w-56 h-56 rounded-full border border-plasma/10 animate-ping" style={{ animationDuration: '2.5s' }} />
        <div className="absolute w-48 h-48 rounded-full border border-plasma/15 animate-ping" style={{ animationDuration: '2s', animationDelay: '0.5s' }} />

        {/* Soft ambient glow */}
        <div className="absolute w-44 h-44 rounded-full bg-plasma/10 blur-3xl animate-hero-glow" />

        {/* Main circle */}
        <div className="relative w-36 h-36 rounded-full bg-gradient-to-br from-plasma/20 to-plasma/5 border border-plasma/40 flex items-center justify-center overflow-hidden">
          {/* Scan line */}
          <div
            className="absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-plasma/70 to-transparent animate-scan"
            style={{ top: '50%' }}
          />

          {/* Inner orbit rings */}
          <div className="absolute inset-0 rounded-full border border-plasma/25"
            style={{ animation: 'spin 3.5s linear infinite' }} />
          <div className="absolute inset-3 rounded-full border border-ice/20"
            style={{ animation: 'spin 5.5s linear infinite reverse' }} />
          <div className="absolute inset-6 rounded-full border border-neon/15"
            style={{ animation: 'spin 8s linear infinite' }} />

          {/* Center icon */}
          <Bot className="w-14 h-14 text-plasma relative z-10 drop-shadow-[0_0_12px_rgba(162,89,255,0.8)]" strokeWidth={1.5} />

          {/* Inner glow overlay */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-t from-plasma/15 to-transparent pointer-events-none" />
        </div>
      </div>

      {/* Title */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.2em] text-plasma/60 mb-1">
          <span className="w-1.5 h-1.5 rounded-full bg-plasma animate-pulse" />
          GenLayer Validator Network
        </div>
        <h2 className="font-display font-bold text-3xl sm:text-4xl text-white tracking-tight">
          AI Judge{' '}
          <span className="gradient-text-plasma">Deliberating</span>
        </h2>
        <p className="text-white/40 text-sm max-w-xs mx-auto">
          The Intelligent Contract is analyzing all statements on-chain
        </p>
      </div>

      {/* Progress bar */}
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-mono uppercase tracking-widest text-white/30">Progress</span>
          <span className="text-[10px] font-mono text-plasma/70">{pct}%</span>
        </div>
        <div className="h-1.5 bg-white/[0.07] rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-plasma to-ice rounded-full transition-all duration-700 ease-out"
            style={{ width: `${pct}%`, boxShadow: '0 0 10px rgba(162,89,255,0.5)' }}
          />
        </div>
      </div>

      {/* Step tracker */}
      <div className="w-full max-w-sm space-y-2">
        {REASONING_STEPS.map(({ text, Icon: StepIcon }, i) => {
          const done   = i < step
          const active = i === step
          return (
            <div
              key={i}
              className={`relative flex items-center gap-3.5 px-4 py-3 rounded-xl border transition-all duration-500 overflow-hidden ${
                done
                  ? 'bg-neon/[0.05] border-neon/20'
                  : active
                  ? 'bg-plasma/[0.09] border-plasma/30 shadow-[0_0_20px_rgba(162,89,255,0.08)]'
                  : 'bg-white/[0.02] border-white/[0.05] opacity-35'
              }`}
            >
              {/* Scan fill on active */}
              {active && (
                <div className="absolute inset-0 bg-gradient-to-r from-plasma/[0.04] to-transparent animate-fade-in" />
              )}

              {/* Status dot */}
              <div className={`relative w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
                done
                  ? 'bg-neon shadow-[0_0_8px_rgba(61,184,122,0.28)]'
                  : active
                  ? 'bg-plasma/20 border border-plasma/50'
                  : 'bg-white/[0.06] border border-white/10'
              }`}>
                {done && <Check className="w-3.5 h-3.5 text-black" strokeWidth={3} />}
                {active && (
                  <>
                    <div className="w-2 h-2 rounded-full bg-plasma animate-pulse" />
                    <div className="absolute inset-0 rounded-full border border-plasma/40 animate-ping" style={{ animationDuration: '1.2s' }} />
                  </>
                )}
                {!done && !active && <div className="w-1.5 h-1.5 rounded-full bg-white/20" />}
              </div>

              {/* Icon */}
              <StepIcon
                className={`w-3.5 h-3.5 flex-shrink-0 transition-colors ${
                  done ? 'text-neon/60' : active ? 'text-plasma' : 'text-white/20'
                }`}
                strokeWidth={2.25}
              />

              {/* Text */}
              <span className={`text-xs font-mono leading-snug relative transition-colors ${
                done ? 'text-white/50' : active ? 'text-white/80' : 'text-white/20'
              }`}>
                {text}
              </span>
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div className="flex items-center gap-2 text-white/20 text-xs font-mono">
        <div className="w-1.5 h-1.5 rounded-full bg-plasma/50 animate-pulse" />
        Powered by GenLayer Validators · Non-deterministic LLM + Consensus
      </div>
    </div>
  )
}
