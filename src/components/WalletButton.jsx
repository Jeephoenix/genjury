import React, { useState, useEffect } from 'react'
import { Wallet } from 'lucide-react'
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

  return (
    <button
      onClick={() => setOpen(true)}
      className={`group inline-flex items-center gap-2 rounded-lg border transition-all duration-200 ${
        connected
          ? 'border-plasma/40 bg-plasma/10 text-white hover:bg-plasma/20 hover:border-plasma/60'
          : 'border-neon/40 bg-neon/10 text-neon hover:bg-neon/20 hover:border-neon/60 hover:shadow-[0_0_20px_rgba(127,255,110,0.35)]'
      } ${compact ? 'px-2.5 py-1.5 text-xs' : 'px-3.5 py-2 text-xs'}`}
      aria-label="Open wallet panel"
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          connected ? 'bg-plasma' : 'bg-neon animate-pulse'
        }`}
      />
      <Wallet className={`${compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} -ml-0.5`} strokeWidth={2.25} />
      {connected ? (
        <span className="font-mono tracking-tight">{short(address)}</span>
      ) : (
        <span className="font-semibold uppercase tracking-wider">Connect</span>
      )}
    </button>
  )
}
