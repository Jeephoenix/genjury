import React, { useEffect, useMemo, useState } from 'react'
import {
  Drama, Brain, Vote, Coins, ArrowLeft, Plus, Sparkles,
  ChevronDown, ChevronUp, Info, Gavel, Wallet, Trophy,
  Building2, UserPlus, Zap,
} from 'lucide-react'
import useGameStore from '../lib/store'
import MistrialMark from '../components/MistrialMark'
import OpenRoundsList from '../components/OpenRoundsList'
import {
  parseGen, formatGen, getChainNativeSymbol,
  subscribeWallet, isWalletConnected, hasContractAddress,
  isValidRoomCode, normalizeRoomCode, readContractView,
} from '../lib/genlayer'
import { getProfile, subscribeProfile } from '../lib/profile'
import { rememberJoinedRoom } from '../lib/joinedRooms'

const PRESET_FEES          = ['0', '0.01', '0.1', '1']
const HOUSE_CUT_BPS_DEFAULT = 500

export default function MistrialPage() {
  const [showCreate,      setShowCreate]      = useState(true)
  const [showJoinByCode,  setShowJoinByCode]  = useState(true)
  const [joinCodeInput,   setJoinCodeInput]   = useState('')
  const [invitedCode,     setInvitedCode]     = useState(null)

  const [entryFee,    setEntryFee]    = useState('0.01')
  const [maxRounds,   setMaxRounds]   = useState(3)
  const [maxPlayers,  setMaxPlayers]  = useState(8)
  const [feeError,    setFeeError]    = useState(null)
  const [houseCutBps, setHouseCutBps] = useState(HOUSE_CUT_BPS_DEFAULT)

  const createRoom    = useGameStore((s) => s.createRoom)
  const joinRoom      = useGameStore((s) => s.joinRoom)
  const loading       = useGameStore((s) => s.loading)
  const setActiveTab  = useGameStore((s) => s.setActiveTab)
  const setOpenWallet = useGameStore((s) => s.setWalletPanelOpen)

  const [, force] = useState(0)
  useEffect(() => subscribeWallet(()  => force((n) => n + 1)), [])
  useEffect(() => subscribeProfile(() => force((n) => n + 1)), [])

  useEffect(() => {
    if (!hasContractAddress()) return
    let cancelled = false
    ;(async () => {
      try {
        const raw    = await readContractView('get_house_info', [])
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
        const bps    = Number(parsed?.houseCutBps ?? HOUSE_CUT_BPS_DEFAULT)
        if (!cancelled && Number.isFinite(bps)) setHouseCutBps(bps)
      } catch {}
    })()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params    = new URLSearchParams(window.location.search)
    const joinParam = params.get('join')
    if (joinParam) {
      const code = normalizeRoomCode(joinParam)
      if (isValidRoomCode(code)) {
        params.delete('join')
        const qs = params.toString()
        window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash)
        const readyToJoin = isWalletConnected() && hasContractAddress() && getProfile().name
        if (readyToJoin) {
          joinRoom(code)
        } else {
          setInvitedCode(code)
          setJoinCodeInput(code)
          setShowJoinByCode(true)
          rememberJoinedRoom(code)
        }
      }
    }
  }, [joinRoom])

  const symbol             = getChainNativeSymbol()
  const profile            = getProfile()
  const connected          = isWalletConnected()
  const contractConfigured = hasContractAddress()

  const entryFeeWei = useMemo(() => {
    try { return parseGen(entryFee) } catch { return null }
  }, [entryFee])

  const handleCreate = () => {
    if (loading) return
    if (!connected) { setOpenWallet(true); return }
    if (entryFeeWei === null) { setFeeError(`Invalid ${symbol} amount`); return }
    setFeeError(null)
    createRoom(profile.name, { entryFeeWei, maxRounds: Number(maxRounds), maxPlayers: Number(maxPlayers) })
  }

  const handleJoinByCode = () => {
    const code = normalizeRoomCode(joinCodeInput)
    if (!isValidRoomCode(code)) return
    if (!connected) { setOpenWallet(true); return }
    joinRoom(code)
  }

  const validJoinCode = isValidRoomCode(normalizeRoomCode(joinCodeInput))

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-10 sm:py-14 relative overflow-x-hidden">

      {/* Back */}
      <div className="mb-6">
        <button
          onClick={() => setActiveTab('games')}
          className="inline-flex items-center gap-1.5 text-white/40 hover:text-white text-xs font-mono uppercase tracking-[0.18em] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" strokeWidth={2.25} />
          All games
        </button>
      </div>

      {/* Hero */}
      <div className="text-center mb-12 animate-slide-up">
        <div className="flex items-center justify-center mb-7">
          <div className="relative">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-neon/[0.09] border border-neon/25 flex items-center justify-center text-neon"
              style={{ boxShadow: '0 0 40px rgba(127,255,110,0.18), inset 0 1px 0 rgba(127,255,110,0.15)' }}>
              <MistrialMark className="w-14 h-14 sm:w-16 sm:h-16" />
            </div>
            {/* Animated pulse ring */}
            <div className="absolute inset-0 rounded-3xl border border-neon/30 animate-ping opacity-20 pointer-events-none" />
            <div className="absolute -inset-3 rounded-3xl bg-neon/10 blur-2xl opacity-40 pointer-events-none" />
          </div>
        </div>

        <div className="inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.22em] text-white/35 mb-4">
          <span className="w-1.5 h-1.5 rounded-full bg-neon shadow-[0_0_6px_#7fff6e]" />
          A Genjury game · LIVE
        </div>

        <h1 className="font-display text-5xl sm:text-7xl font-black leading-none mb-4 tracking-tight">
          <span className="shimmer-text">Mistrial</span>
        </h1>

        <p className="text-white/50 text-base sm:text-lg max-w-lg mx-auto leading-relaxed mb-6">
          Two truths, one lie. Bluff the jury. Outwit the AI Judge.
          <br />
          <span className="text-plasma/80">Stake {symbol}, win the purse, on GenLayer.</span>
        </p>

        <div className="flex flex-wrap gap-2 justify-center">
          {[
            { Icon: Drama,  label: 'Defendant vs Jury' },
            { Icon: Brain,  label: 'AI Judge' },
            { Icon: Gavel,  label: 'Objections allowed' },
            { Icon: Coins,  label: `Winner takes the ${symbol} purse` },
          ].map(({ Icon, label }) => (
            <span
              key={label}
              className="inline-flex items-center gap-1.5 badge bg-white/[0.04] border border-white/[0.09] text-white/60 text-sm py-1.5 px-3.5"
            >
              <Icon className="w-3.5 h-3.5 text-white/45" strokeWidth={2.25} />
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* Contract not configured warning */}
      {!contractConfigured && (
        <div className="glass rounded-2xl border border-signal/35 bg-signal/[0.05] p-5 mb-6 animate-slide-up">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-signal mt-0.5 flex-shrink-0" strokeWidth={2} />
            <div>
              <h3 className="font-display font-bold text-white text-sm mb-1">Contract not configured</h3>
              <p className="text-white/55 text-sm leading-relaxed">
                The Genjury contract address (<code className="font-mono text-white/80 text-xs">VITE_GENJURY_CONTRACT</code>) is missing.
                The platform owner needs to deploy the singleton contract and add the address to the environment.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Invite banner */}
      {invitedCode && (
        <div className="glass rounded-2xl border border-neon/25 bg-neon/[0.04] p-5 mb-6 animate-slide-up">
          <div className="flex items-start gap-3">
            <UserPlus className="w-5 h-5 text-neon mt-0.5 flex-shrink-0" strokeWidth={2} />
            <div className="flex-1 min-w-0">
              <h3 className="font-display font-bold text-white text-sm mb-1">
                You've been invited to case{' '}
                <span className="text-neon font-mono tracking-widest">{invitedCode}</span>
              </h3>
              <p className="text-white/50 text-sm">
                {!connected
                  ? 'Connect your wallet and set a player name, then click "Take a seat" below.'
                  : !getProfile().name
                  ? 'Set a player name in your profile, then click "Take a seat" below.'
                  : 'Click "Take a seat" in the join form below to enter the courtroom.'}
              </p>
            </div>
            <button
              onClick={() => setInvitedCode(null)}
              className="text-white/25 hover:text-white/60 flex-shrink-0 text-xl leading-none transition-colors"
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Open docket */}
      <div className="glass rounded-2xl border border-white/[0.08] p-5 mb-5 animate-slide-up" style={{ animationDelay: '0.05s' }}>
        <OpenRoundsList
          title="The docket — live courthouse"
          emptyHint="No cases on the docket. Open one below — friends will see it instantly."
        />
      </div>

      {/* Open new case */}
      <div className="glass rounded-2xl border border-white/[0.08] p-5 mb-5 animate-slide-up" style={{ animationDelay: '0.1s' }}>
        <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
          <div>
            <h2 className="font-display font-bold text-base text-white inline-flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-neon" strokeWidth={2} />
              Open a new case
            </h2>
            <p className="text-white/40 text-sm">
              You become the host. Set the entry fee, docket length, and jury size.
            </p>
          </div>
          <button
            onClick={() => setShowCreate((v) => !v)}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-neon/30 bg-neon/[0.08] text-neon text-sm font-semibold hover:bg-neon/15 transition-all flex-shrink-0"
          >
            <Plus className="w-4 h-4" strokeWidth={2.25} />
            {showCreate ? 'Hide' : 'Open new case'}
          </button>
        </div>

        {showCreate && (
          <div className="mt-5 space-y-4 animate-fade-in">
            {!profile.name && (
              <div className="rounded-lg bg-signal/[0.08] border border-signal/25 px-3.5 py-2.5 text-xs text-signal inline-flex items-center gap-2">
                <Info className="w-3.5 h-3.5" /> Set a player name in your profile first.
              </div>
            )}

            {/* Entry fee */}
            <div>
              <label className="text-white/40 text-[10px] font-mono uppercase tracking-wider mb-2 block">
                Entry fee per juror ({symbol})
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
                    className={`badge px-2.5 py-1.5 text-[11px] cursor-pointer transition-all ${
                      entryFee === v
                        ? 'bg-neon/15 text-neon border border-neon/35'
                        : 'bg-white/[0.04] text-white/45 border border-white/[0.08] hover:text-white hover:bg-white/[0.08]'
                    }`}
                  >
                    {v} {symbol}
                  </button>
                ))}
              </div>
              {feeError && <p className="text-signal text-xs mt-1.5">{feeError}</p>}
            </div>

            {/* Rounds + jury size */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-white/40 text-[10px] font-mono uppercase tracking-wider mb-2 block">
                  Total rounds
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[2, 3, 5, 7].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setMaxRounds(n)}
                      className={`rounded-xl py-2.5 text-sm font-mono transition-all ${
                        maxRounds === n
                          ? 'bg-neon/15 text-neon border border-neon/35 shadow-[0_0_12px_rgba(127,255,110,0.1)]'
                          : 'bg-white/[0.04] text-white/45 border border-white/[0.08] hover:text-white hover:bg-white/[0.08]'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-white/40 text-[10px] font-mono uppercase tracking-wider mb-2 block">
                  Jury size
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[4, 6, 8, 12].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setMaxPlayers(n)}
                      className={`rounded-xl py-2.5 text-sm font-mono transition-all ${
                        maxPlayers === n
                          ? 'bg-neon/15 text-neon border border-neon/35 shadow-[0_0_12px_rgba(127,255,110,0.1)]'
                          : 'bg-white/[0.04] text-white/45 border border-white/[0.08] hover:text-white hover:bg-white/[0.08]'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <MoneyMap
              entryFeeWei={entryFeeWei}
              maxPlayers={Number(maxPlayers)}
              houseCutBps={houseCutBps}
              symbol={symbol}
            />

            <button
              className="btn btn-crimson w-full py-3.5 text-base inline-flex items-center justify-center gap-2"
              onClick={handleCreate}
              disabled={loading || entryFeeWei === null || !profile.name || !contractConfigured}
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-4 h-4 text-black/60" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Filing case on-chain…
                </>
              ) : !connected ? (
                <><Wallet className="w-4 h-4" strokeWidth={2.25} /> Connect wallet to file case</>
              ) : entryFeeWei && entryFeeWei > 0n ? (
                <><Zap className="w-4 h-4" strokeWidth={2.5} /> File case · stake {formatGen(entryFeeWei, 6)} {symbol}</>
              ) : (
                <><Zap className="w-4 h-4" strokeWidth={2.5} /> File case</>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Join by code */}
      <div
        className="glass rounded-2xl border border-white/[0.06] px-5 py-4 animate-fade-in"
        style={{ animationDelay: '0.15s' }}
      >
        <button
          onClick={() => setShowJoinByCode((v) => !v)}
          className="w-full flex items-center justify-between text-white/50 hover:text-white/80 text-xs font-mono uppercase tracking-[0.18em] transition-colors"
        >
          <span>Join by case code (e.g. TRIAL9)</span>
          {showJoinByCode ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
        {showJoinByCode && (
          <div className="mt-3.5 flex flex-col sm:flex-row gap-2.5 animate-fade-in">
            <input
              className="input font-mono text-sm flex-1 uppercase tracking-[0.25em]"
              placeholder="ABCDEF"
              value={joinCodeInput}
              onChange={(e) => setJoinCodeInput(normalizeRoomCode(e.target.value))}
              maxLength={6}
            />
            <button
              onClick={handleJoinByCode}
              disabled={loading || !validJoinCode}
              className="px-5 py-2.5 rounded-xl border border-plasma/35 bg-plasma/12 text-plasma text-sm font-semibold hover:bg-plasma/22 disabled:opacity-50 inline-flex items-center gap-2 transition-all"
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-3.5 h-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Joining…
                </>
              ) : 'Take a seat'}
            </button>
          </div>
        )}
      </div>

      {/* Attribution */}
      <div className="mt-14 text-center animate-fade-in" style={{ animationDelay: '0.3s' }}>
        <p className="text-white/18 text-xs font-mono">
          Built on{' '}
          <a href="https://genlayer.com" target="_blank" rel="noopener" className="text-plasma/45 hover:text-plasma transition-colors">
            GenLayer
          </a>{' '}
          · Intelligent Contracts · Optimistic Democracy
        </p>
      </div>
    </div>
  )
}

function MoneyMap({ entryFeeWei, maxPlayers, houseCutBps, symbol }) {
  const fee       = entryFeeWei ?? 0n
  const cap       = Math.max(2, Number(maxPlayers) || 0)
  const totalPot  = fee * BigInt(cap)
  const cutBps    = BigInt(Math.max(0, Math.min(10_000, Number(houseCutBps) || 0)))
  const houseTake = (totalPot * cutBps) / 10_000n
  const winnerTake = totalPot - houseTake
  const cutPct    = Number(cutBps) / 100

  return (
    <div className="rounded-2xl border border-white/[0.09] bg-gradient-to-br from-gold/[0.04] via-white/[0.01] to-transparent p-4">
      <div className="flex items-center gap-2 mb-3.5">
        <Trophy className="w-4 h-4 text-gold" strokeWidth={2} />
        <h3 className="font-display font-bold text-white text-sm">Money map</h3>
        <span className="text-white/30 text-[10px] font-mono uppercase tracking-wider">
          where every {symbol} goes
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-3.5">
        <MapCell
          icon={<Wallet className="w-3.5 h-3.5 text-white/50" />}
          label={`Per juror (×${cap})`}
          value={`${formatGen(fee, 6)} ${symbol}`}
          sub={`Total purse: ${formatGen(totalPot, 6)} ${symbol}`}
        />
        <MapCell
          icon={<Trophy className="w-3.5 h-3.5 text-gold" />}
          label="Winner takes"
          value={`${formatGen(winnerTake, 6)} ${symbol}`}
          sub={`${(100 - cutPct).toFixed(2)}% of the purse`}
          accent="gold"
        />
        <MapCell
          icon={<Building2 className="w-3.5 h-3.5 text-plasma" />}
          label="House keeps"
          value={`${formatGen(houseTake, 6)} ${symbol}`}
          sub={`${cutPct.toFixed(2)}% — covers the AI Judge`}
          accent="plasma"
        />
      </div>

      {/* Stacked bar */}
      <div className="h-2 rounded-full overflow-hidden bg-white/[0.05] border border-white/[0.08] flex">
        <div className="h-full bg-gold/65" style={{ width: `${100 - cutPct}%` }} title={`Winner: ${(100 - cutPct).toFixed(2)}%`} />
        <div className="h-full bg-plasma/65" style={{ width: `${cutPct}%` }} title={`House: ${cutPct.toFixed(2)}%`} />
      </div>
      <p className="text-white/30 text-[11px] mt-2 leading-relaxed">
        Refunds are automatic if the case never starts. Kicked players get their stake back.
      </p>
    </div>
  )
}

function MapCell({ icon, label, value, sub, accent }) {
  const accentText = accent === 'gold' ? 'text-gold' : accent === 'plasma' ? 'text-plasma' : 'text-white'
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-3">
      <div className="flex items-center gap-1.5 mb-1.5">
        {icon}
        <span className="text-[10px] font-mono uppercase tracking-wider text-white/35">{label}</span>
      </div>
      <div className={`font-mono text-sm font-medium ${accentText}`}>{value}</div>
      {sub && <div className="text-white/30 text-[11px] mt-1 font-mono">{sub}</div>}
    </div>
  )
}
