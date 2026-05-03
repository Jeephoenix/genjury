import React, { useState, useEffect, useRef } from 'react'
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

const DOT_COLORS = {
  studionet: { dot: '#7fff6e', glow: 'rgba(127,255,110,0.45)', bg: 'rgba(127,255,110,0.12)', border: 'rgba(127,255,110,0.45)', pulse: true },
  bradbury:  { dot: '#a259ff', glow: 'rgba(162,89,255,0.40)', bg: 'rgba(162,89,255,0.12)', border: 'rgba(162,89,255,0.45)', pulse: false },
  asimov:    { dot: '#a259ff', glow: 'rgba(162,89,255,0.40)', bg: 'rgba(162,89,255,0.12)', border: 'rgba(162,89,255,0.45)', pulse: false },
  localnet:  { dot: '#f5c842', glow: 'rgba(245,200,66,0.40)',  bg: 'rgba(245,200,66,0.12)',  border: 'rgba(245,200,66,0.45)',  pulse: false },
}

function getColors(name) {
  return DOT_COLORS[name] ?? { dot: '#ff6b35', glow: 'rgba(255,107,53,0.40)', bg: 'rgba(255,107,53,0.12)', border: 'rgba(255,107,53,0.45)', pulse: false }
}

function NetworkDropdown({ onClose, onSwitch, currentNetwork }) {
  const options = getNetworkOptions()

  return (
    <div className="absolute top-full left-0 mt-2 z-[100] min-w-[220px]">
      <div
        className="rounded-2xl border border-white/[0.12] overflow-hidden"
        style={{ background: 'rgba(12,12,20,0.97)', backdropFilter: 'blur(20px)', boxShadow: '0 8px 40px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.05)' }}
      >
        <div className="px-4 pt-3.5 pb-2">
          <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-white/35">Switch Networks</p>
        </div>
        <div className="px-1.5 pb-1.5 space-y-0.5">
          {options.map((opt) => {
            const active = opt.key === currentNetwork
            const c = getColors(opt.key)
            return (
              <button
                key={opt.key}
                onClick={() => { onSwitch(opt.key); onClose() }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 text-left group"
                style={active
                  ? { background: c.bg, border: `1px solid ${c.border}` }
                  : { background: 'transparent', border: '1px solid transparent' }
                }
                onMouseEnter={e => !active && (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                onMouseLeave={e => !active && (e.currentTarget.style.background = 'transparent')}
              >
                <span
                  className="relative w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ background: c.dot, boxShadow: active ? `0 0 8px ${c.dot}` : 'none' }}
                >
                  {active && c.pulse && (
                    <span className="absolute inset-0 rounded-full animate-ping opacity-40" style={{ background: c.dot }} />
                  )}
                </span>
                <span className={`flex-1 text-sm font-medium ${active ? 'text-white' : 'text-white/55 group-hover:text-white/85'} transition-colors`}>
                  {opt.label}
                </span>
                {active && <Check className="w-3.5 h-3.5 flex-shrink-0" style={{ color: c.dot }} strokeWidth={2.5} />}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default function WalletButton({ compact = false }) {
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
  const c             = getColors(currentNetwork)

  const handleSwitch = (key) => {
    setRuntimeNetworkName(key)
    force((n) => n + 1)
  }

  if (connected) {
    return (
      <div className="inline-flex items-center gap-2">
        {/* Network circle — opens dropdown */}
        <div className="relative" ref={wrapRef}>
          <button
            onClick={() => setDropOpen((v) => !v)}
            title={getNetworkInfo()?.label ?? 'Network'}
            aria-label="Switch network"
            aria-expanded={dropOpen}
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
