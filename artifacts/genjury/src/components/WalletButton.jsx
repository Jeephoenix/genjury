import React, { useState, useEffect } from 'react'
import { Wallet, ChevronDown } from 'lucide-react'
import {
  myAddress,
  isWalletConnected,
  subscribeWallet,
} from '../lib/genlayer'
import useGameStore from '../lib/store'

const short = (a) => (a ? `${a.slice(0, 4)}…${a.slice(-4)}` : '')

export default function WalletButton({ compact = false }) {
  const setOpen = useGameStore((s) => s.setWalletPanelOpen)
  const [, force] = useState(0)
  useEffect(() => subscribeWallet(() => force((n) => n + 1)), [])

  const connected = isWalletConnected()
  const address   = myAddress()

  if (connected) {
    return (
      <button
        onClick={() => setOpen(true)}
        className={`group inline-flex items-center gap-2 rounded-xl border border-plasma/30 bg-plasma/10 text-white transition-all duration-200 hover:bg-plasma/18 hover:border-plasma/50 hover:shadow-[0_0_20px_rgba(162,89,255,0.2)] ${
          compact ? 'px-2.5 py-1.5 text-xs' : 'px-3.5 py-2 text-xs'
        }`}
        aria-label="Open wallet panel"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-neon shadow-[0_0_6px_#7fff6e] flex-shrink-0" />
        <span className="font-mono tracking-tight text-white/90">{short(address)}</span>
        {!compact && <ChevronDown className="w-3.5 h-3.5 text-white/40 group-hover:text-white/60 transition-colors" strokeWidth={2.5} />}
      </button>
    )
  }

  return (
    <button
      onClick={() => setOpen(true)}
      className={`group inline-flex items-center gap-2 rounded-xl border border-crimson/40 bg-crimson/10 text-crimson font-semibold uppercase tracking-wider transition-all duration-200 hover:bg-crimson/18 hover:border-crimson/60 hover:shadow-[0_0_24px_rgba(232,0,45,0.3)] active:scale-95 ${
        compact ? 'px-2.5 py-1.5 text-xs' : 'px-3.5 py-2 text-xs'
      }`}
      aria-label="Connect wallet"
    >
      <span className="w-1.5 h-1.5 rounded-full bg-crimson animate-pulse flex-shrink-0" />
      <Wallet className={`${compact ? 'w-3.5 h-3.5' : 'w-4 h-4'}`} strokeWidth={2.25} />
      {!compact && <span>Connect</span>}
    </button>
  )
}
