import React, { useState } from 'react'
import useGameStore from '../lib/store'
import { formatGen, getChainNativeSymbol, getNetworkInfo } from '../lib/genlayer'
import HostDashboard from '../components/HostDashboard'
import PlatformOwnerPanel from '../components/PlatformOwnerPanel'

export default function LobbyPage() {
  const roomCode  = useGameStore(s => s.roomCode)
  const players   = useGameStore(s => s.players)
  const myId      = useGameStore(s => s.myId)
  const startGame = useGameStore(s => s.startGame)
  const maxRounds = useGameStore(s => s.maxRounds)
  const entryFeeWei  = useGameStore(s => s.entryFeeWei)
  const prizePoolWei = useGameStore(s => s.prizePoolWei)
  const houseAddress = useGameStore(s => s.houseAddress)

  const [copied, setCopied] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const symbol = getChainNativeSymbol()
  const explorer = getNetworkInfo().explorer

  const me = players.find(p => p.id === myId)
  const isHost = me?.isHost
  const canStart = players.length >= 2
  const isPaid = (entryFeeWei || 0n) > 0n

  // Build a one-tap join URL like https://genjury.vercel.app/?join=0x717D…AA14
  const joinUrl = (() => {
    if (!roomCode || typeof window === 'undefined') return ''
    const u = new URL(window.location.href)
    u.search = ''
    u.hash = ''
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
    // Native share sheet on mobile if available — falls back to clipboard.
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join my Genjury room',
          text: 'Tap to join my Genjury bluffing game:',
          url: joinUrl,
        })
        return
      } catch {
        // User cancelled the share sheet — fall through to clipboard copy.
      }
    }
    try {
      await navigator.clipboard.writeText(joinUrl)
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 2000)
    } catch {}
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-20">
      <div className="w-full max-w-md space-y-6 animate-slide-up">
        {/* Room Code */}
        <div className="card text-center">
          <p className="text-white/40 text-xs font-mono uppercase tracking-widest mb-3">Contract Address</p>
          <button
            onClick={copyCode}
            className="group font-display font-700 text-2xl text-neon text-glow-neon hover:scale-[1.02] transition-transform block mx-auto"
            title={roomCode}
          >
            {roomCode ? `${roomCode.slice(0, 6)}…${roomCode.slice(-4)}` : ''}
          </button>
          <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
            <button
              onClick={shareLink}
              className={`btn btn-plasma text-sm px-6 ${linkCopied ? 'opacity-80' : ''}`}
            >
              {linkCopied ? '✓ Link copied!' : '🔗 Share Join Link'}
            </button>
            <button
              onClick={copyCode}
              className={`btn btn-ghost text-sm px-4 ${copied ? 'text-neon border-neon/30' : ''}`}
            >
              {copied ? '✓ Copied!' : '📋 Copy Address'}
            </button>
            {explorer && (
              <a
                href={`${explorer}/address/${roomCode}`}
                target="_blank"
                rel="noopener"
                className="btn btn-ghost text-sm px-4"
              >
                ↗ Explorer
              </a>
            )}
          </div>
          <p className="text-white/30 text-xs mt-3">Tap “Share Join Link” to send a one-tap invite — or share just the contract address.</p>
        </div>

        {/* Stakes */}
        <div className="card">
          <h3 className="font-display font-700 text-white mb-4 flex items-center gap-2">
            💰 Stakes
            {isPaid && (
              <span className="badge bg-neon/15 text-neon border border-neon/30 text-[10px]">PAID</span>
            )}
          </h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Stat
              label="Entry fee"
              value={`${formatGen(entryFeeWei, 6)} ${symbol}`}
              accent={isPaid ? 'neon' : 'mute'}
            />
            <Stat
              label="Prize pool"
              value={`${formatGen(prizePoolWei, 6)} ${symbol}`}
              accent="gold"
            />
            <Stat
              label="Rounds"
              value={`${maxRounds}`}
              accent="mute"
            />
          </div>
          {isPaid ? (
            <p className="text-white/40 text-xs mt-4 leading-relaxed">
              Each player must pay <span className="font-mono text-neon">{formatGen(entryFeeWei, 6)} {symbol}</span> to join.
              The winner of round {maxRounds} claims the entire prize pool from the contract.
            </p>
          ) : (
            <p className="text-white/40 text-xs mt-4 leading-relaxed">
              This is a free-play room — no {symbol} is staked. Bragging rights only.
            </p>
          )}
        </div>

        {/* Players */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-700 text-white">
              Players <span className="text-plasma ml-1">{players.length}</span>
            </h3>
          </div>
          <div className="space-y-2">
            {players.map(p => (
              <div
                key={p.id}
                className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] animate-slide-up"
              >
                <div className="avatar text-lg" style={{ background: p.color + '22', color: p.color }}>
                  {p.avatar}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-display font-600 text-sm text-white truncate">{p.name}</div>
                  <div className="text-white/30 text-[10px] font-mono truncate">{p.id}</div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {p.isHost && (
                    <span className="badge text-xs" style={{ background: p.color + '22', color: p.color, border: `1px solid ${p.color}44` }}>
                      HOST
                    </span>
                  )}
                  {p.id === myId && (
                    <span className="badge bg-plasma/15 text-plasma border border-plasma/30 text-xs">YOU</span>
                  )}
                  <div className="w-2 h-2 rounded-full bg-neon" />
                </div>
              </div>
            ))}
          </div>

          {players.length < 2 && (
            <p className="text-white/30 text-xs text-center mt-4">
              Need at least 2 players to start. Share the contract address with a friend.
            </p>
          )}
        </div>

        {/* How to play */}
        <div className="card">
          <h3 className="font-display font-700 text-white mb-4">How to Play</h3>
          <div className="space-y-3">
            {[
              { icon: '🎭', title: 'Deceiver writes', desc: '2 truths and 1 lie about themselves or the category' },
              { icon: '👁️', title: 'Detectors vote', desc: 'Pick which statement is the lie — bet your confidence' },
              { icon: '🤖', title: 'AI Judge rules', desc: 'The Intelligent Contract delivers its verdict on GenLayer' },
              { icon: '✊', title: 'Object!', desc: 'Raise an Objection to trigger Optimistic Democracy — players vote to sustain or overrule' },
              { icon: '⭐', title: 'XP is awarded', desc: 'For fooling players, fooling the AI, and successful objections' },
              ...(isPaid ? [{ icon: '🏆', title: `Highest XP wins the ${symbol} pot`, desc: 'Winner claims the prize pool from the contract on the scoreboard' }] : []),
            ].map(item => (
              <div key={item.title} className="flex gap-3 text-sm">
                <span className="text-lg flex-shrink-0">{item.icon}</span>
                <div>
                  <span className="text-white/80 font-600">{item.title} — </span>
                  <span className="text-white/40">{item.desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Host-only admin panel */}
        {isHost && <HostDashboard />}

        {/* Platform-owner-only admin panel (independent of host role) */}
        {myId && houseAddress && myId === houseAddress && <PlatformOwnerPanel />}

        {/* Start Button */}
        {isHost && (
          <button
            className="btn btn-neon w-full py-5 text-lg"
            disabled={!canStart}
            onClick={startGame}
          >
            {canStart ? '🚀 Start Genjury' : `Need ${2 - players.length} more player${players.length === 1 ? '' : 's'}`}
          </button>
        )}

        {!isHost && (
          <div className="text-center text-white/30 text-sm">
            Waiting for host to start the game…
          </div>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value, accent = 'mute' }) {
  const accentColors = {
    neon:   'text-neon',
    gold:   'text-gold',
    plasma: 'text-plasma',
    mute:   'text-white/80',
  }
  return (
    <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] px-3 py-2.5">
      <div className="text-white/40 text-[10px] font-mono uppercase tracking-wider">{label}</div>
      <div className={`font-mono mt-1 ${accentColors[accent]}`}>{value}</div>
    </div>
  )
}
