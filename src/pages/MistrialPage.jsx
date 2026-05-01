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
  Gavel,
  Wallet,
  Trophy,
  Building2,
  UserPlus,
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
  hasContractAddress,
  isValidRoomCode,
  normalizeRoomCode,
  readContractView,
} from '../lib/genlayer'
import { getProfile, subscribeProfile } from '../lib/profile'
import { rememberJoinedRoom } from '../lib/joinedRooms'

const PRESET_FEES = ['0', '0.01', '0.1', '1']
const HOUSE_CUT_BPS_DEFAULT = 500   // 5% — used until the contract reports its real cut

export default function MistrialPage() {
  const [showCreate, setShowCreate]     = useState(true)
  const [showJoinByCode, setShowJoinByCode] = useState(true)
  const [joinCodeInput, setJoinCodeInput]   = useState('')
  const [invitedCode, setInvitedCode]       = useState(null) // code from ?join= deep link

  // Create-room form
  const [entryFee, setEntryFee]   = useState('0.01')
  const [maxRounds, setMaxRounds] = useState(3)
  const [maxPlayers, setMaxPlayers] = useState(8)
  const [feeError, setFeeError]   = useState(null)

  // House cut, fetched once from the contract so the money map is honest.
  const [houseCutBps, setHouseCutBps] = useState(HOUSE_CUT_BPS_DEFAULT)

  const createRoom    = useGameStore(s => s.createRoom)
  const joinRoom      = useGameStore(s => s.joinRoom)
  const loading       = useGameStore(s => s.loading)
  const setActiveTab  = useGameStore(s => s.setActiveTab)
  const setOpenWallet = useGameStore(s => s.setWalletPanelOpen)

  const [, force] = useState(0)
  useEffect(() => subscribeWallet(() => force((n) => n + 1)), [])
  useEffect(() => subscribeProfile(() => force((n) => n + 1)), [])

  // Pull the live house cut so the money map is accurate.
  useEffect(() => {
    if (!hasContractAddress()) return
    let cancelled = false
    ;(async () => {
      try {
        const raw = await readContractView('get_house_info', [])
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
        const bps = Number(parsed?.houseCutBps ?? HOUSE_CUT_BPS_DEFAULT)
        if (!cancelled && Number.isFinite(bps)) setHouseCutBps(bps)
      } catch {}
    })()
    return () => { cancelled = true }
  }, [])

  // Deep-link: ?join=ABCDEF
  // If the user is already connected + has a profile name, auto-trigger the
  // join so they land directly in the lobby with one tap. Otherwise show a
  // prominent invite banner and pre-fill the join form so they can connect
  // their wallet first and then join with a single click.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const joinParam = params.get('join')
    if (joinParam) {
      const code = normalizeRoomCode(joinParam)
      if (isValidRoomCode(code)) {
        // Strip the param from the address bar immediately.
        params.delete('join')
        const qs = params.toString()
        window.history.replaceState({}, '',
          window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash)

        const readyToJoin =
          isWalletConnected() &&
          hasContractAddress() &&
          getProfile().name

        if (readyToJoin) {
          // All set — jump straight into the room.
          joinRoom(code)
        } else {
          // Not yet ready — show the invite banner and pre-fill the form.
          setInvitedCode(code)
          setJoinCodeInput(code)
          setShowJoinByCode(true)
          rememberJoinedRoom(code)
        }
      }
    }
  }, [joinRoom])

  const symbol  = getChainNativeSymbol()
  const profile = getProfile()
  const connected = isWalletConnected()
  const contractConfigured = hasContractAddress()

  const entryFeeWei = useMemo(() => {
    try { return parseGen(entryFee) } catch { return null }
  }, [entryFee])

  const handleCreate = () => {
    if (loading) return
    if (!connected) { setOpenWallet(true); return }
    if (entryFeeWei === null) { setFeeError(`Invalid ${symbol} amount`); return }
    setFeeError(null)
    createRoom(profile.name, {
      entryFeeWei,
      maxRounds:  Number(maxRounds),
      maxPlayers: Number(maxPlayers),
    })
  }

  const handleJoinByCode = () => {
    const code = normalizeRoomCode(joinCodeInput)
    if (!isValidRoomCode(code)) return
    if (!connected) { setOpenWallet(true); return }
    joinRoom(code)
  }

  const validJoinCode = isValidRoomCode(normalizeRoomCode(joinCodeInput))

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
          Two truths, one lie. Bluff the jury. Outwit the AI Judge.
          <br />
          <span className="text-plasma/85">Stake {symbol}, win the purse, on GenLayer.</span>
        </p>

        <div className="flex flex-wrap gap-2 justify-center mt-6">
          {[
            { Icon: Drama, label: 'Defendant vs Jury' },
            { Icon: Brain, label: 'AI Judge' },
            { Icon: Gavel, label: 'Objections allowed' },
            { Icon: Coins, label: `Winner takes the ${symbol} purse` },
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

      {/* Contract not configured warning */}
      {!contractConfigured && (
        <div className="card glass border-signal/40 bg-signal/[0.05] mb-5 animate-slide-up">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-signal mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-display font-700 text-white">Contract not configured</h3>
              <p className="text-white/65 text-sm mt-1">
                The Genjury contract address (<code className="font-mono text-white/85">VITE_GENJURY_CONTRACT</code>)
                is missing. The platform owner needs to deploy the singleton contract once and add the address to
                the project's environment.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Invite banner — shown when the user arrived via a ?join= deep link
          but couldn't be auto-joined (no wallet / no profile yet). */}
      {invitedCode && (
        <div className="card glass border-neon/30 bg-neon/[0.04] mb-5 animate-slide-up">
          <div className="flex items-start gap-3">
            <UserPlus className="w-5 h-5 text-neon mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <h3 className="font-display font-700 text-white">
                You've been invited to case{' '}
                <span className="text-neon font-mono tracking-widest">{invitedCode}</span>
              </h3>
              <p className="text-white/60 text-sm mt-1">
                {!connected
                  ? 'Connect your wallet and set a player name, then click "Take a seat" in the join form below.'
                  : !getProfile().name
                    ? 'Set a player name in your profile, then click "Take a seat" in the join form below.'
                    : 'Click "Take a seat" in the join form below to enter the courtroom.'}
              </p>
            </div>
            <button
              onClick={() => setInvitedCode(null)}
              className="text-white/30 hover:text-white/70 flex-shrink-0 transition-colors"
              aria-label="Dismiss"
            >
              <span className="text-lg leading-none">×</span>
            </button>
          </div>
        </div>
      )}

      {/* Live courthouse / open cases */}
      <div className="card glass mb-5 animate-slide-up" style={{ animationDelay: '0.05s' }}>
        <OpenRoundsList
          title="The docket — live courthouse"
          emptyHint="No cases on the docket. Open one below — friends will see it instantly."
        />
      </div>

      {/* Open new case */}
      <div className="card glass mb-5 animate-slide-up" style={{ animationDelay: '0.1s' }}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="font-display font-700 text-base text-white inline-flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-neon" />
              Open a new case
            </h2>
            <p className="text-white/50 text-sm mt-1">
              You become the host. Set the entry fee, the docket length, and the jury size.
            </p>
          </div>
          <button
            onClick={() => setShowCreate((v) => !v)}
            className="px-3 py-2 rounded-lg border border-neon/40 bg-neon/15 text-neon text-sm font-semibold hover:bg-neon/25 inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" strokeWidth={2.25} />
            {showCreate ? 'Hide' : 'Open new case'}
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

            {/* Rounds + players grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
              <div>
                <label className="text-white/50 text-xs font-mono uppercase tracking-wider mb-2 block">
                  Jury size
                </label>
                <div className="flex items-center gap-2">
                  {[4, 6, 8, 12].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setMaxPlayers(n)}
                      className={`flex-1 rounded-lg py-2 text-sm font-mono transition-colors ${
                        maxPlayers === n
                          ? 'bg-neon/20 text-neon border border-neon/40'
                          : 'bg-white/5 text-white/55 border border-white/10 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Money map */}
            <MoneyMap
              entryFeeWei={entryFeeWei}
              maxPlayers={Number(maxPlayers)}
              houseCutBps={houseCutBps}
              symbol={symbol}
            />

            <button
              className="btn btn-neon w-full py-3 text-base"
              onClick={handleCreate}
              disabled={loading || entryFeeWei === null || !profile.name || !contractConfigured}
            >
              {loading
                ? 'Filing case on-chain…'
                : entryFeeWei && entryFeeWei > 0n
                  ? `File case · stake ${formatGen(entryFeeWei, 6)} ${symbol}`
                  : 'File case'}
            </button>
          </div>
        )}
      </div>

      {/* Join by code */}
      <div className="rounded-xl border border-white/5 bg-white/[0.015] px-4 py-3 animate-fade-in" style={{ animationDelay: '0.15s' }}>
        <button
          onClick={() => setShowJoinByCode((v) => !v)}
          className="w-full flex items-center justify-between text-white/60 hover:text-white text-xs font-mono uppercase tracking-wider"
        >
          <span>Join by case code (e.g. {sampleCode()})</span>
          {showJoinByCode ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
        {showJoinByCode && (
          <div className="mt-3 flex flex-col sm:flex-row gap-2">
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
              className="px-4 py-2 rounded-lg border border-plasma/40 bg-plasma/15 text-plasma text-sm font-semibold hover:bg-plasma/25 disabled:opacity-50"
            >
              Take a seat
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

// ── Money map ────────────────────────────────────────────────────────────────
function MoneyMap({ entryFeeWei, maxPlayers, houseCutBps, symbol }) {
  const fee = entryFeeWei ?? 0n
  const cap = Math.max(2, Number(maxPlayers) || 0)
  const totalPot = fee * BigInt(cap)
  const cutBps = BigInt(Math.max(0, Math.min(10_000, Number(houseCutBps) || 0)))
  const houseTake = (totalPot * cutBps) / 10_000n
  const winnerTake = totalPot - houseTake
  const cutPct = Number(cutBps) / 100

  return (
    <div className="rounded-xl border border-white/10 bg-gradient-to-br from-gold/[0.04] via-white/[0.015] to-transparent p-4">
      <div className="flex items-center gap-2 mb-3">
        <Trophy className="w-4 h-4 text-gold" />
        <h3 className="font-display font-700 text-white text-sm">Money map</h3>
        <span className="text-white/35 text-[10px] font-mono uppercase tracking-wider">
          where every {symbol} goes
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <MapCell
          icon={<Wallet className="w-3.5 h-3.5 text-white/60" />}
          label={`Per juror (×${cap} jurors)`}
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
      <div className="mt-3 h-2 rounded-full overflow-hidden bg-white/5 border border-white/10 flex">
        <div
          className="h-full bg-gold/70"
          style={{ width: `${100 - cutPct}%` }}
          title={`Winner: ${(100 - cutPct).toFixed(2)}%`}
        />
        <div
          className="h-full bg-plasma/70"
          style={{ width: `${cutPct}%` }}
          title={`House: ${cutPct.toFixed(2)}%`}
        />
      </div>
      <p className="text-white/40 text-[11px] mt-2 leading-relaxed">
        Refunds are automatic if the case never starts. Kicked players get their stake back.
      </p>
    </div>
  )
}

function MapCell({ icon, label, value, sub, accent }) {
  const accentText = accent === 'gold' ? 'text-gold'
                  : accent === 'plasma' ? 'text-plasma'
                  : 'text-white'
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-[10px] font-mono uppercase tracking-wider text-white/45">{label}</span>
      </div>
      <div className={`font-mono text-sm ${accentText}`}>{value}</div>
      {sub && <div className="text-white/40 text-[11px] mt-1 font-mono">{sub}</div>}
    </div>
  )
}

function sampleCode() {
  return 'TRIAL9'
}
