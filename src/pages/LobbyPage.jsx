import React, { useState } from 'react'
import {
  Share2, Copy, Coins, Drama, Eye, Bot, Hand,
  Sparkles, Trophy, Rocket, Check, LogOut, Users,
} from 'lucide-react'
import useGameStore from '../lib/store'
import { formatGen, getChainNativeSymbol } from '../lib/genlayer'
import HostDashboard from '../components/HostDashboard'
import PlatformOwnerPanel from '../components/PlatformOwnerPanel'
import Avatar from '../components/Avatar'

export default function LobbyPage() {
  const roomCode     = useGameStore((s) => s.roomCode)
  const players      = useGameStore((s) => s.players)
  const myId         = useGameStore((s) => s.myId)
  const startGame    = useGameStore((s) => s.startGame)
  const resetGame    = useGameStore((s) => s.resetGame)
  const maxRounds    = useGameStore((s) => s.maxRounds)
  const entryFeeWei  = useGameStore((s) => s.entryFeeWei)
  const prizePoolWei = useGameStore((s) => s.prizePoolWei)
  const houseAddress = useGameStore((s) => s.houseAddress)

  const [copied,     setCopied]     = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const symbol  = getChainNativeSymbol()
  const me      = players.find((p) => p.id === myId)
  const isHost  = me?.isHost
  const canStart = players.length >= 2
  const isPaid   = (entryFeeWei || 0n) > 0n

  const joinUrl = (() => {
    if (!roomCode || typeof window === 'undefined') return ''
    const u = new URL(window.location.href)
    u.search = ''
    u.hash   = ''
    u.searchParams.set('join', roomCode)
    return u.toString()
  })()

  const copyCode = () => {
    navigator.clipboard.writeText(roomCode).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const shareLink = async () => {
    if (!joinUrl) return
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Join my Genjury room', text: 'Tap to join my Genjury bluffing game:', url: joinUrl })
        return
      } catch {}
    }
    try {
      await navigator.clipboard.writeText(joinUrl)
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 2000)
    } catch {}
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-20">
      <div className="w-full max-w-md space-y-5 animate-slide-up">

        {/* Breadcrumb */}
        <div className="flex items-center justify-between">
          <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-white/35">
            Case <span className="text-neon font-semibold">{roomCode}</span> · Lobby
          </div>
          <button
            onClick={resetGame}
            className="inline-flex items-center gap-1.5 text-white/35 hover:text-signal text-xs font-mono uppercase tracking-wider transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" strokeWidth={2.25} />
            Leave room
          </button>
        </div>

        {/* Invite card */}
        <div className="glass rounded-2xl border border-white/[0.08] p-5 text-center">
          <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/30 mb-3">
            Invite players to this case
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2.5">
            <button
              onClick={shareLink}
              className={`btn btn-plasma text-sm px-5 inline-flex items-center gap-1.5 ${linkCopied ? 'opacity-80' : ''}`}
            >
              {linkCopied
                ? <><Check className="w-4 h-4" /> Link copied!</>
                : <><Share2 className="w-4 h-4" /> Share Join Link</>}
            </button>
            <button
              onClick={copyCode}
              className={`btn btn-ghost text-sm px-4 inline-flex items-center gap-1.5 ${copied ? 'text-neon border-neon/30' : ''}`}
            >
              {copied
                ? <><Check className="w-4 h-4" /> Copied!</>
                : <><Copy className="w-4 h-4" /> Copy Code</>}
            </button>
          </div>
          <p className="text-white/25 text-xs mt-3 font-mono tracking-wide">
            Room code: <span className="text-white/60 tracking-[0.22em]">{roomCode}</span>
          </p>
        </div>

        {/* Stakes card */}
        <div className="glass rounded-2xl border border-white/[0.08] p-5">
          <h3 className="font-display font-bold text-white mb-4 inline-flex items-center gap-2">
            <Coins className="w-4 h-4 text-gold" strokeWidth={2.25} />
            Stakes
            {isPaid && (
              <span className="badge bg-neon/12 text-neon border border-neon/25 text-[10px] font-mono">PAID</span>
            )}
          </h3>
          <div className="grid grid-cols-2 gap-2.5 text-sm">
            <Stat label="Entry fee"  value={`${formatGen(entryFeeWei, 6)} ${symbol}`}  accent={isPaid ? 'neon' : 'mute'} />
            <Stat label="Prize pool" value={`${formatGen(prizePoolWei, 6)} ${symbol}`} accent="gold" />
            <Stat label="Rounds"     value={`${maxRounds}`}                             accent="mute" />
          </div>
          <p className="text-white/35 text-xs mt-3.5 leading-relaxed">
            {isPaid
              ? <>Each player stakes <span className="font-mono text-neon">{formatGen(entryFeeWei, 6)} {symbol}</span>. The highest XP after {maxRounds} rounds claims the purse.</>
              : `Free-play room — no ${symbol} is staked. Bragging rights only.`}
          </p>
        </div>

        {/* Players card */}
        <div className="glass rounded-2xl border border-white/[0.08] p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-bold text-white inline-flex items-center gap-2">
              <Users className="w-4 h-4 text-plasma" strokeWidth={2.25} />
              Players
              <span className="text-plasma font-mono">{players.length}</span>
            </h3>
          </div>

          <div className="space-y-2">
            {players.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-3 px-3.5 py-3 rounded-xl transition-all hover-highlight"
                style={{
                  background: p.id === myId ? p.color + '0c' : 'rgba(255,255,255,0.025)',
                  border:     `1px solid ${p.id === myId ? p.color + '25' : 'rgba(255,255,255,0.05)'}`,
                }}
              >
                <Avatar
                  name={p.name}
                  src={p.avatar && String(p.avatar).startsWith('data:') ? p.avatar : ''}
                  color={p.color}
                  size={36}
                />
                <div className="flex-1 min-w-0">
                  <div className="font-display font-semibold text-sm text-white truncate">{p.name}</div>
                  <div className="text-white/25 text-[10px] font-mono truncate">{p.id?.slice(0, 16)}…</div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {p.isHost && (
                    <span
                      className="badge text-[10px]"
                      style={{ background: p.color + '1a', color: p.color, border: `1px solid ${p.color}33` }}
                    >
                      HOST
                    </span>
                  )}
                  {p.id === myId && (
                    <span className="badge bg-plasma/12 text-plasma border border-plasma/25 text-[10px]">YOU</span>
                  )}
                  <div className="dot-live w-2 h-2" />
                </div>
              </div>
            ))}
          </div>

          {players.length < 2 && (
            <p className="text-white/25 text-xs text-center mt-4 font-mono">
              Need at least 2 players to start. Share the room code with a friend.
            </p>
          )}
        </div>

        {/* How to play */}
        <div className="glass rounded-2xl border border-white/[0.07] p-5">
          <h3 className="font-display font-bold text-white mb-4">How to Play</h3>
          <div className="space-y-3">
            {[
              { Icon: Drama,    color: 'text-plasma', title: 'Deceiver writes',    desc: '2 truths and 1 lie about themselves or the category' },
              { Icon: Eye,      color: 'text-neon',   title: 'Detectors vote',     desc: 'Pick which statement is the lie — bet your confidence' },
              { Icon: Bot,      color: 'text-signal', title: 'AI Judge rules',     desc: 'The Intelligent Contract delivers its verdict on GenLayer' },
              { Icon: Hand,     color: 'text-gold',   title: 'Object!',            desc: 'Raise an Objection to trigger Optimistic Democracy' },
              { Icon: Sparkles, color: 'text-gold',   title: 'XP is awarded',      desc: 'For fooling players, fooling the AI, and successful objections' },
              ...(isPaid ? [{ Icon: Trophy, color: 'text-gold', title: `Highest XP wins the ${symbol} pot`, desc: 'Winner claims the prize pool on the scoreboard' }] : []),
            ].map((item) => (
              <div key={item.title} className="flex gap-3 text-sm">
                <div className="w-8 h-8 rounded-lg bg-white/[0.04] flex items-center justify-center flex-shrink-0 mt-0.5">
                  <item.Icon className={`w-4 h-4 ${item.color}`} strokeWidth={2} />
                </div>
                <div className="flex-1 pt-1">
                  <span className="text-white/75 font-semibold">{item.title} — </span>
                  <span className="text-white/35">{item.desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Host admin panel */}
        {isHost && <HostDashboard />}
        {myId && houseAddress && myId === houseAddress && <PlatformOwnerPanel />}

        {/* Start button */}
        {isHost && (
          <button
            className="btn btn-crimson w-full py-5 text-lg inline-flex items-center justify-center gap-2"
            disabled={!canStart}
            onClick={startGame}
          >
            {canStart ? (
              <><Rocket className="w-5 h-5" strokeWidth={2.25} /> Start Genjury</>
            ) : (
              `Need ${2 - players.length} more player${players.length === 1 ? '' : 's'}`
            )}
          </button>
        )}

        {!isHost && (
          <div className="text-center text-white/25 text-sm font-mono">
            Waiting for host to start the game…
          </div>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value, accent = 'mute' }) {
  const colors = { neon: 'text-neon', gold: 'text-gold', plasma: 'text-plasma', mute: 'text-white/75' }
  return (
    <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] px-3.5 py-3">
      <div className="text-white/35 text-[10px] font-mono uppercase tracking-wider mb-1">{label}</div>
      <div className={`font-mono text-sm font-medium ${colors[accent]}`}>{value}</div>
    </div>
  )
}
