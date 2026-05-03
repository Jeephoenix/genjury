import React, { useState, useEffect } from 'react'
import { Wallet, ChevronDown } from 'lucide-react'
import {
  myAddress,
  isWalletConnected,
  subscribeWallet,
  getNetworkInfo,
  getNetworkName,
} from '../lib/genlayer'
import useGameStore from '../lib/store'

const short = (a) => (a ? `${a.slice(0, 4)}…${a.slice(-4)}` : '')

function networkColors(name) {
  if (!name || name === 'studionet')
    return { bg: 'rgba(127,255,110,0.14)', border: 'rgba(127,255,110,0.50)', dot: '#7fff6e', glow: 'rgba(127,255,110,0.30)', pulse: true }
  if (name.includes('testnet'))
    return { bg: 'rgba(162,89,255,0.14)', border: 'rgba(162,89,255,0.50)', dot: '#a259ff', glow: 'rgba(162,89,255,0.30)', pulse: false }
  if (name === 'localnet')
    return { bg: 'rgba(245,200,66,0.14)', border: 'rgba(245,200,66,0.50)', dot: '#f5c842', glow: 'rgba(245,200,66,0.30)', pulse: false }
  return { bg: 'rgba(255,107,53,0.14)', border: 'rgba(255,107,53,0.50)', dot: '#ff6b35', glow: 'rgba(255,107,53,0.30)', pulse: false }
}

function NetworkCircle({ onClick }) {
  const net   = getNetworkInfo()
  const name  = getNetworkName()
  const c     = networkColors(name)

  return (
    <button
      onClick={onClick}
      title={net?.label ?? 'Network'}
      aria-label={`Network: ${net?.label ?? 'Unknown'}`}
      className="relative w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-200 hover:scale-110 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
      style={{
        background: c.bg,
        border: `2px solid ${c.border}`,
        boxShadow: `0 0 14px ${c.glow}, inset 0 1px 0 rgba(255,255,255,0.08)`,
      }}
    >
      <span
        className="w-3 h-3 rounded-full"
        style={{ background: c.dot, boxShadow: `0 0 8px ${c.dot}` }}
      />
      {c.pulse && (
        <span
          className="absolute inset-0 rounded-full animate-ping opacity-25 pointer-events-none"
          style={{ background: c.dot }}
        />
      )}
    </button>
  )
}

export default function WalletButton({ compact = false }) {
  const setOpen = useGameStore((s) => s.setWalletPanelOpen)
  const [, force] = useState(0)
  useEffect(() => subscribeWallet(() => force((n) => n + 1)), [])

  const connected = isWalletConnected()
  const address   = myAddress()

  if (connected) {
    return (
      <div className="inline-flex items-center gap-2">
        <NetworkCircle onClick={() => setOpen(true)} />
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
      </div>
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
