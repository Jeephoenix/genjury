import React, { useEffect, useState } from 'react'
import { X, Fingerprint, Lock, User, Loader2, AtSign } from 'lucide-react'
import useGameStore from '../lib/store'
import { myAddress } from '../lib/genlayer'
import { fetchServerProfile } from '../lib/profileApi'
import { lookupEnsName } from '../lib/ens'
import Avatar from './Avatar'

function shortAddr(a) {
  if (!a) return ''
  return `${a.slice(0, 6)}…${a.slice(-4)}`
}

export default function PlayerProfileCard() {
  const target = useGameStore((s) => s.profileCardTarget)
  const close  = useGameStore((s) => s.closeProfileCard)

  const [serverProfile, setServerProfile] = useState(null)
  const [ensName,       setEnsName]       = useState(null)
  const [loading,       setLoading]       = useState(false)
  const [exiting,       setExiting]       = useState(false)

  const me = (myAddress() || '').toLowerCase()

  // Fetch server profile + ENS name whenever a new target opens
  useEffect(() => {
    if (!target) {
      setServerProfile(null)
      setEnsName(null)
      setLoading(false)
      setExiting(false)
      return
    }
    setExiting(false)
    setServerProfile(null)
    setEnsName(null)
    if (!target.address) return
    setLoading(true)
    Promise.all([
      fetchServerProfile(target.address),
      lookupEnsName(target.address),
    ]).then(([profile, ens]) => {
      setServerProfile(profile)
      setEnsName(ens || null)
      setLoading(false)
    })
  }, [target?.address])

  if (!target) return null

  const dismiss = () => {
    setExiting(true)
    setTimeout(() => close(), 200)
  }

  const isMe        = target.address && target.address.toLowerCase() === me
  const isClaimed   = !!serverProfile?.username
  const displayName = serverProfile?.username || target.name || 'Unknown Player'
  const avatar      = serverProfile?.avatarUrl || target.avatar || ''
  const color       = serverProfile?.color || target.color || '#a259ff'

  return (
    <div
      className={`fixed inset-0 z-[85] flex items-center justify-center px-4 transition-opacity duration-200 ${
        exiting ? 'opacity-0' : 'animate-fade-in'
      }`}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/75 backdrop-blur-md" onClick={dismiss} />

      {/* Card */}
      <div
        className="relative w-full max-w-xs"
        style={{ '--p-color': color }}
      >
        <div
          className="glass-strong rounded-2xl overflow-hidden"
          style={{
            border: `1px solid ${color}28`,
            boxShadow: `0 0 60px ${color}12`,
          }}
        >
          {/* Color accent line */}
          <div
            className="h-px w-full"
            style={{ background: `linear-gradient(90deg, transparent, ${color}70, transparent)` }}
          />

          <div className="p-6">
            {/* Header row */}
            <div className="flex items-center justify-between mb-5">
              <span className="text-[10px] font-mono text-white/25 uppercase tracking-[0.2em]">
                Player Profile
              </span>
              <button
                onClick={dismiss}
                className="w-7 h-7 rounded-lg bg-white/[0.05] border border-white/[0.08] text-white/30 hover:text-white transition-all flex items-center justify-center"
              >
                <X className="w-3.5 h-3.5" strokeWidth={2.5} />
              </button>
            </div>

            {/* Avatar + identity */}
            <div className="flex flex-col items-center gap-3 mb-5">
              <div className="relative">
                <div
                  className="w-20 h-20 rounded-2xl overflow-hidden ring-2"
                  style={{
                    ringColor: color,
                    boxShadow: `0 0 28px ${color}25`,
                    outline: `2px solid ${color}30`,
                  }}
                >
                  <Avatar name={displayName} src={avatar} color={color} size={80} />
                </div>
                {isMe && (
                  <div
                    className="absolute -bottom-1.5 -right-1.5 w-6 h-6 rounded-full border-2 border-void flex items-center justify-center"
                    style={{ background: color }}
                  >
                    <User className="w-3 h-3 text-void" strokeWidth={2.5} />
                  </div>
                )}
              </div>

              {/* Name + badges */}
              <div className="text-center">
                {loading ? (
                  <div className="flex items-center gap-2 justify-center">
                    <Loader2 className="w-4 h-4 text-white/30 animate-spin" />
                    <span className="font-display font-bold text-lg text-white">
                      {target.name || 'Player'}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2 mb-1.5">
                    <span className="font-display font-bold text-lg text-white leading-tight">
                      {displayName}
                    </span>
                    {isClaimed && (
                      <Fingerprint
                        className="w-4 h-4 flex-shrink-0"
                        style={{ color }}
                        strokeWidth={1.75}
                      />
                    )}
                  </div>
                )}

                {/* ENS badge */}
                {!loading && ensName && (
                  <div className="flex justify-center mb-1.5">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-ice/10 border border-ice/25 text-ice text-[10px] font-mono tracking-wide">
                      <AtSign className="w-2.5 h-2.5" strokeWidth={2.5} />{ensName}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-center gap-1.5 flex-wrap">
                  {isMe && (
                    <span className="badge bg-plasma/12 text-plasma border border-plasma/25 text-[9px]">
                      YOU
                    </span>
                  )}
                  {isClaimed && (
                    <span className="badge bg-white/[0.05] border border-white/[0.09] text-white/35 text-[9px] inline-flex items-center gap-1">
                      <Lock className="w-2 h-2" />
                      CLAIMED
                    </span>
                  )}
                  {!loading && !isClaimed && (
                    <span className="badge bg-white/[0.04] border border-white/[0.07] text-white/20 text-[9px]">
                      UNVERIFIED
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Wallet address */}
            <div className="rounded-xl bg-white/[0.04] border border-white/[0.07] px-3 py-2.5 mb-3">
              <div className="text-white/25 text-[10px] font-mono uppercase tracking-wider mb-0.5">
                Wallet
              </div>
              <div className="font-mono text-xs text-white/55 break-all">
                {shortAddr(target.address) || '—'}
              </div>
            </div>

            {/* XP / Level stats — only shown when in a game context */}
            {(target.xp !== undefined || target.level !== undefined) && (
              <div className="grid grid-cols-2 gap-2">
                {target.xp !== undefined && (
                  <div className="rounded-xl bg-white/[0.04] border border-white/[0.07] p-3 text-center">
                    <div
                      className="font-display font-bold text-2xl leading-none mb-0.5"
                      style={{ color }}
                    >
                      {target.xp}
                    </div>
                    <div className="text-white/25 text-[10px] font-mono">XP</div>
                  </div>
                )}
                {target.level !== undefined && (
                  <div className="rounded-xl bg-white/[0.04] border border-white/[0.07] p-3 text-center">
                    <div
                      className="font-display font-bold text-2xl leading-none mb-0.5"
                      style={{ color }}
                    >
                      {target.level}
                    </div>
                    <div className="text-white/25 text-[10px] font-mono">Level</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
