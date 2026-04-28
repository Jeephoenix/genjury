import React, { useState } from 'react'
import useGameStore from '../lib/store'
import PlayerCard from '../components/PlayerCard'

export default function LobbyPage() {
  const roomCode = useGameStore(s => s.roomCode)
  const players = useGameStore(s => s.players)
  const myId = useGameStore(s => s.myId)
  const startGame = useGameStore(s => s.startGame)
  const addBotPlayers = useGameStore(s => s.addBotPlayers)
  const maxRounds = useGameStore(s => s.maxRounds)
  const [copied, setCopied] = useState(false)

  const me = players.find(p => p.id === myId)
  const isHost = me?.isHost
  const canStart = players.length >= 2

  const copyCode = () => {
    navigator.clipboard.writeText(roomCode).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
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
          <button
            onClick={copyCode}
            className={`btn btn-ghost mx-auto mt-4 text-sm px-6 ${copied ? 'text-neon border-neon/30' : ''}`}
          >
            {copied ? '✓ Copied!' : '📋 Copy Address'}
          </button>
          <p className="text-white/30 text-xs mt-3">Share this contract address with friends to join</p>
        </div>

        {/* Players */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-700 text-white">
              Players <span className="text-plasma ml-1">{players.length}</span>
            </h3>
            {isHost && players.length < 5 && (
              <button className="btn btn-ghost text-xs px-3 py-2" onClick={addBotPlayers}>
                + Add Bots
              </button>
            )}
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
                <div className="flex-1">
                  <span className="font-display font-600 text-sm text-white">{p.name}</span>
                  {p.isBot && <span className="ml-2 text-white/30 text-xs font-mono">[BOT]</span>}
                </div>
                <div className="flex items-center gap-2">
                  {p.isHost && (
                    <span className="badge text-xs" style={{ background: p.color + '22', color: p.color, border: `1px solid ${p.color}44` }}>
                      HOST
                    </span>
                  )}
                  {p.id === myId && (
                    <span className="badge bg-plasma/15 text-plasma border border-plasma/30 text-xs">YOU</span>
                  )}
                  <div className={`w-2 h-2 rounded-full ${p.isReady || p.isBot ? 'bg-neon' : 'bg-white/20'}`} />
                </div>
              </div>
            ))}
          </div>

          {players.length < 2 && (
            <p className="text-white/30 text-xs text-center mt-4">
              Need at least 2 players to start. Add bots to play solo!
            </p>
          )}
        </div>

        {/* Game Settings */}
        <div className="card">
          <h3 className="font-display font-700 text-white mb-4">How to Play</h3>
          <div className="space-y-3">
            {[
              { icon: '🎭', title: 'Deceiver writes', desc: '2 truths and 1 lie about themselves or the category' },
              { icon: '👁️', title: 'Detectors vote', desc: 'Pick which statement is the lie — bet your confidence' },
              { icon: '🤖', title: 'AI Judge rules', desc: 'The Intelligent Contract delivers its verdict on GenLayer' },
              { icon: '✊', title: 'Object!', desc: 'Raise an Objection to trigger Optimistic Democracy — players vote to sustain or overrule' },
              { icon: '⭐', title: 'XP is awarded', desc: 'For fooling players, fooling the AI, and successful objections' },
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
