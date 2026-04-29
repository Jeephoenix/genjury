import React, { useEffect, useState } from 'react'
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
} from 'lucide-react'
import {
  myAddress,
  isWalletConnected,
  subscribeWallet,
  getNetworkInfo,
  explorerAddressUrl,
} from '../lib/genlayer'
import useGameStore from '../lib/store'

const short = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '')

const ACHIEVEMENTS = [
  { id: 'first-blood',    name: 'First Verdict',     desc: 'Win your first round.',                icon: Sparkles, unlocked: false },
  { id: 'detector',       name: 'Sharp Eye',         desc: 'Catch 10 lies in a row.',              icon: Brain,    unlocked: false },
  { id: 'silver-tongue',  name: 'Silver Tongue',     desc: 'Fool every detector in one round.',    icon: Trophy,   unlocked: false },
  { id: 'house-burner',   name: 'House Burner',      desc: 'Earn 10 GEN in winnings.',             icon: Flame,    unlocked: false },
  { id: 'objector',       name: 'The Objector',      desc: 'Successfully overturn a verdict.',     icon: ShieldCheck, unlocked: false },
  { id: 'high-roller',    name: 'High Roller',       desc: 'Play in a 1+ GEN entry game.',         icon: Activity, unlocked: false },
]

export default function ProfilePage() {
  const setOpen = useGameStore((s) => s.setWalletPanelOpen)
  const [, force] = useState(0)
  useEffect(() => subscribeWallet(() => force((n) => n + 1)), [])

  const connected = isWalletConnected()
  const address   = myAddress()
  const net       = getNetworkInfo()
  const addToast  = useGameStore((s) => s.addToast)

  const copy = (text, label) => {
    if (!text) return
    try {
      navigator.clipboard?.writeText(text)
      addToast(label, 'success')
    } catch {
      addToast('Copy failed', 'error')
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10 sm:py-14">
      {/* Header */}
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-[0.2em] text-white/40 mb-3">
          <UserRound className="w-3.5 h-3.5 text-plasma" />
          Player profile
        </div>
        <h1 className="font-display font-800 text-3xl sm:text-4xl text-white tracking-tight">
          {connected ? short(address) : 'Anonymous Player'}
        </h1>
        <p className="text-white/55 mt-2 max-w-xl">
          {connected
            ? 'Your on-chain reputation, achievements, and game history.'
            : 'Connect a wallet to claim your profile and start earning verdicts.'}
        </p>
      </div>

      {!connected && (
        <div className="card glass border-neon/30 mb-8 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-neon/10 border border-neon/30 flex items-center justify-center text-neon flex-shrink-0">
            <Lock className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-white font-display font-700 text-base">Connect a wallet to unlock your profile</div>
            <div className="text-white/55 text-sm">All stats and achievements are tied to your on-chain address.</div>
          </div>
          <button
            onClick={() => setOpen(true)}
            className="btn btn-neon px-4 py-2 text-sm inline-flex items-center gap-2 flex-shrink-0"
          >
            <Wallet className="w-4 h-4" /> Connect
          </button>
        </div>
      )}

      {/* Stat grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <BigStat icon={Trophy}   label="Total wins"  value={connected ? '0'    : '—'} accent="gold"   />
        <BigStat icon={Brain}    label="Win rate"    value={connected ? '0%'   : '—'} accent="neon"   />
        <BigStat icon={Activity} label="Games"       value={connected ? '0'    : '—'} accent="ice"    />
        <BigStat icon={Flame}    label="Best streak" value={connected ? '0'    : '—'} accent="signal" />
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

        {/* Achievements */}
        <div className="card glass lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-700 text-base text-white">Achievements</h2>
            <span className="text-white/40 text-xs font-mono">0 / {ACHIEVEMENTS.length}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {ACHIEVEMENTS.map((a) => {
              const Icon = a.icon
              return (
                <div
                  key={a.id}
                  className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-3 opacity-70"
                >
                  <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/50 flex-shrink-0">
                    <Icon className="w-5 h-5" strokeWidth={2} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-white/85 text-sm font-medium flex items-center gap-1.5">
                      {a.name}
                      <Lock className="w-3 h-3 text-white/30" />
                    </div>
                    <div className="text-white/45 text-xs">{a.desc}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Recent activity */}
      <div className="card glass mt-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display font-700 text-base text-white">Recent activity</h2>
        </div>
        <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-8 text-center">
          <Activity className="w-6 h-6 text-white/30 mx-auto mb-2" />
          <div className="text-white/55 text-sm">
            {connected ? 'No games played yet — jump into a room to record your first match.' : 'Connect a wallet to start a match history.'}
          </div>
        </div>
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
