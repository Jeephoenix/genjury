import React, { useState, useEffect, memo } from 'react'
import { Drama, Wallet, Droplet, Swords, ArrowRight, X } from 'lucide-react'
import { getNetworkInfo, getChainNativeSymbol } from '../lib/genlayer'

const KEY = 'genjury_onboarded_v1'

const STEP_COLORS = {
  plasma: {
    bg: 'bg-plasma/12',
    border: 'border-plasma/30',
    icon: 'text-plasma',
    glow: 'shadow-[0_0_60px_rgba(162,89,255,0.12)]',
    dot: 'bg-plasma',
    dotActive: 'bg-plasma shadow-[0_0_8px_#a259ff]',
  },
  neon: {
    bg: 'bg-crimson/10',
    border: 'border-crimson/25',
    icon: 'text-crimson',
    glow: 'shadow-[0_0_60px_rgba(232,0,45,0.10)]',
    dot: 'bg-crimson',
    dotActive: 'bg-crimson shadow-[0_0_8px_#e8002d]',
  },
  ice: {
    bg: 'bg-ice/10',
    border: 'border-ice/25',
    icon: 'text-ice',
    glow: 'shadow-[0_0_60px_rgba(56,217,245,0.10)]',
    dot: 'bg-ice',
    dotActive: 'bg-ice shadow-[0_0_8px_#38d9f5]',
  },
  gold: {
    bg: 'bg-gold/10',
    border: 'border-gold/25',
    icon: 'text-gold',
    glow: 'shadow-[0_0_60px_rgba(245,200,66,0.10)]',
    dot: 'bg-gold',
    dotActive: 'bg-gold shadow-[0_0_8px_#f5c842]',
  },
}

const OnboardingModal = memo(function OnboardingModal() {
  const [open, setOpen]   = useState(false)
  const [step, setStep]   = useState(0)
  const [exiting, setExiting] = useState(false)
  const net    = getNetworkInfo()
  const symbol = getChainNativeSymbol()

  useEffect(() => {
    try {
      if (!localStorage.getItem(KEY)) setOpen(true)
    } catch {}
  }, [])

  if (!open) return null

  const dismiss = () => {
    setExiting(true)
    setTimeout(() => {
      try { localStorage.setItem(KEY, '1') } catch {}
      setOpen(false)
    }, 220)
  }

  const steps = [
    {
      Icon: Drama,
      color: 'plasma',
      label: '01 / 04',
      title: 'Welcome to Genjury',
      body: 'A bluffing game judged by an on-chain AI. Write three statements — one a lie — and try to fool both your friends and the Judge.',
    },
    {
      Icon: Wallet,
      color: 'neon',
      label: '02 / 04',
      title: 'Connect a wallet',
      body: `Tap the wallet pill in the top-right and connect MetaMask (or any EIP-1193 wallet). You're playing on ${net.label}.`,
    },
    {
      Icon: Droplet,
      color: 'ice',
      label: '03 / 04',
      title: `Grab test ${symbol}`,
      body: `Each room has an entry fee in ${symbol}. Hit the "Get test ${symbol}" button in the wallet panel to claim free testnet tokens from the faucet.`,
    },
    {
      Icon: Swords,
      color: 'gold',
      label: '04 / 04',
      title: 'Create or join a room',
      body: 'Set the entry fee, share the room code with friends, and let the AI Judge decide who walks away with the pot.',
    },
  ]

  const isLast = step === steps.length - 1
  const cur    = steps[step]
  const C      = STEP_COLORS[cur.color]

  return (
    <div
      className={`fixed inset-0 z-[75] flex items-center justify-center px-4 transition-opacity duration-200 ${
        exiting ? 'opacity-0' : 'animate-fade-in'
      }`}
    >
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={dismiss} role="presentation" />

      <div className={`relative max-w-sm w-full modal-panel ${C.glow}`}>
        <div className={`glass-strong rounded-2xl border overflow-hidden ${C.border}`}>
          {/* Gradient top accent */}
          <div className={`h-px bg-gradient-to-r from-transparent via-current to-transparent ${C.icon} opacity-60`} />

          <div className="p-7 text-center space-y-6">
            {/* Step label + close */}
            <div className="flex items-center justify-between">
              <span className={`text-[10px] font-mono uppercase tracking-[0.2em] ${C.icon} opacity-60`}>
                {cur.label}
              </span>
              <button
                onClick={dismiss}
                className="w-7 h-7 rounded-lg bg-white/[0.05] border border-white/[0.08] text-white/30 hover:text-white transition-all flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
                aria-label="Close onboarding"
              >
                <X className="w-3.5 h-3.5" strokeWidth={2.5} />
              </button>
            </div>

            {/* Icon */}
            <div className="flex justify-center">
              <div className={`w-20 h-20 rounded-2xl ${C.bg} border ${C.border} flex items-center justify-center icon-bounce`}>
                <cur.Icon className={`w-9 h-9 ${C.icon}`} strokeWidth={1.75} />
              </div>
            </div>

            {/* Text */}
            <div>
              <h2 className="font-display font-bold text-xl text-white mb-2">{cur.title}</h2>
              <p className="text-white/60 text-sm leading-relaxed">{cur.body}</p>
            </div>

            {/* Step dots */}
            <div className="flex justify-center gap-2">
              {steps.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setStep(i)}
                  className={`rounded-full transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 ${
                    i === step
                      ? `w-6 h-2 ${C.dot}`
                      : 'w-2 h-2 bg-white/15 hover:bg-white/30'
                  }`}
                  aria-label={`Go to step ${i + 1}`}
                  aria-current={i === step ? 'step' : undefined}
                />
              ))}
            </div>

            {/* CTA buttons */}
            <div className="flex gap-2.5">
              {step > 0 && (
                <button
                  onClick={() => setStep((s) => s - 1)}
                  className="btn btn-ghost flex-1 py-2.5 text-sm"
                  aria-label="Go to previous step"
                >
                  Back
                </button>
              )}
              <button
                onClick={() => (isLast ? dismiss() : setStep((s) => s + 1))}
                className={`btn flex-1 py-2.5 text-sm inline-flex items-center justify-center gap-2 ${
                  cur.color === 'neon' ? 'btn-crimson' : cur.color === 'gold' ? 'btn-gold' : 'btn-plasma'
                }`}
                aria-label={isLast ? "Let's play" : 'Next step'}
              >
                {isLast ? "Let's play" : 'Next'}
                {!isLast && <ArrowRight className="w-3.5 h-3.5" strokeWidth={2.5} />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})

export default OnboardingModal
