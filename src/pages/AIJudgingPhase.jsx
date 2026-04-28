import React, { useEffect, useState } from 'react'

const REASONING_STEPS = [
  'Loading Intelligent Contract on GenLayer…',
  'Applying Equivalence Principle to non-deterministic LLM output…',
  'Cross-referencing validator nodes for consensus…',
  'Analyzing semantic patterns and plausibility scores…',
  'Running Optimistic Democracy protocol…',
  'Finalizing verdict…',
]

export default function AIJudgingPhase() {
  const [step, setStep] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setStep(s => Math.min(s + 1, REASONING_STEPS.length - 1))
    }, 900)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 gap-8 animate-fade-in">
      {/* AI Brain animation */}
      <div className="relative">
        <div className="w-32 h-32 rounded-full bg-plasma/10 border border-plasma/30 flex items-center justify-center relative">
          {/* Orbit rings */}
          <div className="absolute inset-0 rounded-full border border-plasma/20 animate-spin-slow" style={{ animationDuration: '3s' }} />
          <div className="absolute inset-2 rounded-full border border-ice/15 animate-spin-slow" style={{ animationDuration: '5s', animationDirection: 'reverse' }} />
          <div className="absolute inset-4 rounded-full border border-neon/10 animate-spin-slow" style={{ animationDuration: '7s' }} />
          <span className="text-4xl relative z-10">🤖</span>
        </div>
        {/* Pulsing glow */}
        <div className="absolute inset-0 bg-plasma/20 rounded-full blur-2xl animate-pulse" />
      </div>

      <div className="text-center">
        <h2 className="font-display text-3xl font-700 animate-glow-pulse text-plasma mb-2">
          AI Judge Deliberating
        </h2>
        <p className="text-white/40 text-sm">The Intelligent Contract is analyzing all statements</p>
      </div>

      {/* Step tracker */}
      <div className="w-full max-w-sm space-y-2">
        {REASONING_STEPS.map((s, i) => (
          <div
            key={i}
            className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-500 ${
              i <= step
                ? 'bg-plasma/10 border border-plasma/20'
                : 'bg-white/[0.03] border border-white/[0.05] opacity-30'
            }`}
          >
            <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
              i < step ? 'bg-neon' : i === step ? 'bg-plasma animate-pulse' : 'bg-white/10'
            }`}>
              {i < step && <span className="text-black text-xs font-700">✓</span>}
              {i === step && <div className="w-2 h-2 rounded-full bg-white animate-ping" />}
            </div>
            <span className={`text-xs font-mono ${i <= step ? 'text-white/70' : 'text-white/20'}`}>{s}</span>
          </div>
        ))}
      </div>

      <div className="text-white/20 text-xs font-mono text-center">
        Powered by GenLayer Validators · Non-deterministic LLM + Consensus
      </div>
    </div>
  )
}
