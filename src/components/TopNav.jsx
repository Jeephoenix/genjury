import React, { useState } from 'react'
import { Home, Gamepad2, Trophy, UserRound, Menu, X } from 'lucide-react'
import useGameStore from '../lib/store'
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
  const [mobileOpen, setMobileOpen] = useState(false)

  const select = (id) => {
    setActiveTab(id)
    setMobileOpen(false)
  }

  return (
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

          {/* Mobile menu toggle */}
          <button
            onClick={() => setMobileOpen((v) => !v)}
            className="md:hidden inline-flex items-center justify-center w-9 h-9 rounded-lg text-white/70 hover:text-white hover:bg-white/5 transition-colors"
            aria-label="Toggle navigation"
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <nav className="md:hidden border-t border-white/10 bg-void/90 backdrop-blur-xl">
          <div className="mx-auto max-w-7xl px-4 py-2 grid grid-cols-2 gap-1">
            {TABS.map(({ id, label, icon: Icon }) => {
              const active = activeTab === id
              return (
                <button
                  key={id}
                  onClick={() => select(id)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    active
                      ? 'text-white bg-white/10 border border-white/10'
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon className="w-4 h-4" strokeWidth={2.25} />
                  {label}
                </button>
              )
            })}
          </div>
        </nav>
      )}
    </header>
  )
}
