import React, { useEffect, useMemo, useState } from 'react'
import {
  Drama,
  Brain,
  Vote,
  Coins,
  ArrowLeft,
  Plus,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Info,
} from 'lucide-react'
import useGameStore from '../lib/store'
import MistrialMark from '../components/MistrialMark'
import OpenRoundsList from '../components/OpenRoundsList'
import {
  parseGen,
  formatGen,
  getChainNativeSymbol,
  subscribeWallet,
  isWalletConnected,
} from '../lib/genlayer'
import { getProfile, subscribeProfile } from '../lib/profile'
import { rememberJoinedRoom } from '../lib/joinedRooms'

const PRESET_FEES = ['0', '0.01', '0.1', '1']

export default function MistrialPage() {
  const [showCreate, setShowCreate]   = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [advancedAddr, setAdvancedAddr] = useState('')

  // Create-room form
  const [entryFee, setEntryFee]   = useState('0.01')
  const [maxRounds, setMaxRounds] = useState(3)
  const [feeError, setFeeError]   = useState(null)

  const createRoom    = useGameStore(s => s.createRoom)
  const joinRoom      = useGameStore(s => s.joinRoom)
  const previewRoom   = useGameStore(s => s.previewRoom)
  const loading       = useGameStore(s => s.loading)
  const setActiveTab  = useGameStore(s => s.setActiveTab)
  const setOpenWallet = useGameStore(s => s.setWalletPanelOpen)

  const [, force] = useState(0)
  useEffect(() => subscribeWallet(() => force((n) => n + 1)), [])
  useEffect(() => subscribeProfile(() => force((n) => n + 1)), [])

  // Deep-link: ?join=<addr> → remember it & let OpenRoundsList show it.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const joinParam = params.get('join')
    if (joinParam) {
      const cleaned = normalizeAddress(joinParam)
      if (/^0x[0-9a-f]{40}$/.test(cleaned)) {
        rememberJoinedRoom(cleaned)
      }
      params.delete('join')
      const qs = params.toString()
      window.history.replaceState({}, '',
        window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash)
    }
  }, [])

  const symbol  = getChainNativeSymbol()
  const profile = getProfile()
  const connected = isWalletConnected()

  const entryFeeWei = useMemo(() => {
    try { return parseGen(entryFee) } catch { return null }
  }, [entryFee])

  const handleCreate = () => {
    if (loading) return
    if (!connected) { setOpenWallet(true); return }
    if (entryFeeWei === null) { setFeeError(`Invalid ${symbol} amount`); return }
    setFeeError(null)
    createRoom(profile.name, { entryFeeWei, maxRounds: Number(maxRounds) })
  }

  const handleAdvancedJoin = () => {
    const addr = normalizeAddress(advancedAddr)
    if (!/^0x[0-9a-f]{40}$/.test(addr)) return
    if (!connected) { setOpenWallet(true); return }
    joinRoom(addr)
  }

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-10 sm:py-14 relative">
      {/* Back to Games */}
      <div className="mb-4">
        <button
          onClick={() => setActiveTab('games')}
          className="inline-flex items-center gap-1.5 text-white/45 hover:text-white text-xs font-mono uppercase tracking-[0.18em] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" strokeWidth={2.25} />
          All games
        </button>
      </div>

      {/* Hero */}
      <div className="text-center mb-10 animate-slide-up">
        <div className="flex items-center justify-center mb-6">
          <div className="relative">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-neon/10 border border-neon/30 flex items-center justify-center text-neon drop-shadow-[0_0_20px_rgba(127,255,110,0.35)]">
              <MistrialMark className="w-14 h-14 sm:w-16 sm:h-16" />
            </div>
            <div className="absolute -inset-2 bg-neon/20 rounded-full blur-xl animate-pulse pointer-events-none" />
          </div>
        </div>

        <div className="inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.2em] text-white/40 mb-3">
          <span className="w-1.5 h-1.5 rounded-full bg-neon animate-pulse" />
          A Genjury game · LIVE
        </div>

        <h1 className="font-display text-5xl sm:text-7xl font-800 leading-none mb-4">
          <span className="shimmer-text">Mistrial</span>
        </h1>

        <p className="text-white/55 text-base sm:text-lg max-w-lg mx-auto leading-relaxed font-body">
          Two truths, one lie. Fool the players. Fool the AI Judge.
          <br />
          <span className="text-plasma/85">Stake {symbol}, win the pot, on GenLayer.</span>
        </p>

        <div className="flex flex-wrap gap-2 justify-center mt-6">
          {[
            { Icon: Drama, label: 'Deceiver vs Detectors' },
            { Icon: Brain, label: 'AI Judge' },
            { Icon: Vote,  label: 'Optimistic Democracy' },
            { Icon: Coins, label: `Winner takes the ${symbol} pot` },
          ].map(({ Icon, label }) => (
            <span
              key={label}
              className="inline-flex items-center gap-1.5 badge bg-white/5 border border-white/10 text-white/70 text-sm py-1.5 px-3"
            >
              <Icon className="w-3.5 h-3.5 text-white/55" strokeWidth={2.25} />
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* Open rounds — primary entry point */}
      <div className="card glass mb-5 animate-slide-up" style={{ animationDelay: '0.05s' }}>
        <OpenRoundsList
          title="Open rounds"
          emptyHint="No rooms tracked yet. Tap “Create new room” below to start one, or use Advanced to join by contract address."
        />
      </div>

      {/* Create-new-room CTA */}
      <div className="card glass mb-5 animate-slide-up" style={{ animationDelay: '0.1s' }}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display font-700 text-base text-white inline-flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-neon" />
              Start your own room
            </h2>
            <p className="text-white/50 text-sm mt-1">
              Pick the entry fee and round count. Friends can join via the room list above.
            </p>
          </div>
          <button
            onClick={() => setShowCreate((v) => !v)}
            className="px-3 py-2 rounded-lg border border-neon/40 bg-neon/15 text-neon text-sm font-semibold hover:bg-neon/25 inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" strokeWidth={2.25} />
            {showCreate ? 'Hide' : 'Create new room'}
          </button>
        </div>

        {showCreate && (
          <div className="mt-4 space-y-4 animate-fade-in">
            {!profile.name && (
              <div className="rounded-lg bg-signal/10 border border-signal/30 px-3 py-2 text-xs text-signal inline-flex items-center gap-2">
                <Info className="w-3.5 h-3.5" />
                Set a player name in your profile first.
              </div>
            )}

            {/* Entry fee */}
            <div>
              <label className="text-white/50 text-xs font-mono uppercase tracking-wider mb-2 block">
                Entry fee per player ({symbol})
              </label>
              <input
                className="input font-mono"
                placeholder="0.0"
                value={entryFee}
                onChange={(e) => setEntryFee(e.target.value.replace(',', '.'))}
                inputMode="decimal"
              />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {PRESET_FEES.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setEntryFee(v)}
                    className={`badge px-2 py-1 text-[11px] cursor-pointer transition-colors ${
                      entryFee === v
                        ? 'bg-neon/20 text-neon border border-neon/40'
                        : 'bg-white/5 text-white/55 border border-white/10 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    {v} {symbol}
                  </button>
                ))}
              </div>
              {feeError && <p className="text-signal text-xs mt-1.5">{feeError}</p>}
            </div>

            {/* Max rounds */}
            <div>
              <label className="text-white/50 text-xs font-mono uppercase tracking-wider mb-2 block">
                Total rounds
              </label>
              <div className="flex items-center gap-2">
                {[2, 3, 5, 7].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setMaxRounds(n)}
                    className={`flex-1 rounded-lg py-2 text-sm font-mono transition-colors ${
                      maxRounds === n
                        ? 'bg-neon/20 text-neon border border-neon/40'
                        : 'bg-white/5 text-white/55 border border-white/10 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <button
              className="btn btn-neon w-full py-3 text-base"
              onClick={handleCreate}
              disabled={loading || entryFeeWei === null || !profile.name}
            >
              {loading
                ? 'Talking to GenLayer…'
                : entryFeeWei && entryFeeWei > 0n
                  ? `Deploy & Stake ${formatGen(entryFeeWei, 6)} ${symbol}`
                  : 'Deploy & Enter'}
            </button>
          </div>
        )}
      </div>

      {/* Advanced — paste-by-address (rarely needed). */}
      <div className="rounded-xl border border-white/5 bg-white/[0.015] px-4 py-3 animate-fade-in" style={{ animationDelay: '0.15s' }}>
        <button
          onClick={() => setShowAdvanced((v) => !v)}
          className="w-full flex items-center justify-between text-white/45 hover:text-white text-xs font-mono uppercase tracking-wider"
        >
          <span>Advanced · join by contract address</span>
          {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
        {showAdvanced && (
          <div className="mt-3 flex flex-col sm:flex-row gap-2">
            <input
              className="input font-mono text-xs flex-1"
              placeholder="0x… contract address"
              value={advancedAddr}
              onChange={(e) => setAdvancedAddr(normalizeAddress(e.target.value))}
            />
            <button
              onClick={handleAdvancedJoin}
              disabled={loading || !/^0x[0-9a-f]{40}$/.test(advancedAddr)}
              className="px-4 py-2 rounded-lg border border-plasma/40 bg-plasma/15 text-plasma text-sm font-semibold hover:bg-plasma/25 disabled:opacity-50"
            >
              Join
            </button>
          </div>
        )}
      </div>

      {/* Attribution */}
      <div className="mt-12 text-center animate-fade-in" style={{ animationDelay: '0.3s' }}>
        <p className="text-white/25 text-xs font-mono">
          Built on{' '}
          <a href="https://genlayer.com" target="_blank" rel="noopener" className="text-plasma/55 hover:text-plasma transition-colors">
            GenLayer
          </a>{' '}
          · Intelligent Contracts · Optimistic Democracy
        </p>
      </div>
    </div>
  )
}

function normalizeAddress(raw) {
  if (!raw) return ''
  let s = String(raw).trim()
  if (s.toLowerCase().startsWith('0x')) s = s.slice(2)
  s = s.replace(/[^0-9a-fA-F]/g, '').toLowerCase().slice(0, 40)
  return s ? `0x${s}` : ''
}
