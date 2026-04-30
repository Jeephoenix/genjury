import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  UserRound,
  Wallet,
  ShieldCheck,
  Copy,
  ExternalLink,
  Activity,
  Trophy,
  Flame,
  Sparkles,
  Brain,
  Lock,
  Pencil,
  Image as ImageIcon,
  Trash2,
  ArrowRight,
  Check,
} from 'lucide-react'
import {
  myAddress,
  isWalletConnected,
  subscribeWallet,
  getNetworkInfo,
  explorerAddressUrl,
  readContractView,
  hasContractAddress,
} from '../lib/genlayer'
import useGameStore from '../lib/store'
import {
  getProfile,
  setProfile,
  subscribeProfile,
} from '../lib/profile'
import {
  listJoinedRooms,
  subscribeJoinedRooms,
  forgetJoinedRoom,
} from '../lib/joinedRooms'
import Avatar from '../components/Avatar'

const short = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '')

export default function ProfilePage() {
  const setOpenWallet = useGameStore((s) => s.setWalletPanelOpen)
  const joinRoom = useGameStore((s) => s.joinRoom)
  const setActiveTab = useGameStore((s) => s.setActiveTab)
  const addToast = useGameStore((s) => s.addToast)
  const loading = useGameStore((s) => s.loading)

  const [, force] = useState(0)
  useEffect(() => subscribeWallet(() => force((n) => n + 1)), [])
  useEffect(() => subscribeProfile(() => force((n) => n + 1)), [])

  const [rooms, setRooms] = useState(() => listJoinedRooms())
  useEffect(() => subscribeJoinedRooms(() => setRooms(listJoinedRooms())), [])

  const connected = isWalletConnected()
  const address   = myAddress()
  const net       = getNetworkInfo()
  const profile   = getProfile()

  // ── Aggregate stats from chain ────────────────────────────────────────────
  // Walk every room the player has joined and pull `get_state` to find that
  // address in the players map. Sum xp / wins / games. This gives a real
  // on-chain reputation snapshot without inventing achievements.
  const [stats, setStats] = useState({ loading: false, games: 0, wins: 0, xp: 0, level: 1 })
  const [history, setHistory] = useState([])  // [{code, phase, players, fee, pool, role}]

  useEffect(() => {
    let cancelled = false
    if (!address) {
      setStats({ loading: false, games: 0, wins: 0, xp: 0, level: 1 })
      setHistory([])
      return
    }
    setStats((s) => ({ ...s, loading: true }))
    ;(async () => {
      let games = 0, wins = 0, xp = 0, level = 1
      const hist = []
      const me = address.toLowerCase()
      if (!hasContractAddress()) {
        setStats({ loading: false, games: 0, wins: 0, xp: 0, level: 1 })
        setHistory([])
        return
      }
      await Promise.all(rooms.map(async (r) => {
        try {
          const raw = await readContractView('get_room_state', [r.code])
          const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
          if (!parsed?.roomCode) return
          const players = parsed?.players || {}
          const rec = players[me] || players[address] || null
          if (rec) {
            games += 1
            xp += Number(rec.xp || 0)
            level = Math.max(level, Number(rec.level || 1))
            const won = (parsed?.winnerAddress || '').toLowerCase() === me
            if (won) wins += 1
            hist.push({
              code: r.code,
              phase: parsed?.phase || 'unknown',
              playerCount: Number(parsed?.playerCount || 0),
              maxPlayers: Number(parsed?.maxPlayers || 0),
              entryFee: parsed?.entryFee || '0',
              prizePool: parsed?.prizePool || '0',
              role: r.isHost ? 'Host' : 'Juror',
              won,
              xpInRoom: Number(rec.xp || 0),
            })
          }
        } catch {
          /* ignore unreachable rooms */
        }
      }))
      if (cancelled) return
      setStats({ loading: false, games, wins, xp, level })
      setHistory(hist.sort((a, b) => Number(b.xpInRoom) - Number(a.xpInRoom)))
    })()
    return () => { cancelled = true }
  }, [address, rooms])

  const winRate = stats.games > 0 ? Math.round((stats.wins / stats.games) * 100) : 0

  const copy = (text, label) => {
    if (!text) return
    try {
      navigator.clipboard?.writeText(text)
      addToast(label, 'success')
    } catch {
      addToast('Copy failed', 'error')
    }
  }

  const handleResume = (code) => {
    if (loading) return
    if (!isWalletConnected()) { setOpenWallet(true); return }
    joinRoom(code)
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10 sm:py-14">
      {/* Header */}
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-[0.2em] text-white/40 mb-3">
          <UserRound className="w-3.5 h-3.5 text-plasma" />
          Player profile
        </div>
        <div className="flex items-center gap-4">
          <Avatar
            name={profile.name}
            src={profile.avatarUrl}
            color={profile.color}
            size={64}
          />
          <div className="min-w-0">
            <h1 className="font-display font-800 text-3xl sm:text-4xl text-white tracking-tight truncate">
              {profile.name}
            </h1>
            <p className="text-white/55 mt-1">
              {connected
                ? `Connected as ${short(address)}`
                : 'Connect a wallet to start earning verdicts.'}
            </p>
          </div>
        </div>
      </div>

      {/* Profile editor — always available, even without a wallet */}
      <ProfileEditor profile={profile} />

      {!connected && (
        <div className="card glass border-neon/30 mb-8 mt-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-neon/10 border border-neon/30 flex items-center justify-center text-neon flex-shrink-0">
            <Lock className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-white font-display font-700 text-base">Connect a wallet to unlock on-chain stats</div>
            <div className="text-white/55 text-sm">Your wins, XP and game history are tied to your address.</div>
          </div>
          <button
            onClick={() => setOpenWallet(true)}
            className="btn btn-neon px-4 py-2 text-sm inline-flex items-center gap-2 flex-shrink-0"
          >
            <Wallet className="w-4 h-4" /> Connect
          </button>
        </div>
      )}

      {/* Stat grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6 mb-8">
        <BigStat icon={Trophy}   label="Wins"     value={connected ? String(stats.wins)         : '—'} accent="gold"   />
        <BigStat icon={Brain}    label="Win rate" value={connected ? `${winRate}%`              : '—'} accent="neon"   />
        <BigStat icon={Activity} label="Games"    value={connected ? String(stats.games)        : '—'} accent="ice"    />
        <BigStat icon={Flame}    label="XP"       value={connected ? String(stats.xp)           : '—'} accent="signal" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Wallet card */}
        <div className="card glass lg:col-span-1 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-700 text-base text-white">Wallet</h2>
            <span className="badge bg-ice/15 text-ice border border-ice/30 text-[10px] tracking-widest">
              {net.label}
            </span>
          </div>
          {connected ? (
            <>
              <div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-white/40 mb-1.5">
                  Address
                </div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded-lg bg-white/5 border border-white/10 px-2.5 py-2 font-mono text-[11px] text-white/85 break-all">
                    {address}
                  </code>
                  <button
                    onClick={() => copy(address, 'Address copied')}
                    className="btn btn-ghost px-2.5 py-2 text-xs"
                    aria-label="Copy address"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              {net.explorer && (
                <a
                  href={explorerAddressUrl(address)}
                  target="_blank"
                  rel="noopener"
                  className="inline-flex items-center gap-1.5 text-xs text-plasma/80 hover:text-plasma"
                >
                  View on explorer <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </>
          ) : (
            <p className="text-white/50 text-sm">Connect to view your wallet details and balance.</p>
          )}
        </div>

        {/* Reputation summary */}
        <div className="card glass lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-700 text-base text-white">On-chain reputation</h2>
            <span className="badge bg-plasma/15 text-plasma border border-plasma/30 text-[10px] tracking-widest">
              Level {connected ? stats.level : '—'}
            </span>
          </div>
          {!connected ? (
            <p className="text-white/55 text-sm">Connect a wallet to see your reputation.</p>
          ) : stats.loading && stats.games === 0 ? (
            <p className="text-white/55 text-sm">Reading on-chain stats…</p>
          ) : stats.games === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-6 text-center">
              <Sparkles className="w-5 h-5 text-plasma mx-auto mb-2" />
              <div className="text-white/70 text-sm">No on-chain games yet.</div>
              <div className="text-white/45 text-xs mt-1">Join a room to start building reputation.</div>
              <button
                onClick={() => setActiveTab('games')}
                className="mt-3 inline-flex items-center gap-1.5 text-plasma text-xs font-semibold"
              >
                Browse open rounds <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Mini label="Games joined" value={stats.games} icon={Activity} />
              <Mini label="Wins"         value={stats.wins} icon={Trophy} accent="gold" />
              <Mini label="Total XP"     value={stats.xp} icon={Flame} accent="signal" />
              <Mini label="Win rate"     value={`${winRate}%`} icon={ShieldCheck} accent="neon" />
            </div>
          )}
        </div>
      </div>

      {/* Game history (real, from chain) */}
      <div className="card glass mt-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display font-700 text-base text-white">Game history</h2>
          <button
            onClick={() => setActiveTab('games')}
            className="text-plasma/80 hover:text-plasma text-xs font-semibold inline-flex items-center gap-1"
          >
            Browse rooms <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
        {!connected ? (
          <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-8 text-center">
            <Activity className="w-6 h-6 text-white/30 mx-auto mb-2" />
            <div className="text-white/55 text-sm">Connect a wallet to see your match history.</div>
          </div>
        ) : history.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-8 text-center">
            <Activity className="w-6 h-6 text-white/30 mx-auto mb-2" />
            <div className="text-white/55 text-sm">No games yet — join a room to build your history.</div>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {history.map((h) => (
              <div key={h.code} className="py-3 flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center border ${
                  h.won ? 'bg-gold/15 border-gold/40 text-gold' : 'bg-white/5 border-white/10 text-white/55'
                }`}>
                  {h.won ? <Trophy className="w-4 h-4" /> : <Activity className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-white text-sm font-medium truncate">
                    {h.role} · <span className="capitalize">{h.phase}</span>
                  </div>
                  <div className="text-white/40 text-xs font-mono truncate tracking-wider">
                    Case <span className="text-white/70">{h.code}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-white/55">XP earned</div>
                  <div className="text-sm font-mono text-white">{h.xpInRoom}</div>
                </div>
                <button
                  onClick={() => handleResume(h.code)}
                  disabled={loading}
                  className="ml-2 px-3 py-1.5 rounded-lg border border-plasma/40 bg-plasma/10 text-plasma text-xs font-semibold hover:bg-plasma/20 disabled:opacity-50"
                >
                  Open
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

const ACCENTS = {
  gold:   { ring: 'border-gold/30',   text: 'text-gold'   },
  neon:   { ring: 'border-neon/30',   text: 'text-neon'   },
  ice:    { ring: 'border-ice/30',    text: 'text-ice'    },
  signal: { ring: 'border-signal/30', text: 'text-signal' },
}

function BigStat({ icon: Icon, label, value, accent = 'neon' }) {
  const a = ACCENTS[accent]
  return (
    <div className={`card glass ${a.ring}`}>
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-mono uppercase tracking-widest text-white/40">{label}</div>
        <Icon className={`w-4 h-4 ${a.text}`} strokeWidth={2} />
      </div>
      <div className="font-display font-800 text-2xl text-white mt-2 tracking-tight">{value}</div>
    </div>
  )
}

function Mini({ label, value, icon: Icon, accent = 'ice' }) {
  const a = ACCENTS[accent]
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-3">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-mono uppercase tracking-wider text-white/40">{label}</div>
        <Icon className={`w-3.5 h-3.5 ${a.text}`} />
      </div>
      <div className="text-white text-lg font-display font-700 mt-1">{value}</div>
    </div>
  )
}

// ── Profile editor (name + avatar) ────────────────────────────────────────
function ProfileEditor({ profile }) {
  const [name, setName] = useState(profile.name)
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl || '')
  const [saved, setSaved] = useState(false)
  const fileRef = useRef(null)
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
    if (!file.type.startsWith('image/')) {
      addToast('Pick an image file', 'error')
      return
    }
    if (file.size > 1.5 * 1024 * 1024) {
      addToast('Image too large (max 1.5 MB)', 'error')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = String(reader.result || '')
      // Downscale large images to keep localStorage usage reasonable.
      downscaleImage(dataUrl, 256).then((scaled) => setAvatarUrl(scaled))
    }
    reader.readAsDataURL(file)
  }

  const handleClearAvatar = () => setAvatarUrl('')

  return (
    <div className="card glass mb-2">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display font-700 text-base text-white inline-flex items-center gap-2">
          <Pencil className="w-4 h-4 text-plasma" />
          Edit profile
        </h2>
        {dirty && (
          <button
            onClick={handleSave}
            className="px-3 py-1.5 rounded-lg border border-neon/40 bg-neon/15 text-neon text-xs font-semibold hover:bg-neon/25 inline-flex items-center gap-1.5"
          >
            {saved ? <Check className="w-3.5 h-3.5" /> : null}
            {saved ? 'Saved' : 'Save changes'}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-5 items-start">
        <div className="flex flex-col items-center gap-2">
          <Avatar name={name} src={avatarUrl} color={profile.color} size={88} />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="px-2.5 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-white/80 text-xs inline-flex items-center gap-1.5"
            >
              <ImageIcon className="w-3.5 h-3.5" />
              {avatarUrl ? 'Change' : 'Upload'}
            </button>
            {avatarUrl && (
              <button
                type="button"
                onClick={handleClearAvatar}
                className="px-2.5 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-white/60 text-xs inline-flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Remove
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFile}
            />
          </div>
        </div>

        <div>
          <label className="block">
            <span className="text-white/50 text-[10px] font-mono uppercase tracking-wider mb-1.5 block">
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
          <p className="text-white/40 text-xs mt-2">
            Shown to other players in chat and on the leaderboard. You can change it anytime.
          </p>
        </div>
      </div>
    </div>
  )
}

// Crop the image to a square + downscale so we don't blow out localStorage.
function downscaleImage(dataUrl, size) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      try {
        const c = document.createElement('canvas')
        c.width = size
        c.height = size
        const ctx = c.getContext('2d')
        if (!ctx) return resolve(dataUrl)
        const s = Math.min(img.width, img.height)
        const sx = (img.width - s) / 2
        const sy = (img.height - s) / 2
        ctx.drawImage(img, sx, sy, s, s, 0, 0, size, size)
        resolve(c.toDataURL('image/jpeg', 0.85))
      } catch {
        resolve(dataUrl)
      }
    }
    img.onerror = () => resolve(dataUrl)
    img.src = dataUrl
  })
}
