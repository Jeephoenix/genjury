import React, { useState, useEffect } from 'react'
import { Drama, Wallet, Droplet, Swords } from 'lucide-react'
import { getNetworkInfo, getChainNativeSymbol } from '../lib/genlayer'

const KEY = 'genjury_onboarded_v1'

export default function OnboardingModal() {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)
  const net = getNetworkInfo()
  const symbol = getChainNativeSymbol()

  useEffect(() => {
    try {
      if (!localStorage.getItem(KEY)) setOpen(true)
    } catch {}
  }, [])

  if (!open) return null

  const dismiss = () => {
    try { localStorage.setItem(KEY, '1') } catch {}
    setOpen(false)
  }

  const steps = [
    {
      Icon: Drama, color: 'text-plasma',
      title: 'Welcome to Genjury',
      body: 'A bluffing game judged by an on-chain AI. Write three statements — one a lie — and try to fool both your friends and the Judge.',
    },
    {
      Icon: Wallet, color: 'text-neon',
      title: 'Connect a wallet',
      body: `Tap the wallet pill in the top-right and connect MetaMask (or any EIP-1193 wallet). You're on ${net.label}.`,
    },
    {
      Icon: Droplet, color: 'text-ice',
      title: `Grab some test ${symbol}`,
      body: `Each room has an entry fee in ${symbol}. Hit the "Get test ${symbol}" button in the wallet panel to claim free testnet tokens from the faucet.`,
    },
    {
      Icon: Swords, color: 'text-gold',
      title: 'Create or join a room',
      body: 'Set the entry fee, share the room code with friends, and let the Judge decide who walks away with the pot.',
    },
  ]

  const isLast = step === steps.length - 1
  const cur = steps[step]

  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center px-4 animate-fade-in">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={dismiss} />
      <div className="relative card glass max-w-sm w-full text-center space-y-5 animate-slide-up">
        <div className="flex justify-center">
          <cur.Icon className={`w-14 h-14 ${cur.color}`} strokeWidth={1.75} />
        </div>
        <h2 className="font-display font-700 text-xl text-white">{cur.title}</h2>
        <p className="text-white/70 text-sm leading-relaxed">{cur.body}</p>

        <div className="flex justify-center gap-1.5">
          {steps.map((_, i) => (
            <span
              key={i}
              className={`w-2 h-2 rounded-full transition-colors ${
                i === step ? 'bg-plasma' : 'bg-white/20'
              }`}
            />
          ))}
        </div>

        <div className="flex gap-2">
          {step > 0 && (
            <button
              onClick={() => setStep(s => s - 1)}
              className="btn btn-ghost flex-1 py-2 text-sm"
            >
              Back
            </button>
          )}
          <button
            onClick={() => (isLast ? dismiss() : setStep(s => s + 1))}
            className="btn btn-plasma flex-1 py-2.5 text-sm"
          >
            {isLast ? "Let's play" : 'Next'}
          </button>
        </div>

        <button
          onClick={dismiss}
          className="text-white/30 text-xs hover:text-white/60"
        >
          Skip intro
        </button>
      </div>
    </div>
  )
}
