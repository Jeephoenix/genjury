import React, { useEffect, useMemo, useState } from 'react'
import { Drama, Brain, Vote, Coins, ArrowLeft } from 'lucide-react'
import useGameStore from '../lib/store'
import {
  parseGen,
  formatGen,
  getChainNativeSymbol,
  subscribeWallet,
  getDefaultContractAddress,
  explorerAddressUrl,
  getNetworkInfo,
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
  const lastDiag   = useGameStore(s => s.lastPreviewDiagnostic)
  const setActiveTab = useGameStore(s => s.setActiveTab)

  const [, force] = useState(0)
  useEffect(() => subscribeWallet(() => force((n) => n + 1)), [])

  // Deep-link support: if the URL contains ?join=<contractAddress>, jump
  // straight into the Join Room screen with the address pre-filled. Then
  // strip the param from the URL so refreshes/back-navigation don't keep
  // re-triggering. Lets hosts share a one-tap "Join my room" link.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const joinParam = params.get('join')
    if (!joinParam) return
    const cleaned = (() => {
      let s = String(joinParam).trim()
      if (s.toLowerCase().startsWith('0x')) s = s.slice(2)
      s = s.replace(/[^0-9a-fA-F]/g, '').toLowerCase().slice(0, 40)
      return s ? `0x${s}` : ''
    })()
    if (/^0x[0-9a-f]{40}$/.test(cleaned)) {
      setMode('join')
      setRoomCode(cleaned)
    }
    params.delete('join')
    const qs = params.toString()
    window.history.replaceState(
      {},
      '',
      window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash,
    )
  }, [])

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

  // Normalize a pasted contract address: strip whitespace and any leading "0x",
  // keep only hex chars, lowercase, then re-prepend "0x". Tolerates messy
  // copies from chat apps (line breaks, surrounding quotes, missing prefix).
  const normalizeAddress = (raw) => {
    if (!raw) return ''
    let s = String(raw).trim()
    if (s.toLowerCase().startsWith('0x')) s = s.slice(2)
    s = s.replace(/[^0-9a-fA-F]/g, '').toLowerCase().slice(0, 40)
    return s ? `0x${s}` : ''
  }

  const isValidAddress = (s) => /^0x[0-9a-f]{40}$/.test(s || '')

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
      {/* Back to Games */}
      <div className="w-full max-w-sm mb-2 -mt-10">
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
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="relative">
            <div className="w-28 h-28 rounded-2xl bg-neon/10 border border-neon/30 flex items-center justify-center text-neon drop-shadow-[0_0_20px_rgba(127,255,110,0.35)]">
              <Brain className="w-14 h-14" strokeWidth={1.75} />
            </div>
            <div className="absolute -inset-2 bg-neon/20 rounded-full blur-xl animate-pulse pointer-events-none" />
          </div>
        </div>

        <div className="inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.2em] text-white/40 mb-3">
          <span className="w-1.5 h-1.5 rounded-full bg-neon animate-pulse" />
          A Genjury game · LIVE
        </div>

        <h1 className="font-display text-6xl sm:text-7xl font-800 leading-none mb-4">
          <span className="shimmer-text">Mistrial</span>
        </h1>

        <p className="text-white/50 text-lg sm:text-xl max-w-lg mx-auto leading-relaxed font-body">
          Two truths, one lie. Fool the players. Fool the AI Judge.
          <br />
          <span className="text-plasma/80">Stake {symbol}, win the pot, on GenLayer.</span>
        </p>

        {/* Mechanic pills */}
        <div className="flex flex-wrap gap-2 justify-center mt-6">
          {[
            { Icon: Drama, label: 'Deceiver vs Detectors' },
            { Icon: Brain, label: 'AI Judge' },
            { Icon: Vote,  label: 'Optimistic Democracy' },
            { Icon: Coins, label: `Winner takes the ${symbol} pot` },
          ].map(({ Icon, label }) => (
            <span
              key={label}
              className="inline-flex items-center gap-1.5 badge bg-white/5 border border-white/10 text-white/65 text-sm py-1.5 px-3"
            >
              <Icon className="w-3.5 h-3.5 text-white/55" strokeWidth={2.25} />
              {label}
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
              Skip the deploy step — jump straight into the official Mistrial room.
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
                <textarea
                  className="input font-mono text-xs leading-snug resize-none break-all whitespace-pre-wrap"
                  rows={2}
                  placeholder="0x…"
                  value={roomCode}
                  onChange={e => setRoomCode(normalizeAddress(e.target.value))}
                  onPaste={e => {
                    e.preventDefault()
                    setRoomCode(normalizeAddress(e.clipboardData.getData('text')))
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleJoin()
                    }
                  }}
                />
                <p className="text-white/30 text-xs mt-1">Paste the GenLayer contract address from the host.</p>

                {/* Always-visible address confirmation: lets the user verify both ends
                    of the address even if the input is too narrow to show it all. */}
                {roomCode && (() => {
                  const valid = isValidAddress(roomCode)
                  const tooShort = roomCode.length < 42
                  return (
                    <div className={`mt-2 rounded-lg border px-3 py-2 text-xs font-mono break-all ${
                      valid
                        ? 'border-neon/30 bg-neon/5 text-neon/90'
                        : 'border-signal/30 bg-signal/5 text-signal/80'
                    }`}>
                      <div className="flex items-center justify-between gap-2 mb-1 font-sans not-italic">
                        <span className="text-[10px] uppercase tracking-wider text-white/40">
                          {valid ? '✓ Valid address' : tooShort ? 'Looks incomplete' : 'Invalid characters'}
                        </span>
                        <span className="text-[10px] text-white/30">{roomCode.length} / 42</span>
                      </div>
                      {roomCode}
                    </div>
                  )
                })()}

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
                {!previewing && isValidAddress(roomCode) && preview === null && (
                  <PreviewDiagnostic
                    address={roomCode}
                    diagnostic={lastDiag && lastDiag.address?.toLowerCase() === roomCode.toLowerCase() ? lastDiag : null}
                  />
                )}
              </div>
            )}

            <button
              className={`btn w-full py-4 text-base ${mode === 'create' ? 'btn-neon' : 'btn-plasma'}`}
              onClick={mode === 'create' ? handleCreate : handleJoin}
              disabled={
                loading
                || !name.trim()
                || (mode === 'join' && !isValidAddress(roomCode))
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

// Render a precise, actionable error when the Join-Room preview comes back
// empty. Falls back to the original generic message when no diagnostic is
// available yet (e.g. before the first preview attempt completes).
function PreviewDiagnostic({ address, diagnostic }) {
  const network = getNetworkInfo()
  const explorerUrl = explorerAddressUrl(address)
  const kind = diagnostic?.kind || 'rpc_error'

  const headline =
    kind === 'no_bytecode'
      ? `Nothing is deployed at this address on ${network.label}.`
      : kind === 'not_registered'
        ? `An address exists here on ${network.label}, but it isn't a finalized GenLayer contract.`
        : kind === 'rpc_error'
          ? `Couldn't reach ${network.label} to check this address.`
          : `No room found at this address on ${network.label}.`

  const detail =
    kind === 'no_bytecode'
      ? 'Double-check the address with the host and confirm you are both on the same chain.'
      : kind === 'not_registered'
        ? "The host's deployment likely reverted or hasn't reached consensus yet. Ask the host to verify the deploy succeeded — or, if it just happened, give it a minute and try again."
        : kind === 'rpc_error'
          ? 'The network may be temporarily unavailable. Try again in a moment.'
          : 'Double-check the contract address and that your wallet is on the same chain as the host.'

  return (
    <div className="mt-2 rounded-lg border border-signal/30 bg-signal/5 px-3 py-3 text-xs space-y-2">
      <p className="text-signal/90 leading-snug">
        <span className="font-semibold">{headline}</span>{' '}
        <span className="text-signal/70">{detail}</span>
      </p>
      {diagnostic?.message && kind === 'rpc_error' && (
        <p className="font-mono text-[10px] text-signal/60 break-all">
          {diagnostic.message}
        </p>
      )}
      {explorerUrl && (
        <div className="flex items-center gap-2 pt-1">
          <a
            href={explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white transition-colors text-[11px] font-mono"
          >
            🔍 View on Explorer
          </a>
          <span className="text-white/30 text-[10px] font-mono">to verify the deploy</span>
        </div>
      )}
    </div>
  )
}
