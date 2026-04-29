import React from 'react'
import { getNetworkInfo } from '../lib/genlayer'

export default function Footer() {
  const net = getNetworkInfo()
  return (
    <footer className="relative z-10 mt-16 px-6 pt-8 pb-28 md:pb-8 border-t border-white/5 text-center">
      <p className="text-white/30 text-xs font-mono">
        Genjury · Running on {net.label}
      </p>
            <p className="text-white/20 text-[11px] mt-2 max-w-md mx-auto">
        Testnet only. Tokens have no monetary value. Not financial advice.
        Bring your own Web3 wallet (MetaMask, Rabby, etc.) to play.
      </p>
    </footer>
  )
}
