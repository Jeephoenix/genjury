import React from 'react'
import { Home, Gamepad2, Trophy, UserRound, Gavel } from 'lucide-react'
import useGameStore, { PHASES } from '../lib/store'
import WalletButton from './WalletButton'

const TABS = [
  { id: 'home',        label: 'Home',        icon: Home },
  { id: 'games',       label: 'Games',       icon: Gamepad2 },
  { id: 'leaderboard', label: 'Leaderboard', icon: Trophy },
  { id: 'profile',     label: 'Profile',     icon: UserRound },
]

export default function TopNav() {
  const activeTab    = useGameStore((s) => s.activeTab)
  const setActiveTab = useGameStore((s) => s.setActiveTab)
  const roomCode     = useGameStore((s) => s.roomCode)
  const phase        = useGameStore((s) => s.phase)

  const inLobby = !!(roomCode && phase === PHASES.LOBBY)

  const select = (id) => {
    setActiveTab(id)
  }

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-white/10 bg-void/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
          {/* Brand */}
          <button
            onClick={() => select('home')}
            className="flex items-center gap-2.5 flex-shrink-0 group"
            aria-label="Genjury home"
          >
            <div className="relative">
              <img src="/logo.png" alt="" className="w-8 h-8 object-contain" />
              <div className="absolute inset-0 rounded-full bg-neon/20 blur-md opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <span className="font-display font-800 text-lg text-white tracking-tight">
              Gen<span className="text-neon text-glow-neon">jury</span>
            </span>
          </button>

          {/* Desktop tabs */}
          <nav className="hidden md:flex items-center gap-1 mx-4">
            {TABS.map(({ id, label, icon: Icon }) => {
              const active = activeTab === id
              return (
                <button
                  key={id}
                  onClick={() => select(id)}
                  className={`relative flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    active
                      ? 'text-white bg-white/5'
                      : 'text-white/55 hover:text-white hover:bg-white/5'
                  }`}
                  aria-current={active ? 'page' : undefined}
                >
                  <Icon className="w-4 h-4" strokeWidth={2.25} />
                  <span>{label}</span>
                  {active && (
                    <span className="absolute inset-x-3 -bottom-px h-px bg-gradient-to-r from-transparent via-neon to-transparent" />
                  )}
                </button>
              )
            })}
            {/* In-Room pill — only visible while sitting in an active lobby */}
            {inLobby && (
              <button
                onClick={() => select('lobby')}
                className={`relative flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  activeTab === 'lobby'
                    ? 'text-neon bg-neon/10 border border-neon/30'
                    : 'text-neon/70 hover:text-neon hover:bg-neon/10 border border-neon/20'
                }`}
              >
                <span className="relative flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-neon animate-pulse" />
                  <Gavel className="w-4 h-4" strokeWidth={2.25} />
                  <span className="font-mono tracking-widest text-[11px]">{roomCode}</span>
                </span>
                {activeTab === 'lobby' && (
                  <span className="absolute inset-x-3 -bottom-px h-px bg-gradient-to-r from-transparent via-neon to-transparent" />
                )}
              </button>
            )}
          </nav>

          <div className="flex-1" />

          {/* Right cluster */}
          <div className="flex items-center gap-2">
            <div className="hidden sm:block">
              <WalletButton />
            </div>
            <div className="sm:hidden">
              <WalletButton compact />
            </div>
          </div>
        </div>
      </header>

      {/* Mobile bottom tab bar */}
      <nav
        className="md:hidden fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-void/85 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]"
        aria-label="Primary"
      >
        <div className={`mx-auto max-w-7xl grid ${inLobby ? 'grid-cols-5' : 'grid-cols-4'}`}>
          {TABS.map(({ id, label, icon: Icon }) => {
            const active = activeTab === id
            return (
              <button
                key={id}
                onClick={() => select(id)}
                className={`relative flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-medium transition-colors ${
                  active ? 'text-white' : 'text-white/55 hover:text-white'
                }`}
                aria-current={active ? 'page' : undefined}
              >
                <Icon className="w-5 h-5" strokeWidth={2.25} />
                <span>{label}</span>
                {active && (
                  <span className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-neon to-transparent" />
                )}
              </button>
            )
          })}
          {/* In-Room tab — shown on mobile when sitting in an active lobby */}
          {inLobby && (
            <button
              onClick={() => select('lobby')}
              className={`relative flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-medium transition-colors ${
                activeTab === 'lobby' ? 'text-neon' : 'text-neon/60 hover:text-neon'
              }`}
              aria-current={activeTab === 'lobby' ? 'page' : undefined}
            >
              <span className="relative">
                <Gavel className="w-5 h-5" strokeWidth={2.25} />
                <span className="absolute -top-0.5 -right-1 w-2 h-2 rounded-full bg-neon animate-pulse border border-void" />
              </span>
              <span className="font-mono tracking-wider">{roomCode}</span>
              {activeTab === 'lobby' && (
                <span className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-neon to-transparent" />
              )}
            </button>
          )}
        </div>
      </nav>
    </>
  )
}
