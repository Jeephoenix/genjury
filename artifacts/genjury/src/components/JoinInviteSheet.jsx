import React, { useEffect, useRef, useState } from 'react'
  import {
    UserPlus, Wallet, Zap, X, Users, Coins, Lock,
    Check, Pencil, ArrowRight,
  } from 'lucide-react'
  import useGameStore from '../lib/store'
  import Avatar from './Avatar'
  import {
    isWalletConnected, subscribeWallet, hasContractAddress,
    readContractView, getChainNativeSymbol, formatGen,
    isValidRoomCode,
  } from '../lib/genlayer'
  import { getProfile, setProfile, subscribeProfile } from '../lib/profile'

  // ──────────────────────────────────────────────────────────────────────────────
  // JoinInviteSheet
  //
  // A slide-up bottom-sheet shown whenever a user arrives via an invite link
  // (?join=CODE). It:
  //  1. Shows the room code and live preview (player count, entry fee, phase).
  //  2. Pre-fills the player's display name — editable inline before joining.
  //  3. Saves the name to localStorage if changed, so it sticks across sessions.
  //  4. Connects the wallet if needed, then lets the user join with one tap.
  //
  // Props:
  //   code      — the 6-char room code (already normalised + validated)
  //   onDismiss — called when the sheet is closed without joining
  // ──────────────────────────────────────────────────────────────────────────────
  export default function JoinInviteSheet({ code, onDismiss }) {
    const joinRoom      = useGameStore((s) => s.joinRoom)
    const setOpenWallet = useGameStore((s) => s.setWalletPanelOpen)
    const loading       = useGameStore((s) => s.loading)

    const [, forceUpdate] = useState(0)
    useEffect(() => subscribeWallet(()  => forceUpdate((n) => n + 1)), [])
    useEffect(() => subscribeProfile(() => forceUpdate((n) => n + 1)), [])

    const connected = isWalletConnected()
    const profile   = getProfile()

    // Editable name — seeded from the player's current profile name.
    const [name,       setName]       = useState(profile.name)
    const [nameSaved,  setNameSaved]  = useState(false)
    const [nameEditing, setNameEditing] = useState(false)
    const nameRef = useRef(null)

    // Live room preview fetched from the contract.
    const [preview,     setPreview]    = useState(null)   // null = loading, false = error
    const [previewDone, setPreviewDone] = useState(false)
    const symbol = getChainNativeSymbol()

    useEffect(() => {
      if (!hasContractAddress() || !isValidRoomCode(code)) {
        setPreview(false)
        setPreviewDone(true)
        return
      }
      let cancelled = false
      ;(async () => {
        try {
          const raw    = await readContractView('get_room_state', [code])
          const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
          if (cancelled) return
          if (parsed?.roomCode) {
            setPreview({
              hostName:    parsed.hostName    || '',
              phase:       parsed.phase       || 'lobby',
              playerCount: Number(parsed.playerCount || 0),
              maxPlayers:  Number(parsed.maxPlayers  || 8),
              entryFee:    BigInt(parsed.entryFee     || '0'),
            })
          } else {
            setPreview(false)
          }
        } catch {
          if (!cancelled) setPreview(false)
        } finally {
          if (!cancelled) setPreviewDone(true)
        }
      })()
      return () => { cancelled = true }
    }, [code])

    const handleSaveName = () => {
      const trimmed = name.trim().slice(0, 24)
      if (!trimmed) return
      setProfile({ name: trimmed })
      setName(trimmed)
      setNameEditing(false)
      setNameSaved(true)
      setTimeout(() => setNameSaved(false), 1800)
    }

    const handleJoin = () => {
      if (!connected) { setOpenWallet(true); return }
      if (loading) return
      const trimmed = name.trim().slice(0, 24)
      if (trimmed && trimmed !== profile.name) setProfile({ name: trimmed })
      joinRoom(code, trimmed || profile.name)
    }

    const isPaid      = !!preview && preview.entryFee > 0n
    const isLobby     = !preview || preview.phase === 'lobby'
    const isFull      = !!preview && preview.playerCount >= preview.maxPlayers
    const cannotJoin  = previewDone && preview === false

    return (
      <>
        {/* Backdrop */}
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm animate-fade-in"
          onClick={onDismiss}
          aria-hidden="true"
        />

        {/* Sheet */}
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Join case ${code}`}
          className="fixed bottom-0 inset-x-0 z-50 animate-slide-up"
        >
          <div className="max-w-lg mx-auto px-3 pb-3">
            <div className="glass rounded-2xl border border-neon/20 shadow-2xl overflow-hidden"
              style={{ boxShadow: '0 -4px 60px rgba(127,255,110,0.08), 0 24px 80px rgba(0,0,0,0.6)' }}
            >
              {/* Top gradient accent */}
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-neon/50 to-transparent" />

              {/* Dismiss handle */}
              <div className="flex justify-center pt-3 pb-0">
                <div className="w-10 h-1 rounded-full bg-white/15" />
              </div>

              <div className="px-5 pt-3 pb-6">
                {/* Header */}
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-neon/10 border border-neon/25 flex items-center justify-center flex-shrink-0">
                      <UserPlus className="w-5 h-5 text-neon" strokeWidth={2} />
                    </div>
                    <div>
                      <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-white/35">You've been invited to</div>
                      <div className="text-white font-display font-bold text-xl leading-tight">
                        Case <span className="text-neon font-mono tracking-widest">{code}</span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={onDismiss}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white/30 hover:text-white/70 hover:bg-white/[0.08] transition-all flex-shrink-0"
                    aria-label="Close"
                  >
                    <X className="w-4 h-4" strokeWidth={2.5} />
                  </button>
                </div>

                {/* Room preview strip */}
                {!previewDone ? (
                  <div className="rounded-xl bg-white/[0.03] border border-white/[0.07] px-4 py-3 mb-4 text-white/35 text-xs font-mono animate-pulse">
                    Loading case details…
                  </div>
                ) : preview === false ? (
                  <div className="rounded-xl bg-signal/[0.07] border border-signal/25 px-4 py-3 mb-4">
                    <p className="text-signal/80 text-xs font-mono">Could not reach this case. It may have ended or the contract is unavailable.</p>
                  </div>
                ) : (
                  <div className="rounded-xl bg-white/[0.03] border border-white/[0.07] px-4 py-3 mb-4 grid grid-cols-3 gap-3 text-center">
                    <PreviewCell label="Status">
                      <span className={`text-xs font-mono font-semibold ${isLobby ? 'text-neon' : 'text-signal/80'}`}>
                        {isLobby ? 'Open · Lobby' : 'In session'}
                      </span>
                    </PreviewCell>
                    <PreviewCell label="Seats">
                      <span className={`text-xs font-mono font-semibold ${isFull ? 'text-signal/80' : 'text-white/85'}`}>
                        <span className="inline-flex items-center gap-1">
                          <Users className="w-3 h-3 text-white/40" />
                          {preview.playerCount}/{preview.maxPlayers}
                        </span>
                      </span>
                    </PreviewCell>
                    <PreviewCell label="Entry fee">
                      <span className={`text-xs font-mono font-semibold ${isPaid ? 'text-gold' : 'text-white/50'}`}>
                        {isPaid ? `${formatGen(preview.entryFee, 4)} ${symbol}` : 'Free'}
                      </span>
                    </PreviewCell>
                  </div>
                )}

                {/* Cannot join warning — only shown when room is truly unreachable */}
                {cannotJoin && (
                  <div className="rounded-xl bg-signal/[0.07] border border-signal/20 px-4 py-3 mb-4 flex items-start gap-2">
                    <Lock className="w-4 h-4 text-signal/70 mt-0.5 flex-shrink-0" strokeWidth={2} />
                    <p className="text-signal/80 text-xs leading-relaxed">
                      This case is unreachable.
                    </p>
                  </div>
                )}

                {/* Name editor */}
                <div className="mb-4">
                  <label className="text-[10px] font-mono uppercase tracking-wider text-white/40 mb-1.5 block">
                    Your name in the courtroom
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Avatar
                        name={name}
                        src={profile.avatarUrl && String(profile.avatarUrl).startsWith('data:') ? profile.avatarUrl : ''}
                        color={profile.color}
                        size={32}
                      />
                      <input
                        ref={nameRef}
                        type="text"
                        value={name}
                        maxLength={24}
                        onChange={(e) => { setName(e.target.value); setNameEditing(true); setNameSaved(false) }}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleSaveName() }}
                        className="input pl-11 pr-9 font-display font-semibold text-sm"
                        placeholder="Choose a name…"
                        autoComplete="nickname"
                      />
                      {nameEditing && name.trim() && (
                        <button
                          onClick={handleSaveName}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-neon/70 hover:text-neon"
                          aria-label="Save name"
                        >
                          <Check className="w-4 h-4" strokeWidth={2.5} />
                        </button>
                      )}
                      {nameSaved && !nameEditing && (
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neon">
                          <Check className="w-4 h-4" strokeWidth={2.5} />
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-white/25 text-[10px] mt-1.5 font-mono">
                    This is how other jurors will see you. You can change it any time in your profile.
                  </p>
                </div>

                {/* CTA */}
                {!connected ? (
                  <div className="space-y-2">
                    <button
                      onClick={() => setOpenWallet(true)}
                      className="btn w-full py-3.5 text-sm font-semibold bg-plasma/15 text-plasma border border-plasma/40 hover:bg-plasma/25 inline-flex items-center justify-center gap-2"
                    >
                      <Wallet className="w-4 h-4" strokeWidth={2.25} />
                      Connect wallet to join
                    </button>
                    <p className="text-white/25 text-xs text-center font-mono">
                      A Web3 wallet is required to take a seat.
                    </p>
                  </div>
                ) : cannotJoin ? (
                  <button
                    onClick={onDismiss}
                    className="btn w-full py-3 text-sm font-semibold btn-ghost inline-flex items-center justify-center gap-2"
                  >
                    <ArrowRight className="w-4 h-4" strokeWidth={2.25} />
                    Back to lobby
                  </button>
                ) : (
                  <button
                    onClick={handleJoin}
                    disabled={loading || !name.trim()}
                    className="btn w-full py-3.5 text-sm font-bold bg-neon/15 text-neon border border-neon/40 hover:bg-neon/25 disabled:opacity-50 inline-flex items-center justify-center gap-2"
                    style={{ boxShadow: '0 0 24px rgba(127,255,110,0.12)' }}
                  >
                    <Zap className="w-4 h-4" strokeWidth={2.5} />
                    {loading
                      ? 'Joining…'
                      : isPaid
                      ? `Take a seat · ${formatGen(preview.entryFee, 4)} ${symbol}`
                      : 'Take a seat — free'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </>
    )
  }

  function PreviewCell({ label, children }) {
    return (
      <div>
        <div className="text-[9px] font-mono uppercase tracking-wider text-white/30 mb-1">{label}</div>
        <div>{children}</div>
      </div>
    )
  }
  