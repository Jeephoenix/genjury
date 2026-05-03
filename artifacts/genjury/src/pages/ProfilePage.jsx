import React, { useEffect, useRef, useState, useCallback } from 'react'
import {
  UserRound, Wallet, ShieldCheck, Activity, Trophy, Flame,
  Sparkles, Lock, Image as ImageIcon, Trash2,
  ArrowRight, Check, Fingerprint, AlertCircle, Loader2,
  BadgeCheck, Shield, Zap, RefreshCw,
} from 'lucide-react'
import {
  myAddress, isWalletConnected, subscribeWallet,
  readContractView, hasContractAddress,
} from '../lib/genlayer'
import useGameStore from '../lib/store'
import { getProfile, setProfile, subscribeProfile, applyServerProfile } from '../lib/profile'
import {
  listJoinedRooms, subscribeJoinedRooms,
  listFinishedRooms, dismissFinishedRoom,
} from '../lib/joinedRooms'
import {
  fetchServerProfile, checkUsername, claimIdentity,
  updateAvatar, getCachedServerProfile, subscribeProfileApi,
} from '../lib/profileApi'
import Avatar from '../components/Avatar'

const short = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '')

// ─── Debounce hook ────────────────────────────────────────────────────────────
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value)
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(handler)
  }, [value, delay])
  return debouncedValue
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const setOpenWallet = useGameStore((s) => s.setWalletPanelOpen)
  const setActiveTab  = useGameStore((s) => s.setActiveTab)
  const addToast      = useGameStore((s) => s.addToast)
  const loading       = useGameStore((s) => s.loading)
  const enterRoom     = useGameStore((s) => s.enterRoom)

  const [, force] = useState(0)
  useEffect(() => subscribeWallet(()     => force((n) => n + 1)), [])
  useEffect(() => subscribeProfile(()    => force((n) => n + 1)), [])
  useEffect(() => subscribeProfileApi(() => force((n) => n + 1)), [])

  const [rooms,         setRooms]         = useState(() => listJoinedRooms())
  const [finishedRooms, setFinishedRooms] = useState(() => listFinishedRooms())
  useEffect(() => subscribeJoinedRooms(() => {
    setRooms(listJoinedRooms())
    setFinishedRooms(listFinishedRooms())
  }), [])

  const connected  = isWalletConnected()
  const address    = myAddress()
  const profile    = getProfile()
  const serverProf = getCachedServerProfile(address)

  // Fetch server profile when address changes
  useEffect(() => {
    if (!address) return
    fetchServerProfile(address).then((p) => {
      if (p) applyServerProfile(p)
    })
  }, [address])

  const isClaimed = profile.claimed || !!serverProf

  const [stats, setStats] = useState({ loading: false, games: 0, wins: 0, xp: 0, level: 1 })

  useEffect(() => {
    let cancelled = false
    if (!address) {
      setStats({ loading: false, games: 0, wins: 0, xp: 0, level: 1 })
      return
    }
    const localGames = finishedRooms.length
    const localWins  = finishedRooms.filter((r) => r.myRank === 1).length
    const localXP    = finishedRooms.reduce((s, r) => s + (r.myXP || 0), 0)
    setStats({ loading: hasContractAddress(), games: localGames, wins: localWins, xp: localXP, level: 1 })
    if (!hasContractAddress()) return
    ;(async () => {
      const me = address.toLowerCase()
      try {
        const raw    = await readContractView('get_global_leaderboard', [200])
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
        if (Array.isArray(parsed)) {
          const myEntry = parsed.find((p) => String(p.address || '').toLowerCase() === me)
          if (myEntry) {
            if (cancelled) return
            setStats({
              loading: false,
              games:   Math.max(localGames, Number(myEntry.wins || 0)),
              wins:    Number(myEntry.wins  || 0),
              xp:      Number(myEntry.xp    || 0),
              level:   Number(myEntry.level || 1),
            })
            return
          }
        }
      } catch {}
      if (!rooms.length) {
        if (!cancelled) setStats({ loading: false, games: localGames, wins: localWins, xp: localXP, level: 1 })
        return
      }
      let wins = localWins, xp = localXP, level = 1
      const seenCodes = new Set(finishedRooms.map((r) => r.code))
      await Promise.all(rooms.map(async (r) => {
        try {
          const raw    = await readContractView('get_room_state', [r.code])
          const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
          if (!parsed?.roomCode) return
          const rec = (parsed?.players || {})[me] || (parsed?.players || {})[address] || null
          if (rec && !seenCodes.has(r.code)) { xp += Number(rec.xp || 0); level = Math.max(level, Number(rec.level || 1)) }
          const winnerAddr = (parsed.winnerAddress || '').toLowerCase()
          if (winnerAddr === me && parsed.phase === 'scoreboard' && !seenCodes.has(r.code)) wins++
        } catch {}
      }))
      if (cancelled) return
      setStats({ loading: false, games: Math.max(localGames, wins), wins, xp, level })
    })()
    return () => { cancelled = true }
  }, [address, rooms, finishedRooms])

  const winRate = stats.games > 0 ? Math.round((stats.wins / stats.games) * 100) : 0

  const handleResume = (code) => {
    if (loading) return
    if (!isWalletConnected()) { setOpenWallet(true); return }
    enterRoom(code)
  }

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-10 sm:py-14 space-y-5">

      {/* Page header */}
      <div className="mb-2">
        <div className="inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.2em] text-white/35 mb-3 px-3 py-1 rounded-full border border-white/[0.07] bg-white/[0.03]">
          <UserRound className="w-3.5 h-3.5 text-plasma" />
          Player identity
        </div>
        <h1 className="font-display font-bold text-3xl sm:text-4xl text-white tracking-tight">
          {isClaimed ? profile.name : 'Your Profile'}
        </h1>
        <p className="text-white/40 mt-1 text-sm">
          {connected
            ? isClaimed
              ? `Wallet ${short(address)} · Identity claimed`
              : `Connected as ${short(address)}`
            : 'Connect a wallet to claim your permanent identity.'}
        </p>
      </div>

      {/* Connect wallet CTA */}
      {!connected && (
        <div className="glass rounded-2xl border border-crimson/25 p-5 relative overflow-hidden"
          style={{ background: 'rgba(232,0,45,0.04)' }}>
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-crimson/40 to-transparent" />
          <div className="flex items-start sm:items-center gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-crimson/10 border border-crimson/25 flex items-center justify-center text-crimson flex-shrink-0 mt-0.5 sm:mt-0">
              <Lock className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={1.75} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-white font-display font-bold text-base leading-snug">Connect a wallet to get started</div>
              <div className="text-white/45 text-sm mt-1 leading-relaxed">Your identity, wins, and XP are tied to your address.</div>
              <button
                onClick={() => setOpenWallet(true)}
                className="btn btn-crimson mt-4 px-5 py-2.5 text-sm inline-flex items-center justify-center gap-2 w-full sm:hidden"
              >
                <Wallet className="w-4 h-4" /> Connect wallet
              </button>
            </div>
            <button
              onClick={() => setOpenWallet(true)}
              className="hidden sm:inline-flex btn btn-crimson px-4 py-2.5 text-sm items-center gap-2 flex-shrink-0"
            >
              <Wallet className="w-4 h-4" /> Connect
            </button>
          </div>
        </div>
      )}

      {/* Identity section — claim or display */}
      {connected && (
        isClaimed
          ? <ClaimedIdentity profile={profile} serverProf={serverProf} address={address} addToast={addToast} />
          : <ClaimIdentityPanel address={address} profile={profile} addToast={addToast} onClaimed={() => force((n) => n + 1)} />
      )}

      {/* On-chain reputation */}
      {connected && (
        <div className="glass rounded-2xl border border-white/[0.08] p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-bold text-base text-white">On-chain reputation</h2>
            <span className="badge bg-plasma/12 text-plasma border border-plasma/25 text-[10px] tracking-widest font-mono">
              Level {stats.level}
            </span>
          </div>
          {stats.loading && stats.games === 0 ? (
            <p className="text-white/45 text-sm animate-pulse">Reading on-chain stats…</p>
          ) : stats.games === 0 ? (
            <div className="rounded-xl border border-dashed border-white/[0.08] bg-white/[0.02] px-4 py-6 text-center">
              <Sparkles className="w-5 h-5 text-plasma mx-auto mb-2" strokeWidth={2} />
              <div className="text-white/60 text-sm font-medium mb-1">No on-chain games yet.</div>
              <div className="text-white/35 text-xs mb-3">Join a room to start building reputation.</div>
              <button onClick={() => setActiveTab('games')} className="inline-flex items-center gap-1.5 text-plasma text-xs font-semibold hover:underline">
                Browse open rounds <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
                <Mini label="Games joined" value={stats.games}        icon={Activity}    />
                <Mini label="Wins"         value={stats.wins}         icon={Trophy}      accent="gold" />
                <Mini label="Total XP"     value={stats.xp}           icon={Flame}       accent="signal" />
                <Mini label="Win rate"     value={`${winRate}%`}      icon={ShieldCheck} accent="neon" />
              </div>
              <XpBar xp={stats.xp} level={stats.level} />
            </>
          )}
        </div>
      )}

      {/* Case history */}
      <div className="glass rounded-2xl border border-white/[0.08] p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-bold text-base text-white inline-flex items-center gap-2">
            <Trophy className="w-4 h-4 text-gold" strokeWidth={2} />
            Case history
          </h2>
          <button onClick={() => setActiveTab('games')} className="text-plasma/70 hover:text-plasma text-xs font-semibold inline-flex items-center gap-1 transition-colors">
            Browse rooms <ArrowRight className="w-3 h-3" />
          </button>
        </div>
        {!connected ? (
          <EmptyHistorySlot icon={Activity} label="Connect a wallet to start earning verdicts." />
        ) : finishedRooms.length === 0 ? (
          <EmptyHistorySlot icon={Activity} label="No completed cases yet — your verdicts will appear here." />
        ) : (
          <div className="divide-y divide-white/[0.05]">
            {finishedRooms.map((h) => {
              const isWin     = h.myRank === 1
              const rankLabel = h.myRank === 1 ? '🥇' : h.myRank === 2 ? '🥈' : h.myRank === 3 ? '🥉' : h.myRank ? `#${h.myRank}` : '—'
              const dateStr   = h.finishedAt
                ? new Date(h.finishedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                : null
              return (
                <div key={h.code} className="py-3.5 flex items-center gap-3 group">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center border flex-shrink-0 text-base select-none ${
                    isWin ? 'bg-gold/12 border-gold/30' : 'bg-white/[0.04] border-white/[0.08]'
                  }`}>
                    {rankLabel}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="text-white text-sm font-medium font-mono tracking-wider">{h.code}</span>
                      {h.isHost && <span className="badge bg-plasma/12 text-plasma border border-plasma/25 text-[9px]">HOST</span>}
                      {isWin  && <span className="badge bg-gold/12 text-gold border border-gold/25 text-[9px]">WIN</span>}
                    </div>
                    <div className="text-white/35 text-[11px] flex items-center gap-2 flex-wrap">
                      {h.category    && <span className="capitalize">{h.category}</span>}
                      {h.rounds > 0  && <span>{h.rounds}/{h.maxRounds || h.rounds} rounds</span>}
                      {h.playerCount > 0 && <span>{h.playerCount} players</span>}
                      {dateStr       && <span className="text-white/20">{dateStr}</span>}
                    </div>
                  </div>
                  {h.myXP > 0 && (
                    <div className="text-right flex-shrink-0 mr-1">
                      <div className="text-[10px] text-white/30 mb-0.5">XP</div>
                      <div className="text-sm font-mono font-bold text-signal">+{h.myXP}</div>
                    </div>
                  )}
                  <button onClick={() => handleResume(h.code)} disabled={loading}
                    className="px-3 py-1.5 rounded-lg border border-plasma/30 bg-plasma/[0.08] text-plasma text-xs font-semibold hover:bg-plasma/20 disabled:opacity-50 transition-all opacity-0 group-hover:opacity-100"
                    title="Re-open this case">
                    View
                  </button>
                  <button onClick={() => dismissFinishedRoom(h.code)}
                    className="p-1.5 rounded-lg text-white/20 hover:text-white/60 hover:bg-white/[0.06] transition-all opacity-0 group-hover:opacity-100"
                    title="Remove from history" aria-label="Dismiss">
                    <Trash2 className="w-3.5 h-3.5" strokeWidth={2} />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Claim identity panel ─────────────────────────────────────────────────────
function ClaimIdentityPanel({ address, profile, addToast, onClaimed }) {
  const [username,   setUsername]   = useState('')
  const [avatarUrl,  setAvatarUrl]  = useState(profile.avatarUrl || '')
  const [checking,   setChecking]   = useState(false)
  const [available,  setAvailable]  = useState(null)   // null | true | false
  const [checkError, setCheckError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const fileRef = useRef(null)

  const debouncedUsername = useDebounce(username, 500)

  // Real-time availability check
  useEffect(() => {
    if (!debouncedUsername || debouncedUsername.trim().length < 5) {
      setAvailable(null)
      setCheckError('')
      return
    }
    let cancelled = false
    setChecking(true)
    setAvailable(null)
    checkUsername(debouncedUsername).then((res) => {
      if (cancelled) return
      setChecking(false)
      setAvailable(res.available)
      setCheckError(res.error || '')
    })
    return () => { cancelled = true }
  }, [debouncedUsername])

  const handleFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { addToast('Pick an image file', 'error'); return }
    if (file.size > 2 * 1024 * 1024) { addToast('Image too large (max 2 MB)', 'error'); return }
    const reader = new FileReader()
    reader.onload = () => {
      downscaleImage(String(reader.result || ''), 256).then(setAvatarUrl)
    }
    reader.readAsDataURL(file)
  }

  const canClaim = username.trim().length >= 5 && available === true && !submitting

  const handleClaim = async () => {
    if (!canClaim) return
    setSubmitting(true)
    try {
      await claimIdentity(address, username, avatarUrl, profile.color)
      applyServerProfile({ username: username.trim(), avatarUrl, color: profile.color })
      addToast('Identity claimed — your name is now permanent.', 'success')
      onClaimed()
    } catch (err) {
      addToast(err.message || 'Could not claim identity.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const nameLen = username.trim().length

  return (
    <div className="glass rounded-2xl border border-plasma/20 p-6 relative overflow-hidden"
      style={{ background: 'rgba(162,89,255,0.04)' }}>
      {/* Top accent */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-plasma/50 to-transparent" />

      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <div className="w-12 h-12 rounded-xl bg-plasma/10 border border-plasma/25 flex items-center justify-center text-plasma flex-shrink-0 mt-0.5">
          <Fingerprint className="w-6 h-6" strokeWidth={1.75} />
        </div>
        <div>
          <h2 className="font-display font-bold text-lg text-white">Claim your identity</h2>
          <p className="text-white/45 text-sm mt-0.5 leading-relaxed">
            Choose a permanent name for your wallet. This cannot be changed later.
          </p>
        </div>
      </div>

      {/* Trust signals */}
      <div className="grid grid-cols-3 gap-2 mb-6">
        {[
          { icon: Lock,       label: 'Permanent',    sub: 'Locked forever' },
          { icon: Shield,     label: 'Unique',       sub: 'No duplicates'  },
          { icon: Zap,        label: 'Instant',      sub: 'On-chain ready' },
        ].map(({ icon: Icon, label, sub }) => (
          <div key={label} className="rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2.5 text-center">
            <Icon className="w-4 h-4 text-plasma mx-auto mb-1" strokeWidth={1.75} />
            <div className="text-white text-xs font-semibold">{label}</div>
            <div className="text-white/35 text-[10px]">{sub}</div>
          </div>
        ))}
      </div>

      {/* Avatar + username form */}
      <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-5 items-start">
        {/* Avatar picker */}
        <div className="flex flex-col items-center gap-2.5">
          <div className="relative">
            <div className="w-[88px] h-[88px] rounded-2xl overflow-hidden border-2 border-plasma/30 bg-white/[0.04] relative">
              {avatarUrl ? (
                <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                <Avatar name={username || 'Player'} color={profile.color} size={88} />
              )}
            </div>
            {avatarUrl && (
              <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-plasma border-2 border-void flex items-center justify-center">
                <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => fileRef.current?.click()}
              className="px-2.5 py-1.5 rounded-lg border border-white/[0.09] bg-white/[0.04] hover:bg-white/[0.08] text-white/70 text-xs inline-flex items-center gap-1.5 transition-all">
              <ImageIcon className="w-3.5 h-3.5" />
              {avatarUrl ? 'Change' : 'Upload'}
            </button>
            {avatarUrl && (
              <button type="button" onClick={() => setAvatarUrl('')}
                className="p-1.5 rounded-lg border border-white/[0.07] bg-white/[0.03] hover:bg-white/[0.07] text-white/40 text-xs transition-all">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
        </div>

        {/* Username input */}
        <div>
          <label className="block mb-1.5">
            <span className="text-white/40 text-[10px] font-mono uppercase tracking-wider">Player name</span>
          </label>
          <div className="relative">
            <input
              className={`input pr-10 transition-all ${
                available === true
                  ? 'border-neon/40 focus:border-neon/60'
                  : available === false
                  ? 'border-crimson/40 focus:border-crimson/60'
                  : ''
              }`}
              maxLength={24}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. DarkJuror"
              autoComplete="off"
              autoCorrect="off"
              spellCheck="false"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {checking ? (
                <Loader2 className="w-4 h-4 text-white/30 animate-spin" />
              ) : available === true ? (
                <Check className="w-4 h-4 text-neon" strokeWidth={2.5} />
              ) : available === false ? (
                <AlertCircle className="w-4 h-4 text-crimson" strokeWidth={2} />
              ) : null}
            </div>
          </div>

          {/* Status messages */}
          <div className="mt-2 min-h-[18px]">
            {checkError ? (
              <p className="text-crimson text-xs flex items-center gap-1">
                <AlertCircle className="w-3 h-3 flex-shrink-0" /> {checkError}
              </p>
            ) : available === true ? (
              <p className="text-neon text-xs flex items-center gap-1">
                <Check className="w-3 h-3 flex-shrink-0" /> That name is available
              </p>
            ) : available === false && !checkError ? (
              <p className="text-crimson text-xs flex items-center gap-1">
                <AlertCircle className="w-3 h-3 flex-shrink-0" /> That name is already taken
              </p>
            ) : nameLen > 0 && nameLen < 5 ? (
              <p className="text-white/30 text-xs">{5 - nameLen} more character{5 - nameLen !== 1 ? 's' : ''} needed</p>
            ) : (
              <p className="text-white/25 text-xs">Min 5 characters · Letters, numbers, spaces, _ -</p>
            )}
          </div>

          {/* Character count */}
          <div className="flex justify-end mt-1">
            <span className="text-[10px] font-mono text-white/20">{nameLen}/24</span>
          </div>
        </div>
      </div>

      {/* Claim button */}
      <div className="mt-6 pt-5 border-t border-white/[0.06]">
        <button
          onClick={handleClaim}
          disabled={!canClaim}
          className={`w-full py-3 rounded-xl font-display font-bold text-sm inline-flex items-center justify-center gap-2.5 transition-all ${
            canClaim
              ? 'bg-gradient-to-r from-plasma to-neon text-void hover:opacity-90 shadow-[0_0_24px_rgba(162,89,255,0.35)]'
              : 'bg-white/[0.06] text-white/30 cursor-not-allowed'
          }`}
        >
          {submitting ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Claiming identity…</>
          ) : (
            <><Fingerprint className="w-4 h-4" /> Claim identity</>
          )}
        </button>
        <p className="text-center text-white/25 text-[11px] mt-3 leading-relaxed">
          <Lock className="w-3 h-3 inline mr-1 -mt-px" />
          Permanently linked to wallet {short(address)}. This action cannot be undone.
        </p>
      </div>
    </div>
  )
}

// ─── Claimed identity display ─────────────────────────────────────────────────
function ClaimedIdentity({ profile, serverProf, address, addToast }) {
  const [avatarUrl,   setAvatarUrl]   = useState(profile.avatarUrl || '')
  const [saving,      setSaving]      = useState(false)
  const [avatarDirty, setAvatarDirty] = useState(false)
  const fileRef = useRef(null)

  // Sync when profile changes externally
  useEffect(() => {
    setAvatarUrl(profile.avatarUrl || '')
    setAvatarDirty(false)
  }, [profile.avatarUrl])

  const handleFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { addToast('Pick an image file', 'error'); return }
    if (file.size > 2 * 1024 * 1024) { addToast('Image too large (max 2 MB)', 'error'); return }
    const reader = new FileReader()
    reader.onload = () => {
      downscaleImage(String(reader.result || ''), 256).then((scaled) => {
        setAvatarUrl(scaled)
        setAvatarDirty(scaled !== (profile.avatarUrl || ''))
      })
    }
    reader.readAsDataURL(file)
  }

  const handleSaveAvatar = async () => {
    setSaving(true)
    try {
      await updateAvatar(address, avatarUrl)
      setProfile({ avatarUrl })
      setAvatarDirty(false)
      addToast('Profile picture updated.', 'success')
    } catch (err) {
      addToast(err.message || 'Could not update picture.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const displayName = serverProf?.username || profile.name

  return (
    <div className="glass rounded-2xl border border-white/[0.08] p-5 relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-neon/25 to-transparent" />

      {/* Identity header */}
      <div className="flex items-center gap-4 mb-5">
        <div className="relative flex-shrink-0">
          <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-neon/20 bg-white/[0.04]">
            {avatarUrl ? (
              <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
            ) : (
              <Avatar name={displayName} color={profile.color} size={80} />
            )}
          </div>
          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-neon border-2 border-void flex items-center justify-center"
            title="Identity verified">
            <BadgeCheck className="w-3.5 h-3.5 text-void" strokeWidth={2.5} />
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-display font-bold text-xl text-white truncate">{displayName}</span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-neon/10 border border-neon/25 text-neon text-[10px] font-mono tracking-wider">
              <Lock className="w-2.5 h-2.5" strokeWidth={2.5} /> CLAIMED
            </span>
          </div>
          <p className="text-white/35 text-xs font-mono">{short(address)}</p>
          <p className="text-white/25 text-[11px] mt-1">
            Name permanently locked · Cannot be changed
          </p>
        </div>
      </div>

      {/* Avatar update section */}
      <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-white text-sm font-medium">Profile picture</div>
            <div className="text-white/35 text-xs mt-0.5">Update anytime — your name stays locked</div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => fileRef.current?.click()}
              className="px-3 py-1.5 rounded-lg border border-white/[0.09] bg-white/[0.04] hover:bg-white/[0.08] text-white/70 text-xs inline-flex items-center gap-1.5 transition-all">
              <ImageIcon className="w-3.5 h-3.5" />
              {avatarUrl ? 'Change' : 'Upload'}
            </button>
            {avatarUrl && (
              <button type="button" onClick={() => { setAvatarUrl(''); setAvatarDirty(true) }}
                className="p-1.5 rounded-lg border border-white/[0.07] bg-white/[0.03] hover:bg-red-500/10 hover:border-red-500/20 text-white/35 hover:text-red-400 transition-all">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />

        {avatarDirty && (
          <button onClick={handleSaveAvatar} disabled={saving}
            className="w-full mt-1 py-2 rounded-lg bg-plasma/15 border border-plasma/30 text-plasma text-sm font-semibold hover:bg-plasma/25 disabled:opacity-50 transition-all inline-flex items-center justify-center gap-2">
            {saving
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</>
              : <><Check className="w-3.5 h-3.5" /> Save picture</>
            }
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function EmptyHistorySlot({ icon: Icon, label }) {
  return (
    <div className="rounded-xl border border-dashed border-white/[0.08] bg-white/[0.02] px-4 py-8 text-center">
      <Icon className="w-6 h-6 text-white/20 mx-auto mb-2" strokeWidth={1.75} />
      <div className="text-white/45 text-sm">{label}</div>
    </div>
  )
}

const ACCENT_TEXT = {
  gold: 'text-gold', neon: 'text-neon', ice: 'text-ice', signal: 'text-signal',
}
function Mini({ label, value, icon: Icon, accent = 'ice' }) {
  return (
    <div className="rounded-xl border border-white/[0.09] bg-white/[0.025] px-3 py-3">
      <div className="flex items-center justify-between mb-1.5">
        <div className="text-[10px] font-mono uppercase tracking-wider text-white/35">{label}</div>
        <Icon className={`w-3.5 h-3.5 ${ACCENT_TEXT[accent] || 'text-ice'}`} strokeWidth={2} />
      </div>
      <div className="text-white text-lg font-display font-bold">{value}</div>
    </div>
  )
}

function XpBar({ xp, level }) {
  const xpForNext   = level * 100
  const xpIntoLevel = xp % xpForNext
  const pct         = Math.min(100, Math.round((xpIntoLevel / xpForNext) * 100))
  return (
    <div className="rounded-xl border border-white/[0.09] bg-white/[0.02] px-4 py-3.5">
      <div className="flex items-center justify-between mb-2.5">
        <div className="text-[10px] font-mono uppercase tracking-wider text-white/35">
          Level {level} → Level {level + 1}
        </div>
        <div className="text-[10px] font-mono text-plasma">{xpIntoLevel} / {xpForNext} XP</div>
      </div>
      <div className="h-1.5 bg-white/[0.07] rounded-full overflow-hidden">
        <div className="h-full rounded-full bg-gradient-to-r from-plasma to-neon transition-all duration-700"
          style={{ width: `${pct}%`, boxShadow: '0 0 8px rgba(162,89,255,0.4)' }} />
      </div>
      <div className="text-[10px] font-mono text-white/20 mt-1.5">{pct}% to next level</div>
    </div>
  )
}

function downscaleImage(dataUrl, size) {
  return new Promise((resolve) => {
    const img  = new Image()
    img.onload = () => {
      try {
        const c = document.createElement('canvas')
        c.width = c.height = size
        const ctx = c.getContext('2d')
        if (!ctx) return resolve(dataUrl)
        const s  = Math.min(img.width, img.height)
        const sx = (img.width  - s) / 2
        const sy = (img.height - s) / 2
        ctx.drawImage(img, sx, sy, s, s, 0, 0, size, size)
        resolve(c.toDataURL('image/jpeg', 0.85))
      } catch { resolve(dataUrl) }
    }
    img.onerror = () => resolve(dataUrl)
    img.src     = dataUrl
  })
}
