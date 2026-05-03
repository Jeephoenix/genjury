import React, { useCallback, memo } from 'react'
import { Home, Gamepad2, Trophy, UserRound, Gavel } from 'lucide-react'
import useGameStore, { PHASES } from '../lib/store'
import WalletButton from './WalletButton'

const TABS = [
  { id: 'home',        label: 'Home',        icon: Home },
  { id: 'games',       label: 'Games',       icon: Gamepad2 },
  { id: 'leaderboard', label: 'Leaderboard', icon: Trophy },
  { id: 'profile',     label: 'Profile',     icon: UserRound },
]

const NavTab = memo(function NavTab({ id, label, icon: Icon, active, onSelect }) {
  return (
    <button
      onClick={() => onSelect(id)}
      className={`relative flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-plasma/50 ${
        active
          ? 'text-white bg-white/[0.07]'
          : 'text-white/50 hover:text-white/80 hover:bg-white/[0.04]'
      }`}
      aria-current={active ? 'page' : undefined}
    >
      <Icon className={`w-4 h-4 transition-colors ${active ? 'text-crimson' : ''}`} strokeWidth={2.25} />
      <span>{label}</span>
      {active && (
        <>
          <span className="absolute inset-x-2 -bottom-px h-[2px] rounded-full bg-gradient-to-r from-crimson/40 via-crimson to-crimson/40 shadow-[0_0_5px_#a0324b]" />
          <span className="absolute inset-0 rounded-xl bg-crimson/[0.03]" />
        </>
      )}
    </button>
  )
})

const MobileNavTab = memo(function MobileNavTab({ id, label, icon: Icon, active, onSelect }) {
  return (
    <button
      onClick={() => onSelect(id)}
      className={`relative flex flex-col items-center justify-center gap-1 py-3 min-h-[56px] text-[11px] font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-inset focus-visible:ring-2 focus-visible:ring-plasma/40 ${
        active ? 'text-white' : 'text-white/40 hover:text-white/70'
      }`}
      aria-current={active ? 'page' : undefined}
    >
      <div className={`p-1.5 rounded-lg transition-all duration-200 ${active ? 'bg-white/[0.07]' : ''}`}>
        <Icon className={`w-5 h-5 transition-colors ${active ? 'text-crimson' : ''}`} strokeWidth={2.25} />
      </div>
      <span className="tracking-wide">{label}</span>
      {active && (
        <span className="absolute inset-x-4 top-0 h-[2px] rounded-full bg-gradient-to-r from-transparent via-crimson to-transparent shadow-[0_0_5px_#a0324b]" />
      )}
    </button>
  )
})

const TopNav = memo(function TopNav() {
  const activeTab    = useGameStore((s) => s.activeTab)
  const setActiveTab = useGameStore((s) => s.setActiveTab)
  const roomCode     = useGameStore((s) => s.roomCode)
  const phase        = useGameStore((s) => s.phase)

  const inLobby = !!(roomCode && phase === PHASES.LOBBY)

  const select = useCallback((id) => {
    setActiveTab(id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [setActiveTab])

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-white/[0.07] bg-void/80 backdrop-blur-2xl">
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-plasma/40 to-transparent" />

        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
          {/* Brand */}
          <button
            onClick={() => select('home')}
            className="flex items-center gap-2.5 flex-shrink-0 group"
            aria-label="Genjury home"
          >
            <div className="relative">
              <img src="/logo.png" alt="" className="w-8 h-8 object-contain transition-transform duration-300 group-hover:scale-110" />
              <div className="absolute inset-0 rounded-full bg-crimson/30 blur-lg opacity-0 group-hover:opacity-100 transition-all duration-300" />
            </div>
            <span className="font-brand font-extrabold text-lg text-white tracking-tight">
              Gen<span className="text-crimson text-glow-crimson">jury</span>
            </span>
          </button>

          {/* Desktop tabs */}
          <nav className="hidden md:flex items-center gap-0.5 ml-3" aria-label="Primary">
            {TABS.map(({ id, label, icon }) => (
              <NavTab
                key={id}
                id={id}
                label={label}
                icon={icon}
                active={activeTab === id}
                onSelect={select}
              />
            ))}

            {/* In-Room pill */}
            {inLobby && (
              <button
                onClick={() => select('lobby')}
                className={`relative flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-all duration-200 ml-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon/50 ${
                  activeTab === 'lobby'
                    ? 'text-neon bg-neon/[0.09] border border-neon/25 glow-neon'
                    : 'text-neon/65 hover:text-neon hover:bg-neon/[0.07] border border-neon/15'
                }`}
                aria-label={`Active room: ${roomCode}`}
              >
                <span className="flex items-center gap-1.5">
                  <span className="dot-live" aria-hidden="true" />
                  <Gavel className="w-4 h-4" strokeWidth={2.25} />
                  <span className="font-mono tracking-widest text-[11px]">{roomCode}</span>
                </span>
                {activeTab === 'lobby' && (
                  <span className="absolute inset-x-2 -bottom-px h-[2px] rounded-full bg-gradient-to-r from-neon/40 via-neon to-neon/40 shadow-[0_0_8px_#7fff6e]" />
                )}
              </button>
            )}
          </nav>

          <div className="flex-1" />

          {/* Right cluster — flush right */}
          <div className="flex items-center">
            <div className="hidden md:block">
              <WalletButton />
            </div>
            <div className="md:hidden">
              <WalletButton compact />
            </div>
          </div>
        </div>
      </header>

      {/* Mobile bottom tab bar */}
      <nav
        className="md:hidden fixed inset-x-0 bottom-0 z-50 border-t border-white/[0.07] bg-void/90 backdrop-blur-2xl pb-[env(safe-area-inset-bottom,0px)]"
        aria-label="Primary"
      >
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-plasma/30 to-transparent" />

        <div className={`mx-auto max-w-7xl grid ${inLobby ? 'grid-cols-5' : 'grid-cols-4'}`}>
          {TABS.map(({ id, label, icon }) => (
            <MobileNavTab
              key={id}
              id={id}
              label={label}
              icon={icon}
              active={activeTab === id}
              onSelect={select}
            />
          ))}

          {/* In-Room tab */}
          {inLobby && (
            <button
              onClick={() => select('lobby')}
              className={`relative flex flex-col items-center justify-center gap-1 py-3 min-h-[56px] text-[11px] font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-inset focus-visible:ring-2 focus-visible:ring-neon/40 ${
                activeTab === 'lobby' ? 'text-neon' : 'text-neon/50 hover:text-neon'
              }`}
              aria-current={activeTab === 'lobby' ? 'page' : undefined}
              aria-label={`Active room: ${roomCode}`}
            >
              <div className={`relative p-1.5 rounded-lg transition-all duration-200 ${activeTab === 'lobby' ? 'bg-neon/10' : ''}`}>
                <Gavel className="w-5 h-5" strokeWidth={2.25} />
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-neon border border-void animate-pulse" aria-hidden="true" />
              </div>
              <span className="font-mono tracking-wider">{roomCode}</span>
              {activeTab === 'lobby' && (
                <span className="absolute inset-x-4 top-0 h-[2px] rounded-full bg-gradient-to-r from-transparent via-neon to-transparent shadow-[0_0_8px_#7fff6e]" />
              )}
            </button>
          )}
        </div>
      </nav>
    </>
  )
})

export default TopNav
