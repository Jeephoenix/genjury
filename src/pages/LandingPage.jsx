import React, { useEffect, useMemo, useState } from 'react'
import useGameStore from '../lib/store'
import {
  parseGen,
  formatGen,
  getChainNativeSymbol,
  isInjectedActive,
  hasInjectedProvider,
  connectInjectedWallet,
  subscribeWallet,
} from '../lib/genlayer'

const PRESET_FEES = ['0', '0.01', '0.1', '1']

export default function LandingPage() {
  const [mode, setMode] = useState(null) // 'create' | 'join' | null
  const [name, setName] = useState('')

  // Create-room form
  const [entryFee, setEntryFee]         = useState('0')
  const [platformPct, setPlatformPct]   = useState('5')
  const [maxRounds, setMaxRounds]       = useState(3)
  const [feeError, setFeeError]         = useState(null)
  const [pctError, setPctError]         = useState(null)

  // Join-room form
  const [roomCode, setRoomCode] = useState('')
  const [preview, setPreview]   = useState(null)
  const [previewing, setPreviewing] = useState(false)

  const createRoom = useGameStore(s => s.createRoom)
  const joinRoom   = useGameStore(s => s.joinRoom)
  const previewRoom = useGameStore(s => s.previewRoom)
  const addToast   = useGameStore(s => s.addToast)
  const loading    = useGameStore(s => s.loading)

  const [, force] = useState(0)
  useEffect(() => subscribeWallet(() => force((n) => n + 1)), [])

  const symbol     = getChainNativeSymbol()
  const usingWallet = isInjectedActive()
  const canConnect  = hasInjectedProvider()

  const entryFeeWei = useMemo(() => {
    try { return parseGen(entryFee) } catch { return null }
  }, [entryFee])

  const platformBps = useMemo(() => {
    const n = Number(platformPct)
    if (!Number.isFinite(n)) return null
    return Math.round(n * 100)
  }, [platformPct])

  const validateCreate = () => {
    let ok = true
    if (entryFeeWei === null) {
      setFeeError(`Invalid ${symbol} amount`); ok = false
    } else { setFeeError(null) }
    if (platformBps === null || platformBps < 0 || platformBps > 2000) {
      setPctError('Must be between 0 and 20%'); ok = false
    } else { setPctError(null) }
    return ok
  }

  const handleCreate = () => {
    if (!name.trim() || loading) return
    if (!validateCreate()) return
    createRoom(name.trim(), {
      entryFeeWei,
      platformFeeBps: platformBps,
      maxRounds: Number(maxRounds),
    })
  }

  const handleJoin = () => {
    if (!name.trim() || !roomCode.trim() || loading) return
    joinRoom(roomCode.trim(), name.trim())
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

  const handleQuickConnect = async () => {
    try { await connectInjectedWallet() }
    catch (e) { addToast(e?.shortMessage || e?.message || 'Could not connect wallet', 'error') }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-20 relative">
      {/* Hero */}
      <div className="text-center mb-10 animate-slide-up">
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="relative">
            <div className="text-6xl">⚖️</div>
            <div className="absolute -inset-2 bg-plasma/20 rounded-full blur-xl animate-pulse" />
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

      {/* Wallet status banner */}
      {!usingWallet && (
        <div className="w-full max-w-sm mb-4 rounded-xl bg-plasma/8 border border-plasma/25 px-4 py-3 text-xs text-white/70 flex items-center justify-between gap-3">
          <span>
            <span className="text-plasma font-600">Burner key active.</span>{' '}
            {canConnect
              ? `Connect your wallet to play with real ${symbol}.`
              : `Install MetaMask to play with real ${symbol}.`}
          </span>
          {canConnect && (
            <button
              className="btn btn-plasma px-3 py-1.5 text-[11px] flex-shrink-0"
              onClick={handleQuickConnect}
            >
              Connect
            </button>
          )}
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

                {/* Platform fee */}
                <div>
                  <label className="text-white/50 text-xs font-mono uppercase tracking-wider mb-2 block">
                    Platform fee (% of each entry)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      className="input font-mono"
                      placeholder="0"
                      value={platformPct}
                      onChange={e => setPlatformPct(e.target.value.replace(',', '.'))}
                      inputMode="decimal"
                    />
                    <span className="text-white/40 font-mono text-sm flex-shrink-0">%</span>
                  </div>
                  <p className="text-white/30 text-xs mt-1.5">
                    Routed to your wallet (the deployer). Capped at 20%.
                    {entryFeeWei && entryFeeWei > 0n && platformBps !== null && (
                      <>
                        {' '}Per entry → owner takes{' '}
                        <span className="text-plasma font-mono">
                          {formatGen((entryFeeWei * BigInt(platformBps)) / 10000n, 6)} {symbol}
                        </span>, pot gets{' '}
                        <span className="text-neon font-mono">
                          {formatGen(entryFeeWei - (entryFeeWei * BigInt(platformBps)) / 10000n, 6)} {symbol}
                        </span>.
                      </>
                    )}
                  </p>
                  {pctError && <p className="text-signal text-xs mt-1.5">{pctError}</p>}
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
                    <Row label="Platform fee">
                      <span className="font-mono text-white/60">
                        {(preview.platformFeeBps / 100).toFixed(2)}%
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
                || (mode === 'create' && (entryFeeWei === null || platformBps === null || platformBps < 0 || platformBps > 2000))
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
