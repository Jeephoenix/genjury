import React, { useState, useEffect, useRef } from 'react'
import { Wallet, ChevronDown, Check, AlertTriangle } from 'lucide-react'
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

const NETWORK_META = {
  studionet: { color: '#7fff6e', badge: 'Studio',   dot: '#7fff6e' },
  bradbury:  { color: '#a259ff', badge: 'Bradbury', dot: '#a259ff' },
  asimov:    { color: '#a259ff', badge: 'Asimov',   dot: '#a259ff' },
}

function getMeta(key) {
  return NETWORK_META[key] ?? { color: '#ff6b35', badge: key, dot: '#ff6b35' }
}

function NetworkDropdown({ onClose, onSwitch, currentNetwork }) {
  const options = getNetworkOptions()

  return (
    <div className="absolute top-full mt-1.5 z-[200]" style={{ right: 0, width: '190px' }}>
      <div
        className="rounded-xl border border-white/[0.1] overflow-hidden"
        style={{
          background: 'rgba(13,13,20,0.97)',
          backdropFilter: 'blur(20px)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.06)',
        }}
      >
        {/* Header */}
        <div className="px-3 pt-2.5 pb-2 border-b border-white/[0.06]">
          <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-white/35">Network</p>
        </div>

        {/* Options */}
        <div className="p-1 space-y-0.5">
          {options.map((opt) => {
            const active = opt.key === currentNetwork
            const meta   = getMeta(opt.key)
            const isRecommended = opt.key === 'studionet'
            return (
              <button
                key={opt.key}
                onClick={() => { onSwitch(opt.key); onClose() }}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-all duration-100 text-left group"
                style={{
                  background: active ? 'rgba(255,255,255,0.07)' : 'transparent',
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
              >
                {/* Dot */}
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0 transition-all"
                  style={{
                    background: meta.dot,
                    boxShadow: active ? `0 0 6px ${meta.dot}` : 'none',
                  }}
                />

                {/* Label + badge */}
                <span className="flex-1 flex items-center gap-2 min-w-0">
                  <span className={`text-sm font-medium leading-none truncate transition-colors ${active ? 'text-white' : 'text-white/55 group-hover:text-white/80'}`}>
                    {opt.label}
                  </span>
                  {isRecommended && (
                    <span
                      className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0"
                      style={{ background: 'rgba(127,255,110,0.12)', color: '#7fff6e', border: '1px solid rgba(127,255,110,0.2)' }}
                    >
                      Live
                    </span>
                  )}
                </span>

                {/* Active checkmark */}
                {active && (
                  <Check className="w-3.5 h-3.5 flex-shrink-0 text-white/40" strokeWidth={2.5} />
                )}
              </button>
            )
          })}
        </div>

        {/* Footer hint */}
        <div className="px-3 py-2 border-t border-white/[0.06]">
          <p className="text-[10px] text-white/25 font-mono leading-relaxed">
            Deployed on GenLayer Studio
          </p>
        </div>
      </div>
    </div>
  )
}

export default function WalletButton({ compact = false }) {
  const setOpen         = useGameStore((s) => s.setWalletPanelOpen)
  const [, force]       = useState(0)
  const [dropOpen, setDropOpen] = useState(false)
  const wrapRef         = useRef(null)

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
  const isStudio       = currentNetwork === 'studionet'

  const handleSwitch = (key) => {
    setRuntimeNetworkName(key)
    force((n) => n + 1)
  }

  if (connected) {
    return (
      <div className="inline-flex items-center gap-2">
        {/* Network pill */}
        <div className="relative" ref={wrapRef} style={{ overflow: "visible" }}>
          <button
            onClick={() => setDropOpen((v) => !v)}
            aria-label="Switch network"
            aria-expanded={dropOpen}
            className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
            style={{
              background: dropOpen ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.05)',
              borderColor: dropOpen ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.1)',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.16)' }}
            onMouseLeave={e => { if (!dropOpen) { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)' } }}
          >
            {/* Status dot */}
            <span
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ background: meta.dot, boxShadow: isStudio ? `0 0 5px ${meta.dot}80` : 'none' }}
            />
            {/* Network short name — hidden on very compact */}
            {!compact && (
              <span className="text-xs font-mono text-white/65 leading-none tracking-tight">
                {meta.badge}
              </span>
            )}
            <ChevronDown
              className="w-3 h-3 text-white/40 flex-shrink-0 transition-transform duration-200"
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
}
