import React, { useEffect, useRef, useState } from 'react'
import {
  Fingerprint, X, Lock, Shield, Zap, AlertCircle,
  Check, Loader2, Image as ImageIcon, Trash2, ArrowRight,
} from 'lucide-react'
import useGameStore from '../lib/store'
import { myAddress } from '../lib/genlayer'
import { getProfile, applyServerProfile } from '../lib/profile'
import { checkUsername, claimIdentity } from '../lib/profileApi'
import Avatar from './Avatar'

function useDebounce(value, delay) {
  const [dv, setDv] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDv(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return dv
}

function downscaleImage(dataUrl, size) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      try {
        const c = document.createElement('canvas')
        c.width = c.height = size
        const ctx = c.getContext('2d')
        if (!ctx) return resolve(dataUrl)
        const s  = Math.min(img.width, img.height)
        const sx = (img.width  - s) / 2
        const sy = (img.height - s) / 2
        ctx.drawImage(img, sx, sy, s, s, 0, 0, size, size)
        resolve(c.toDataURL('image/jpeg', 0.85))
      } catch { resolve(dataUrl) }
    }
    img.onerror = () => resolve(dataUrl)
    img.src = dataUrl
  })
}

export default function IdentityGateModal() {
  const pending       = useGameStore((s) => s.identityGatePending)
  const closeGate     = useGameStore((s) => s.closeIdentityGate)
  const joinRoom      = useGameStore((s) => s.joinRoom)
  const createRoom    = useGameStore((s) => s.createRoom)
  const addToast      = useGameStore((s) => s.addToast)

  const [exiting,    setExiting]    = useState(false)
  const [username,   setUsername]   = useState('')
  const [avatarUrl,  setAvatarUrl]  = useState('')
  const [checking,   setChecking]   = useState(false)
  const [available,  setAvailable]  = useState(null)
  const [checkError, setCheckError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const fileRef = useRef(null)

  const profile = getProfile()
  const address = myAddress()

  const debouncedUsername = useDebounce(username, 500)

  // Reset state whenever modal opens
  useEffect(() => {
    if (pending) {
      setExiting(false)
      setUsername('')
      setAvatarUrl(profile.avatarUrl || '')
      setAvailable(null)
      setCheckError('')
      setSubmitting(false)
    }
  }, [!!pending])

  // Real-time availability check
  useEffect(() => {
    if (!debouncedUsername || debouncedUsername.trim().length < 5) {
      setAvailable(null)
      setCheckError('')
      return
    }
    let cancelled = false
    setChecking(true)
    setAvailable(null)
    checkUsername(debouncedUsername).then((res) => {
      if (cancelled) return
      setChecking(false)
      setAvailable(res.available)
      setCheckError(res.error || '')
    })
    return () => { cancelled = true }
  }, [debouncedUsername])

  if (!pending) return null

  const dismiss = () => {
    setExiting(true)
    setTimeout(() => closeGate(), 220)
  }

  const handleFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { addToast('Pick an image file', 'error'); return }
    if (file.size > 2 * 1024 * 1024)  { addToast('Image too large (max 2 MB)', 'error'); return }
    const reader = new FileReader()
    reader.onload = () => {
      downscaleImage(String(reader.result || ''), 256).then(setAvatarUrl)
    }
    reader.readAsDataURL(file)
  }

  const nameLen  = username.trim().length
  const canClaim = nameLen >= 5 && available === true && !submitting

  const handleClaim = async () => {
    if (!canClaim || !address) return
    setSubmitting(true)
    try {
      await claimIdentity(address, username, avatarUrl, profile.color)
      applyServerProfile({ username: username.trim(), avatarUrl, color: profile.color })
      addToast('Identity claimed — welcome to the jury!', 'success')

      // Close gate then fire the original pending action
      const snap = pending
      closeGate()
      if (snap.action === 'join')   joinRoom(...snap.args)
      if (snap.action === 'create') createRoom(...snap.args)
    } catch (err) {
      addToast(err.message || 'Could not claim identity.', 'error')
      setSubmitting(false)
    }
  }

  const actionLabel = pending.action === 'create' ? 'create a room' : 'join a room'

  return (
    <div
      className={`fixed inset-0 z-[80] flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0 transition-opacity duration-200 ${
        exiting ? 'opacity-0' : 'animate-fade-in'
      }`}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={dismiss} />

      {/* Panel */}
      <div className="relative w-full max-w-md shadow-[0_0_80px_rgba(162,89,255,0.18)]">
        <div className="glass-strong rounded-2xl border border-plasma/30 overflow-hidden">
          {/* Top accent */}
          <div className="h-px bg-gradient-to-r from-transparent via-plasma/60 to-transparent" />

          <div className="p-6">
            {/* Header */}
            <div className="flex items-start justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-plasma/12 border border-plasma/25 flex items-center justify-center text-plasma flex-shrink-0">
                  <Fingerprint className="w-5 h-5" strokeWidth={1.75} />
                </div>
                <div>
                  <h2 className="font-display font-bold text-base text-white leading-tight">
                    Claim your identity first
                  </h2>
                  <p className="text-white/40 text-xs mt-0.5">
                    Required to {actionLabel}
                  </p>
                </div>
              </div>
              <button
                onClick={dismiss}
                className="w-7 h-7 rounded-lg bg-white/[0.05] border border-white/[0.08] text-white/30 hover:text-white transition-all flex items-center justify-center flex-shrink-0 mt-0.5"
              >
                <X className="w-3.5 h-3.5" strokeWidth={2.5} />
              </button>
            </div>

            {/* Trust pills */}
            <div className="flex gap-2 mb-5">
              {[
                { icon: Lock,   label: 'Permanent' },
                { icon: Shield, label: 'Unique'    },
                { icon: Zap,    label: 'On-chain'  },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="flex-1 rounded-lg border border-white/[0.07] bg-white/[0.025] px-2 py-1.5 flex items-center justify-center gap-1.5">
                  <Icon className="w-3 h-3 text-plasma" strokeWidth={2} />
                  <span className="text-[10px] font-mono text-white/50">{label}</span>
                </div>
              ))}
            </div>

            {/* Avatar + name form */}
            <div className="flex gap-4 items-start mb-4">
              {/* Avatar */}
              <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                <div
                  className="w-[72px] h-[72px] rounded-xl overflow-hidden border-2 border-plasma/25 bg-white/[0.04] cursor-pointer hover:border-plasma/50 transition-all"
                  onClick={() => fileRef.current?.click()}
                  title="Upload avatar"
                >
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                  ) : (
                    <Avatar name={username || 'Player'} color={profile.color} size={72} />
                  )}
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="px-2 py-1 rounded-md border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.07] text-white/50 text-[10px] inline-flex items-center gap-1 transition-all"
                  >
                    <ImageIcon className="w-2.5 h-2.5" />
                    {avatarUrl ? 'Change' : 'Photo'}
                  </button>
                  {avatarUrl && (
                    <button
                      type="button"
                      onClick={() => setAvatarUrl('')}
                      className="p-1 rounded-md border border-white/[0.07] bg-white/[0.02] hover:bg-red-500/10 text-white/30 hover:text-red-400 transition-all"
                    >
                      <Trash2 className="w-2.5 h-2.5" />
                    </button>
                  )}
                </div>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
              </div>

              {/* Username input */}
              <div className="flex-1 min-w-0">
                <label className="text-white/40 text-[10px] font-mono uppercase tracking-wider block mb-1.5">
                  Player name
                </label>
                <div className="relative">
                  <input
                    className={`input pr-9 text-sm transition-all ${
                      available === true
                        ? 'border-neon/40 focus:border-neon/60'
                        : available === false
                        ? 'border-crimson/40 focus:border-crimson/60'
                        : ''
                    }`}
                    maxLength={24}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. DarkJuror"
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck="false"
                    autoFocus
                  />
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                    {checking ? (
                      <Loader2 className="w-3.5 h-3.5 text-white/30 animate-spin" />
                    ) : available === true ? (
                      <Check className="w-3.5 h-3.5 text-neon" strokeWidth={2.5} />
                    ) : available === false ? (
                      <AlertCircle className="w-3.5 h-3.5 text-crimson" strokeWidth={2} />
                    ) : null}
                  </div>
                </div>

                {/* Status line */}
                <div className="mt-1.5 min-h-[16px]">
                  {checkError ? (
                    <p className="text-crimson text-[11px] flex items-center gap-1">
                      <AlertCircle className="w-2.5 h-2.5 flex-shrink-0" />{checkError}
                    </p>
                  ) : available === true ? (
                    <p className="text-neon text-[11px] flex items-center gap-1">
                      <Check className="w-2.5 h-2.5 flex-shrink-0" />Name is available
                    </p>
                  ) : available === false ? (
                    <p className="text-crimson text-[11px] flex items-center gap-1">
                      <AlertCircle className="w-2.5 h-2.5 flex-shrink-0" />Already taken
                    </p>
                  ) : nameLen > 0 && nameLen < 5 ? (
                    <p className="text-white/30 text-[11px]">{5 - nameLen} more character{5 - nameLen !== 1 ? 's' : ''} needed</p>
                  ) : (
                    <p className="text-white/25 text-[11px]">Min 5 chars · Letters, numbers, _ -</p>
                  )}
                </div>
              </div>
            </div>

            {/* Claim button */}
            <button
              onClick={handleClaim}
              disabled={!canClaim}
              className={`w-full py-2.5 rounded-xl font-display font-bold text-sm inline-flex items-center justify-center gap-2 transition-all mb-3 ${
                canClaim
                  ? 'bg-gradient-to-r from-plasma to-neon text-void hover:opacity-90 shadow-[0_0_20px_rgba(162,89,255,0.3)]'
                  : 'bg-white/[0.06] text-white/25 cursor-not-allowed'
              }`}
            >
              {submitting ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Claiming…</>
              ) : (
                <><Fingerprint className="w-4 h-4" />Claim &amp; {pending.action === 'create' ? 'Create Room' : 'Join Room'}</>
              )}
            </button>

            <p className="text-center text-white/20 text-[10px] leading-relaxed">
              <Lock className="w-2.5 h-2.5 inline mr-1 -mt-px" />
              Permanently linked to your wallet · Cannot be changed later
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
