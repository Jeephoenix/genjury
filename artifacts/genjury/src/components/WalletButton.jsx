import React, { useState, useEffect, useRef } from 'react'
import { Wallet, ChevronDown, Check } from 'lucide-react'
import {
  myAddress,
  isWalletConnected,
  subscribeWallet,
  getNetworkName,
  getNetworkOptions,
  setRuntimeNetworkName,
} from '../lib/genlayer'
import useGameStore from '../lib/store'

const short = (a) => (a ? `${a.slice(0, 4)}…${a.slice(-4)}` : '')

const NETWORK_META = {
  studionet: { color: '#7fff6e', badge: 'Studio'  },
  bradbury:  { color: '#a259ff', badge: 'Bradbury' },
  asimov:    { color: '#a259ff', badge: 'Asimov'   },
}
const getMeta = (key) => NETWORK_META[key] ?? { color: '#ff6b35', badge: key }

function NetworkDropdown({ onClose, onSwitch, currentNetwork }) {
  const options = getNetworkOptions()
  return (
    <div className="absolute top-full right-0 mt-1.5 z-[200]" style={{ width: '210px' }}>
      <div
        className="rounded-xl border border-white/[0.1] overflow-hidden"
        style={{
          background: 'rgba(11,11,18,0.98)',
          backdropFilter: 'blur(20px)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.75), 0 0 0 1px rgba(255,255,255,0.05)',
        }}
      >
        <div className="px-3 pt-2.5 pb-2 border-b border-white/[0.06]">
          <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-white/30">Select Network</p>
        </div>

        <div className="p-1 space-y-0.5">
          {options.map((opt) => {
            const active = opt.key === currentNetwork
            const meta   = getMeta(opt.key)
            return (
              <button
                key={opt.key}
                onClick={() => { onSwitch(opt.key); onClose() }}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-all duration-100 text-left group"
                style={{ background: active ? 'rgba(255,255,255,0.07)' : 'transparent' }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
              >
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: meta.color, boxShadow: active ? `0 0 6px ${meta.color}` : 'none' }}
                />
                <span className={`flex-1 text-[13px] font-medium leading-none transition-colors ${active ? 'text-white' : 'text-white/50 group-hover:text-white/75'}`}>
                  {opt.label}
                </span>
                {opt.key === 'studionet' && (
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ background: 'rgba(127,255,110,0.1)', color: '#7fff6e', border: '1px solid rgba(127,255,110,0.18)' }}>
                    LIVE
                  </span>
                )}
                {active && <Check className="w-3 h-3 text-white/35 flex-shrink-0" strokeWidth={2.5} />}
              </button>
            )
          })}
        </div>

        <div className="px-3 py-2 border-t border-white/[0.06]">
          <p className="text-[9px] text-white/20 font-mono">Contract on GenLayer Studio</p>
        </div>
      </div>
    </div>
  )
}

export default function WalletButton({ compact = false }) {
  const setOpen             = useGameStore((s) => s.setWalletPanelOpen)
  const [, force]           = useState(0)
  const [dropOpen, setDropOpen] = useState(false)
  const wrapRef             = useRef(null)

  useEffect(() => subscribeWallet(() => force((n) => n + 1)), [])

  useEffect(() => {
    if (!dropOpen) return
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setDropOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [dropOpen])

  const connected      = isWalletConnected()
  const address        = myAddress()
  const currentNetwork = getNetworkName()
  const meta           = getMeta(currentNetwork)

  const handleSwitch = (key) => { setRuntimeNetworkName(key); force((n) => n + 1) }

  if (connected) {
    return (
      <div className="inline-flex items-center gap-1.5">
        {/* Address pill */}
        <button
          onClick={() => setOpen(true)}
          className={`group inline-flex items-center gap-1.5 rounded-xl border border-plasma/30 bg-plasma/10 text-white transition-all duration-200 hover:bg-plasma/18 hover:border-plasma/50 hover:shadow-[0_0_16px_rgba(162,89,255,0.18)] ${
            compact ? 'px-2 py-1.5 text-[11px]' : 'px-3 py-1.5 text-[11px]'
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-neon shadow-[0_0_5px_#7fff6e] flex-shrink-0" />
          <span className="font-mono tracking-tight text-white/85">{short(address)}</span>
          {!compact && <ChevronDown className="w-3 h-3 text-white/35 group-hover:text-white/55 transition-colors" strokeWidth={2.5} />}
        </button>

        {/* Network pill — rightmost, dot only on mobile, dot+name on desktop */}
        <div className="relative" ref={wrapRef}>
          <button
            onClick={() => setDropOpen((v) => !v)}
            aria-label="Switch network"
            aria-expanded={dropOpen}
            className="inline-flex items-center gap-1.5 rounded-lg border transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
            style={{
              padding: compact ? '5px 8px' : '5px 10px',
              background: dropOpen ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)',
              borderColor: dropOpen ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.08)',
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ background: meta.color, boxShadow: `0 0 4px ${meta.color}80` }}
            />
            {!compact && (
              <span className="text-[11px] font-mono text-white/55 leading-none tracking-tight hidden sm:inline">
                {meta.badge}
              </span>
            )}
            <ChevronDown
              className="w-3 h-3 text-white/35 flex-shrink-0 transition-transform duration-150"
              style={{ transform: dropOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
              strokeWidth={2.5}
            />
          </button>

          {dropOpen && (
            <NetworkDropdown
              onClose={() => setDropOpen(false)}
              onSwitch={handleSwitch}
              currentNetwork={currentNetwork}
            />
          )}
        </div>
      </div>
    )
  }

  return (
    <button
      onClick={() => setOpen(true)}
      className={`group inline-flex items-center gap-1.5 rounded-xl border border-crimson/40 bg-crimson/10 text-crimson font-semibold uppercase tracking-wider transition-all duration-200 hover:bg-crimson/18 hover:border-crimson/60 hover:shadow-[0_0_20px_rgba(232,0,45,0.25)] active:scale-95 ${
        compact ? 'px-2.5 py-1.5 text-[11px]' : 'px-3 py-1.5 text-[11px]'
      }`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-crimson animate-pulse flex-shrink-0" />
      <Wallet className={compact ? 'w-3.5 h-3.5' : 'w-3.5 h-3.5'} strokeWidth={2.25} />
      {!compact && <span>Connect</span>}
    </button>
  )
}
