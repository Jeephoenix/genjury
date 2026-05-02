import React, { useEffect, useRef, useState } from 'react'
import {
  UserRound, Wallet, ShieldCheck, Activity, Trophy, Flame,
  Sparkles, Lock, Pencil, Image as ImageIcon, Trash2,
  ArrowRight, Check,
} from 'lucide-react'
import {
  myAddress, isWalletConnected, subscribeWallet,
  readContractView, hasContractAddress,
} from '../lib/genlayer'
import useGameStore from '../lib/store'
import { getProfile, setProfile, subscribeProfile } from '../lib/profile'
import {
    listJoinedRooms, subscribeJoinedRooms,
    listFinishedRooms, dismissFinishedRoom,
  } from '../lib/joinedRooms'
import Avatar from '../components/Avatar'

const short = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '')

export default function ProfilePage() {
  const setOpenWallet = useGameStore((s) => s.setWalletPanelOpen)
  const joinRoom      = useGameStore((s) => s.joinRoom)
  const setActiveTab  = useGameStore((s) => s.setActiveTab)
  const addToast      = useGameStore((s) => s.addToast)
  const loading       = useGameStore((s) => s.loading)
  const enterRoom     = useGameStore((s) => s.enterRoom)

  const [, force] = useState(0)
  useEffect(() => subscribeWallet(()  => force((n) => n + 1)), [])
  useEffect(() => subscribeProfile(() => force((n) => n + 1)), [])

  const [rooms,         setRooms]         = useState(() => listJoinedRooms())
  const [finishedRooms, setFinishedRooms] = useState(() => listFinishedRooms())
  useEffect(() => subscribeJoinedRooms(() => {
    setRooms(listJoinedRooms())
    setFinishedRooms(listFinishedRooms())
  }), [])

  const connected = isWalletConnected()
  const address   = myAddress()
  const profile   = getProfile()

  const [stats,   setStats]   = useState({ loading: false, games: 0, wins: 0, xp: 0, level: 1 })

  // Aggregate stats from locally-stored finished rooms (instant, no RPC).
    // Supplement with live active-room data only if rooms exist.
    useEffect(() => {
      let cancelled = false
      if (!address) {
        setStats({ loading: false, games: 0, wins: 0, xp: 0, level: 1 })
        return
      }

      // Seed instantly from stored finished-room metadata (no RPC needed).
      const games = finishedRooms.length
      const wins  = finishedRooms.filter((r) => r.myRank === 1).length
      let   xp    = finishedRooms.reduce((s, r) => s + (r.myXP || 0), 0)
      let   level = 1
      setStats({ loading: rooms.length > 0, games, wins, xp, level })

      // Scan active (in-progress) rooms on-chain for any additional live XP.
      if (!hasContractAddress() || rooms.length === 0) return
      ;(async () => {
        const me = address.toLowerCase()
        await Promise.all(rooms.map(async (r) => {
          try {
            const raw    = await readContractView('get_room_state', [r.code])
            const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
            if (!parsed?.roomCode) return
            const rec = (parsed?.players || {})[me] || (parsed?.players || {})[address] || null
            if (rec) {
              xp    += Number(rec.xp || 0)
              level  = Math.max(level, Number(rec.level || 1))
            }
          } catch {}
        }))
        if (cancelled) return
        setStats({ loading: false, games, wins, xp, level })
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
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10 sm:py-14">

      {/* Page header */}
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.2em] text-white/35 mb-3 px-3 py-1 rounded-full border border-white/[0.07] bg-white/[0.03]">
          <UserRound className="w-3.5 h-3.5 text-plasma" />
          Player profile
        </div>
        <div className="flex items-center gap-4">
          <div className="relative flex-shrink-0">
            <Avatar name={profile.name} src={profile.avatarUrl} color={profile.color} size={64} />
            <div
              className="absolute -inset-2 rounded-full blur-xl opacity-25 pointer-events-none"
              style={{ background: profile.color }}
            />
          </div>
          <div className="min-w-0">
            <h1 className="font-display font-bold text-3xl sm:text-4xl text-white tracking-tight truncate">
              {profile.name}
            </h1>
            <p className="text-white/45 mt-1 text-sm">
              {connected
                ? `Connected as ${short(address)}`
                : 'Connect a wallet to start earning verdicts.'}
            </p>
          </div>
        </div>
      </div>

      {/* Profile editor */}
      <ProfileEditor profile={profile} />

      {/* Connect wallet CTA */}
      {!connected && (
        <div className="glass rounded-2xl border border-crimson/25 p-5 mb-6 mt-5 flex items-center gap-4 relative overflow-hidden"
          style={{ background: 'rgba(232,0,45,0.04)' }}>
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-crimson/40 to-transparent" />
          <div className="w-12 h-12 rounded-xl bg-crimson/10 border border-crimson/25 flex items-center justify-center text-crimson flex-shrink-0">
            <Lock className="w-6 h-6" strokeWidth={1.75} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-white font-display font-bold text-base">Connect a wallet to unlock on-chain stats</div>
            <div className="text-white/45 text-sm mt-0.5">Your wins, XP and game history are tied to your address.</div>
          </div>
          <button
            onClick={() => setOpenWallet(true)}
            className="btn btn-crimson px-4 py-2.5 text-sm inline-flex items-center gap-2 flex-shrink-0"
          >
            <Wallet className="w-4 h-4" /> Connect
          </button>
        </div>
      )}

      {/* On-chain reputation */}
      <div className="glass rounded-2xl border border-white/[0.08] p-5 mb-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-bold text-base text-white">On-chain reputation</h2>
          <span className="badge bg-plasma/12 text-plasma border border-plasma/25 text-[10px] tracking-widest font-mono">
            Level {connected ? stats.level : '—'}
          </span>
        </div>

        {!connected ? (
          <p className="text-white/45 text-sm">Connect a wallet to see your reputation.</p>
        ) : stats.loading && stats.games === 0 ? (
          <p className="text-white/45 text-sm animate-pulse">Reading on-chain stats…</p>
        ) : stats.games === 0 ? (
          <div className="rounded-xl border border-dashed border-white/[0.08] bg-white/[0.02] px-4 py-6 text-center">
            <Sparkles className="w-5 h-5 text-plasma mx-auto mb-2" strokeWidth={2} />
            <div className="text-white/60 text-sm font-medium mb-1">No on-chain games yet.</div>
            <div className="text-white/35 text-xs mb-3">Join a room to start building reputation.</div>
            <button
              onClick={() => setActiveTab('games')}
              className="inline-flex items-center gap-1.5 text-plasma text-xs font-semibold hover:underline"
            >
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

      {/* Case history — sourced from localStorage, instant, no RPC */}
        <div className="glass rounded-2xl border border-white/[0.08] p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-bold text-base text-white inline-flex items-center gap-2">
              <Trophy className="w-4 h-4 text-gold" strokeWidth={2} />
              Case history
            </h2>
            <button
              onClick={() => setActiveTab('games')}
              className="text-plasma/70 hover:text-plasma text-xs font-semibold inline-flex items-center gap-1 transition-colors"
            >
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
                const rankEmoji = h.myRank === 1 ? '🥇' : h.myRank === 2 ? '🥈' : h.myRank === 3 ? '🥉' : h.myRank ? `#${h.myRank}` : '—'
                const dateStr   = h.finishedAt
                  ? new Date(h.finishedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                  : null
                return (
                  <div key={h.code} className="py-3.5 flex items-center gap-3 group">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center border flex-shrink-0 text-base select-none ${
                      isWin ? 'bg-gold/12 border-gold/30' : 'bg-white/[0.04] border-white/[0.08]'
                    }`}>
                      {rankEmoji}
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

                    <button
                      onClick={() => handleResume(h.code)}
                      disabled={loading}
                      className="px-3 py-1.5 rounded-lg border border-plasma/30 bg-plasma/[0.08] text-plasma text-xs font-semibold hover:bg-plasma/20 disabled:opacity-50 transition-all opacity-0 group-hover:opacity-100"
                      title="Re-open this case"
                    >
                      View
                    </button>

                    <button
                      onClick={() => dismissFinishedRoom(h.code)}
                      className="p-1.5 rounded-lg text-white/20 hover:text-white/60 hover:bg-white/[0.06] transition-all opacity-0 group-hover:opacity-100"
                      title="Remove from history"
                      aria-label="Dismiss"
                    >
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

function ProfileEditor({ profile }) {
  const [name,      setName]      = useState(profile.name)
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl || '')
  const [saved,     setSaved]     = useState(false)
  const fileRef  = useRef(null)
  const addToast = useGameStore((s) => s.addToast)

  useEffect(() => {
    setName(profile.name)
    setAvatarUrl(profile.avatarUrl || '')
  }, [profile.name, profile.avatarUrl])

  const dirty = name !== profile.name || avatarUrl !== (profile.avatarUrl || '')

  const handleSave = () => {
    setProfile({ name, avatarUrl })
    setSaved(true)
    addToast('Profile saved', 'success')
    setTimeout(() => setSaved(false), 1500)
  }

  const handleFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { addToast('Pick an image file', 'error'); return }
    if (file.size > 1.5 * 1024 * 1024)  { addToast('Image too large (max 1.5 MB)', 'error'); return }
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = String(reader.result || '')
      downscaleImage(dataUrl, 256).then((scaled) => setAvatarUrl(scaled))
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="glass rounded-2xl border border-white/[0.08] p-5 mb-2">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display font-bold text-base text-white inline-flex items-center gap-2">
          <Pencil className="w-4 h-4 text-plasma" strokeWidth={2} />
          Edit profile
        </h2>
        {dirty && (
          <button
            onClick={handleSave}
            className="px-3.5 py-1.5 rounded-lg border border-crimson/35 bg-crimson/12 text-crimson text-xs font-semibold hover:bg-crimson/22 inline-flex items-center gap-1.5 transition-all"
          >
            {saved && <Check className="w-3.5 h-3.5" />}
            {saved ? 'Saved!' : 'Save changes'}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-5 items-start">
        {/* Avatar */}
        <div className="flex flex-col items-center gap-2.5">
          <div className="relative">
            <Avatar name={name} src={avatarUrl} color={profile.color} size={88} />
            <div
              className="absolute -inset-3 rounded-full blur-xl opacity-20 pointer-events-none"
              style={{ background: profile.color }}
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="px-2.5 py-1.5 rounded-lg border border-white/[0.09] bg-white/[0.04] hover:bg-white/[0.08] text-white/70 text-xs inline-flex items-center gap-1.5 transition-all"
            >
              <ImageIcon className="w-3.5 h-3.5" />
              {avatarUrl ? 'Change' : 'Upload'}
            </button>
            {avatarUrl && (
              <button
                type="button"
                onClick={() => setAvatarUrl('')}
                className="px-2.5 py-1.5 rounded-lg border border-white/[0.09] bg-white/[0.04] hover:bg-white/[0.08] text-white/55 text-xs inline-flex items-center gap-1.5 transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Remove
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
          </div>
        </div>

        {/* Name input */}
        <div>
          <label className="block">
            <span className="text-white/40 text-[10px] font-mono uppercase tracking-wider mb-2 block">
              Display name
            </span>
            <input
              className="input"
              maxLength={24}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your player name"
            />
          </label>
          <p className="text-white/30 text-xs mt-2 leading-relaxed">
            Shown to other players in chat and on the leaderboard. You can change it anytime.
          </p>
        </div>
      </div>
    </div>
  )
}

function XpBar({ xp, level }) {
  const xpForNext    = level * 100
  const xpIntoLevel  = xp % xpForNext
  const pct          = Math.min(100, Math.round((xpIntoLevel / xpForNext) * 100))
  return (
    <div className="rounded-xl border border-white/[0.09] bg-white/[0.02] px-4 py-3.5">
      <div className="flex items-center justify-between mb-2.5">
        <div className="text-[10px] font-mono uppercase tracking-wider text-white/35">
          Level {level} → Level {level + 1}
        </div>
        <div className="text-[10px] font-mono text-plasma">{xpIntoLevel} / {xpForNext} XP</div>
      </div>
      <div className="h-1.5 bg-white/[0.07] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-plasma to-neon transition-all duration-700"
          style={{
            width:     `${pct}%`,
            boxShadow: '0 0 8px rgba(162,89,255,0.4)',
          }}
        />
      </div>
      <div className="text-[10px] font-mono text-white/20 mt-1.5">{pct}% to next level</div>
    </div>
  )
}

function downscaleImage(dataUrl, size) {
  return new Promise((resolve) => {
    const img   = new Image()
    img.onload  = () => {
      try {
        const c   = document.createElement('canvas')
        c.width   = size
        c.height  = size
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
