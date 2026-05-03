import React, { useState, useEffect, useRef, memo } from 'react'
import { Wallet, ChevronDown, Check } from 'lucide-react'
import {
  myAddress,
  isWalletConnected,
  subscribeWallet,
  getNetworkInfo,
  getNetworkName,
  getNetworkOptions,
  setRuntimeNetworkName,
} from '../lib/genlayer'
import useGameStore from '../lib/store'

const short = (a) => (a ? `${a.slice(0, 4)}…${a.slice(-4)}` : '')

const NETWORK_COLORS = {
  studionet: '#7fff6e',
  bradbury: '#a259ff',
  asimov: '#a259ff',
  localnet: '#f5c842',
}

function getNetworkColor(name) {
  return NETWORK_COLORS[name] ?? '#ff6b35'
}

const NetworkDropdown = memo(function NetworkDropdown({ onClose, onSwitch, currentNetwork }) {
  const options = getNetworkOptions()

  return (
    <div className="absolute top-full right-0 mt-2 z-[100]">
      <div
        className="rounded-xl border border-white/[0.15] overflow-hidden min-w-[200px]"
        style={{ background: 'rgba(20,20,32,0.95)', backdropFilter: 'blur(16px)', boxShadow: '0 8px 32px rgba(0,0,0,0.6)' }}
      >
        <div className="px-4 pt-3 pb-2">
          <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-white/40">Switch Networks</p>
        </div>
        <div className="px-2 pb-2 space-y-1">
          {options.map((opt) => {
            const active = opt.key === currentNetwork
            const dotColor = getNetworkColor(opt.key)
            return (
              <button
                key={opt.key}
                onClick={() => { onSwitch(opt.key); onClose() }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all duration-150 text-left group"
                style={active
                  ? { background: 'rgba(255,255,255,0.08)' }
                  : { background: 'transparent' }
                }
                onMouseEnter={e => !active && (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                onMouseLeave={e => !active && (e.currentTarget.style.background = 'transparent')}
              >
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: dotColor }}
                />
                <span className={`flex-1 text-sm font-medium ${active ? 'text-white' : 'text-white/60 group-hover:text-white/80'} transition-colors`}>
                  {opt.label}
                </span>
                {active && <Check className="w-3.5 h-3.5 flex-shrink-0 text-white/50" strokeWidth={2.5} />}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
})

const WalletButton = memo(function WalletButton({ compact = false }) {
  const setOpen  = useGameStore((s) => s.setWalletPanelOpen)
  const [, force]       = useState(0)
  const [dropOpen, setDropOpen] = useState(false)
  const wrapRef = useRef(null)

  useEffect(() => subscribeWallet(() => force((n) => n + 1)), [])

  useEffect(() => {
    if (!dropOpen) return
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setDropOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [dropOpen])

  const connected     = isWalletConnected()
  const address       = myAddress()
  const currentNetwork = getNetworkName()

  const handleSwitch = (key) => {
    setRuntimeNetworkName(key)
    force((n) => n + 1)
  }

  if (connected) {
    return (
      <div className="inline-flex items-center gap-2">
        {/* Network button — grey box with logo and dropdown */}
        <div className="relative" ref={wrapRef}>
          <button
            onClick={() => setDropOpen((v) => !v)}
            aria-label="Switch network"
            aria-expanded={dropOpen}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/[0.15] bg-white/[0.07] hover:bg-white/10 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
          >
            <img src="/logo.png" alt="" className="w-5 h-5 object-contain" />
            <ChevronDown className="w-4 h-4 text-white/60 flex-shrink-0" strokeWidth={2.25} />
          </button>

          {dropOpen && (
            <NetworkDropdown
              onClose={() => setDropOpen(false)}
              onSwitch={handleSwitch}
              currentNetwork={currentNetwork}
            />
          )}
        </div>

        {/* Wallet address button */}
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
})

export default WalletButton
