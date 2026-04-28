import React, { useState } from 'react'
import useGameStore from '../lib/store'

export default function LandingPage() {
  const [mode, setMode] = useState(null) // 'create' | 'join'
  const [name, setName] = useState('')
  const [roomCode, setRoomCode] = useState('')
  const createRoom = useGameStore(s => s.createRoom)
  const joinRoom = useGameStore(s => s.joinRoom)
  const loading = useGameStore(s => s.loading)

  const handleCreate = () => {
    if (!name.trim() || loading) return
    createRoom(name.trim())
  }

  const handleJoin = () => {
    if (!name.trim() || !roomCode.trim() || loading) return
    joinRoom(roomCode.trim(), name.trim())
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-20 relative">
      {/* Hero */}
      <div className="text-center mb-12 animate-slide-up">
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="relative">
            <div className="text-6xl">⚖️</div>
            <div className="absolute -inset-2 bg-plasma/20 rounded-full blur-xl animate-pulse" />
          </div>
        </div>

        <h1 className="font-display text-6xl sm:text-7xl font-800 leading-none mb-4">
          <span className="shimmer-text">Genjury</span>
        </h1>

        <p className="text-white/50 text-lg sm:text-xl max-w-lg mx-auto leading-relaxed font-body">
          Two truths, one lie. Fool the players. Fool the AI Judge.
          <br />
          <span className="text-plasma/80">Powered by GenLayer's Intelligent Contracts.</span>
        </p>

        {/* Mechanic pills */}
        <div className="flex flex-wrap gap-2 justify-center mt-6">
          {[
            { icon: '🎭', label: 'Deceiver vs Detectors' },
            { icon: '🤖', label: 'AI Judge' },
            { icon: '🗳️', label: 'Optimistic Democracy' },
            { icon: '⚡', label: '5–15 min sessions' },
          ].map(p => (
            <span key={p.label} className="badge bg-white/5 border border-white/10 text-white/60 text-sm py-1.5 px-3">
              {p.icon} {p.label}
            </span>
          ))}
        </div>
      </div>

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
              <button onClick={() => setMode(null)} className="text-white/40 hover:text-white transition-colors text-sm">
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
                onKeyDown={e => e.key === 'Enter' && mode === 'create' ? handleCreate() : null}
                autoFocus
              />
            </div>

            {mode === 'join' && (
              <div>
                <label className="text-white/50 text-xs font-mono uppercase tracking-wider mb-2 block">Contract Address</label>
                <input
                  className="input font-mono text-xs"
                  placeholder="0x…"
                  value={roomCode}
                  onChange={e => setRoomCode(e.target.value.trim())}
                  maxLength={66}
                  onKeyDown={e => e.key === 'Enter' && handleJoin()}
                />
                <p className="text-white/30 text-xs mt-1">Paste the GenLayer contract address from the host.</p>
              </div>
            )}

            <button
              className={`btn w-full py-4 text-base ${mode === 'create' ? 'btn-neon' : 'btn-plasma'}`}
              onClick={mode === 'create' ? handleCreate : handleJoin}
              disabled={loading || !name.trim() || (mode === 'join' && roomCode.length < 10)}
            >
              {loading
                ? '⏳ Talking to GenLayer…'
                : mode === 'create' ? '🎮 Deploy & Enter' : '🚀 Join Game'}
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
