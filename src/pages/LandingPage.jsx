import React, { useEffect, useMemo, useState } from 'react'
import useGameStore from '../lib/store'
import {
  parseGen,
  formatGen,
  getChainNativeSymbol,
  subscribeWallet,
  getDefaultContractAddress,
} from '../lib/genlayer'

const PRESET_FEES = ['0', '0.01', '0.1', '1']

// The address baked in at build time via VITE_GENJURY_DEFAULT_CONTRACT, if any.
const DEFAULT_CONTRACT = getDefaultContractAddress()

export default function LandingPage() {
  const [mode, setMode] = useState(null) // 'create' | 'join' | null
  const [name, setName] = useState('')

  // Create-room form
  const [entryFee, setEntryFee]   = useState('0.01')
  const [maxRounds, setMaxRounds] = useState(3)
  const [feeError, setFeeError]   = useState(null)

  // Join-room form — pre-filled with the env-configured contract if one exists.
  const [roomCode, setRoomCode] = useState(DEFAULT_CONTRACT || '')
  const [preview, setPreview]   = useState(null)
  const [previewing, setPreviewing] = useState(false)

  // Featured room (the env-configured contract) — kept separate from the
  // join-form preview so the hero card stays visible regardless of mode.
  const [featured, setFeatured] = useState(null)
  const [featuredLoading, setFeaturedLoading] = useState(!!DEFAULT_CONTRACT)

  const createRoom = useGameStore(s => s.createRoom)
  const joinRoom   = useGameStore(s => s.joinRoom)
  const previewRoom = useGameStore(s => s.previewRoom)
  const addToast   = useGameStore(s => s.addToast)
  const loading    = useGameStore(s => s.loading)

  const [, force] = useState(0)
  useEffect(() => subscribeWallet(() => force((n) => n + 1)), [])

  const symbol = getChainNativeSymbol()

  const entryFeeWei = useMemo(() => {
    try { return parseGen(entryFee) } catch { return null }
  }, [entryFee])

  const validateCreate = () => {
    if (entryFeeWei === null) {
      setFeeError(`Invalid ${symbol} amount`)
      return false
    }
    setFeeError(null)
    return true
  }

  const handleCreate = () => {
    if (!name.trim() || loading) return
    if (!validateCreate()) return
    createRoom(name.trim(), {
      entryFeeWei,
      maxRounds: Number(maxRounds),
    })
  }

  const handleJoin = () => {
    if (!name.trim() || !roomCode.trim() || loading) return
    joinRoom(roomCode.trim(), name.trim())
  }

  // One-click join into the env-configured featured room.
  const handleJoinFeatured = () => {
    if (!DEFAULT_CONTRACT || loading) return
    if (!name.trim()) {
      setMode('join')
      setRoomCode(DEFAULT_CONTRACT)
      addToast('Enter a name above, then tap Join Game.', 'info')
      return
    }
    joinRoom(DEFAULT_CONTRACT, name.trim())
  }

  // Auto-preview the room economics whenever the address looks plausibly complete.
  useEffect(() => {
    const addr = roomCode.trim()
    if (mode !== 'join' || addr.length < 20) {
      setPreview(null)
      return
    }
    let cancelled = false
    setPreviewing(true)
    setPreview(null)
    const t = setTimeout(async () => {
      const p = await previewRoom(addr)
      if (cancelled) return
      setPreview(p)
      setPreviewing(false)
    }, 350)
    return () => { cancelled = true; clearTimeout(t) }
  }, [mode, roomCode, previewRoom])

  // Load the featured-room preview once on mount (and refresh every 15s so
  // the player count / prize pool stay live without spamming the chain).
  useEffect(() => {
    if (!DEFAULT_CONTRACT) return
    let cancelled = false
    const load = async () => {
      const p = await previewRoom(DEFAULT_CONTRACT)
      if (!cancelled) {
        setFeatured(p)
        setFeaturedLoading(false)
      }
    }
    load()
    const t = setInterval(load, 15000)
    return () => { cancelled = true; clearInterval(t) }
  }, [previewRoom])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-20 relative">
      {/* Hero */}
      <div className="text-center mb-10 animate-slide-up">
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="relative">
            <img
              src="/logo.png"
              alt="Genjury logo"
              className="w-28 h-28 object-contain drop-shadow-[0_0_20px_rgba(167,139,250,0.35)]"
            />
            <div className="absolute -inset-2 bg-plasma/20 rounded-full blur-xl animate-pulse pointer-events-none" />
          </div>
        </div>

        <h1 className="font-display text-6xl sm:text-7xl font-800 leading-none mb-4">
          <span className="shimmer-text">Genjury</span>
        </h1>

        <p className="text-white/50 text-lg sm:text-xl max-w-lg mx-auto leading-relaxed font-body">
          Two truths, one lie. Fool the players. Fool the AI Judge.
          <br />
          <span className="text-plasma/80">Stake {symbol}, win the pot, on GenLayer.</span>
        </p>

        {/* Mechanic pills */}
        <div className="flex flex-wrap gap-2 justify-center mt-6">
          {[
            { icon: '🎭', label: 'Deceiver vs Detectors' },
            { icon: '🤖', label: 'AI Judge' },
            { icon: '🗳️', label: 'Optimistic Democracy' },
            { icon: '💰', label: `Winner takes the ${symbol} pot` },
          ].map(p => (
            <span key={p.label} className="badge bg-white/5 border border-white/10 text-white/60 text-sm py-1.5 px-3">
              {p.icon} {p.label}
            </span>
          ))}
        </div>
      </div>

      {/* Featured room — only rendered when VITE_GENJURY_DEFAULT_CONTRACT is set */}
      {DEFAULT_CONTRACT && !mode && (
        <div className="w-full max-w-sm mb-4 animate-slide-up" style={{ animationDelay: '0.05s' }}>
          <div className="rounded-2xl bg-gradient-to-br from-gold/12 via-plasma/8 to-transparent border border-gold/30 p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="badge bg-gold/20 text-gold border border-gold/30 text-[11px]">
                ⭐ FEATURED ROOM
              </span>
              <span className="text-white/30 text-[10px] font-mono">
                {DEFAULT_CONTRACT.slice(0, 6)}…{DEFAULT_CONTRACT.slice(-4)}
              </span>
            </div>
            <h3 className="font-display font-700 text-white text-lg mb-2">The House Room</h3>
            <p className="text-white/50 text-xs mb-3">
              Skip the deploy step — jump straight into the official Genjury room.
            </p>

            {featuredLoading && (
              <div className="text-white/40 text-xs font-mono">Loading room…</div>
            )}
            {!featuredLoading && featured && (
              <div className="grid grid-cols-3 gap-3 mb-3 text-center">
                <div>
                  <div className="text-white/30 text-[10px] font-mono uppercase">Phase</div>
                  <div className="text-white/80 text-sm capitalize">{featured.phase}</div>
                </div>
                <div>
                  <div className="text-white/30 text-[10px] font-mono uppercase">Players</div>
                  <div className="text-white/80 text-sm font-mono">
                    {featured.playerCount}/{featured.maxPlayers}
                  </div>
                </div>
                <div>
                  <div className="text-white/30 text-[10px] font-mono uppercase">Entry</div>
                  <div className={`text-sm font-mono ${featured.entryFeeWei > 0n ? 'text-neon' : 'text-white/60'}`}>
                    {featured.entryFeeWei > 0n
                      ? `${formatGen(featured.entryFeeWei, 4)} ${symbol}`
                      : 'Free'}
                  </div>
                </div>
              </div>
            )}
            {!featuredLoading && !featured && (
              <p className="text-signal/70 text-xs mb-3">
                Couldn't reach the featured room. Double-check VITE_GENJURY_DEFAULT_CONTRACT.
              </p>
            )}

            <button
              className="btn btn-gold w-full py-3 text-sm"
              onClick={handleJoinFeatured}
              disabled={loading || (!!featured && featured.phase !== 'lobby')}
              title={
                featured && featured.phase !== 'lobby'
                  ? 'Game is in progress — wait for the next round.'
                  : ''
              }
            >
              {loading
                ? '⏳ Joining…'
                : featured && featured.phase !== 'lobby'
                  ? '🔒 Game in progress'
                  : featured && featured.entryFeeWei > 0n
                    ? `🚀 Join — Pay ${formatGen(featured.entryFeeWei, 4)} ${symbol}`
                    : '🚀 Join the House Room'}
            </button>
          </div>
        </div>
      )}

      {/* Card */}
      <div className="w-full max-w-sm animate-slide-up" style={{ animationDelay: '0.1s' }}>
        {!mode ? (
          <div className="card space-y-4">
            <h2 className="font-display font-700 text-xl text-center">Enter the Courtroom</h2>
            <button className="btn btn-neon w-full text-base py-4" onClick={() => setMode('create')}>
              🏛️ Create Room
            </button>
            <button className="btn btn-ghost w-full text-base py-4" onClick={() => setMode('join')}>
              🔗 Join Room
            </button>
          </div>
        ) : (
          <div className="card space-y-4 animate-slide-up">
            <div className="flex items-center gap-3 mb-2">
              <button onClick={() => { setMode(null); setPreview(null) }} className="text-white/40 hover:text-white transition-colors text-sm">
                ← Back
              </button>
              <h2 className="font-display font-700 text-lg">
                {mode === 'create' ? '🏛️ Create Room' : '🔗 Join Room'}
              </h2>
            </div>

            <div>
              <label className="text-white/50 text-xs font-mono uppercase tracking-wider mb-2 block">Your Name</label>
              <input
                className="input"
                placeholder="Enter your player name…"
                value={name}
                onChange={e => setName(e.target.value)}
                maxLength={18}
                onKeyDown={e => {
                  if (e.key !== 'Enter') return
                  if (mode === 'create') handleCreate()
                  else handleJoin()
                }}
                autoFocus
              />
            </div>

            {mode === 'create' && (
              <>
                {/* Entry fee */}
                <div>
                  <label className="text-white/50 text-xs font-mono uppercase tracking-wider mb-2 block">
                    Entry fee per player ({symbol})
                  </label>
                  <input
                    className="input font-mono"
                    placeholder="0.0"
                    value={entryFee}
                    onChange={e => setEntryFee(e.target.value.replace(',', '.'))}
                    inputMode="decimal"
                  />
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {PRESET_FEES.map(v => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setEntryFee(v)}
                        className={`badge px-2 py-1 text-[11px] cursor-pointer transition-colors ${
                          entryFee === v
                            ? 'bg-neon/20 text-neon border border-neon/40'
                            : 'bg-white/5 text-white/50 border border-white/10 hover:text-white hover:bg-white/10'
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
                    {[2, 3, 5, 7].map(n => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setMaxRounds(n)}
                        className={`flex-1 rounded-lg py-2 text-sm font-mono transition-colors ${
                          maxRounds === n
                            ? 'bg-neon/20 text-neon border border-neon/40'
                            : 'bg-white/5 text-white/50 border border-white/10 hover:text-white hover:bg-white/10'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {mode === 'join' && (
              <div>
                <label className="text-white/50 text-xs font-mono uppercase tracking-wider mb-2 block">Contract Address</label>
                <input
                  className="input font-mono text-xs"
                  placeholder="0x…"
                  value={roomCode}
                  onChange={e => setRoomCode(e.target.value.trim())}
                  maxLength={66}
                  onKeyDown={e => e.key === 'Enter' && handleJoin()}
                />
                <p className="text-white/30 text-xs mt-1">Paste the GenLayer contract address from the host.</p>

                {previewing && (
                  <div className="mt-3 rounded-lg bg-white/5 border border-white/10 px-3 py-3 text-xs text-white/40">
                    Looking up room…
                  </div>
                )}
                {!previewing && preview && (
                  <div className="mt-3 rounded-lg bg-plasma/8 border border-plasma/25 px-3 py-3 space-y-1.5 text-xs">
                    <Row label="Phase">
                      <span className="capitalize text-white/80">{preview.phase}</span>
                    </Row>
                    <Row label="Players">
                      <span className="text-white/80 font-mono">
                        {preview.playerCount} / {preview.maxPlayers}
                      </span>
                    </Row>
                    <Row label="Entry fee">
                      <span className={`font-mono ${preview.entryFeeWei > 0n ? 'text-neon' : 'text-white/60'}`}>
                        {formatGen(preview.entryFeeWei, 6)} {symbol}
                      </span>
                    </Row>
                    <Row label="Prize pool">
                      <span className="font-mono text-gold">
                        {formatGen(preview.prizePoolWei, 6)} {symbol}
                      </span>
                    </Row>
                    {preview.entryFeeWei > 0n && (
                      <p className="pt-1.5 mt-1.5 border-t border-white/10 text-white/50">
                        Joining will charge your wallet{' '}
                        <span className="text-neon font-mono">
                          {formatGen(preview.entryFeeWei, 6)} {symbol}
                        </span>.
                      </p>
                    )}
                  </div>
                )}
                {!previewing && roomCode.length >= 20 && preview === null && (
                  <p className="text-signal/70 text-xs mt-2">
                    Could not load this room. Double-check the address.
                  </p>
                )}
              </div>
            )}

            <button
              className={`btn w-full py-4 text-base ${mode === 'create' ? 'btn-neon' : 'btn-plasma'}`}
              onClick={mode === 'create' ? handleCreate : handleJoin}
              disabled={
                loading
                || !name.trim()
                || (mode === 'join' && roomCode.length < 10)
                || (mode === 'create' && entryFeeWei === null)
              }
            >
              {loading
                ? '⏳ Talking to GenLayer…'
                : mode === 'create'
                  ? entryFeeWei && entryFeeWei > 0n
                    ? `🎮 Deploy & Stake ${formatGen(entryFeeWei, 6)} ${symbol}`
                    : '🎮 Deploy & Enter'
                  : preview && preview.entryFeeWei > 0n
                    ? `🚀 Join — Pay ${formatGen(preview.entryFeeWei, 6)} ${symbol}`
                    : '🚀 Join Game'}
            </button>
          </div>
        )}
      </div>

      {/* GenLayer attribution */}
      <div className="mt-12 text-center animate-fade-in" style={{ animationDelay: '0.3s' }}>
        <p className="text-white/20 text-xs font-mono">
          Built on{' '}
          <a href="https://genlayer.com" target="_blank" rel="noopener" className="text-plasma/50 hover:text-plasma transition-colors">
            GenLayer
          </a>{' '}
          · Intelligent Contracts · Optimistic Democracy
        </p>
      </div>
    </div>
  )
}

function Row({ label, children }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-white/40 font-mono uppercase tracking-wider text-[10px]">{label}</span>
      {children}
    </div>
  )
}
