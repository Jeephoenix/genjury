import React, { useState } from 'react'
import { Banknote, ChevronDown, ChevronRight } from 'lucide-react'
import useGameStore from '../lib/store'
import { formatGen, getChainNativeSymbol } from '../lib/genlayer'

// ──────────────────────────────────────────────────────────────────────────────
// PlatformOwnerPanel
//
// A LOBBY-only admin panel for the wallet that matches the room's
// `platform_owner` (the dev / fee recipient). Mirrors HostDashboard but
// gates on `myId === houseAddress` instead of `isHost`. Surfaces the three
// platform-owner-only methods on the contract:
//
//   * claim_platform_fees()   — sweep accumulated fees to your wallet
//   * set_platform_fee_bps()  — change the cut taken from each entry fee
//   * set_platform_owner()    — hand the recipient role to a new wallet
//
// All actions delegate to store actions which surface toasts on failure
// and re-poll on success.
// ──────────────────────────────────────────────────────────────────────────────
export default function PlatformOwnerPanel() {
  const phase                   = useGameStore(s => s.phase)
  const players                 = useGameStore(s => s.players)
  const houseAddress            = useGameStore(s => s.houseAddress)
  const houseCutBps             = useGameStore(s => s.houseCutBps)
  const houseFeesCollectedWei   = useGameStore(s => s.houseFeesCollectedWei)

  const setPlatformFeeBps  = useGameStore(s => s.setPlatformFeeBps)
  const setPlatformOwner   = useGameStore(s => s.setPlatformOwner)
  const claimPlatformFees  = useGameStore(s => s.claimPlatformFees)

  const [open, setOpen]   = useState(false)
  const [feeInput,   setFeeInput]   = useState('')
  const [ownerInput, setOwnerInput] = useState('')

  const symbol         = getChainNativeSymbol()
  const noPlayersJoined = players.length === 0
  const inLobby         = phase === 'lobby'
  const canChangeFee    = noPlayersJoined && inLobby
  const hasFeesToClaim  = houseFeesCollectedWei > 0n
  const currentPctStr   = (houseCutBps / 100).toFixed(2)

  return (
    <div className="card border-gold/30">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between text-left"
      >
        <span className="font-display font-700 text-white flex items-center gap-2">
          <Banknote className="w-4 h-4 text-gold" /> Platform Owner
          <span className="badge bg-gold/15 text-gold border border-gold/30 text-[10px]">
            DEV ONLY
          </span>
        </span>
        {open
          ? <ChevronDown className="w-4 h-4 text-white/40" />
          : <ChevronRight className="w-4 h-4 text-white/40" />}
      </button>

      {open && (
        <div className="mt-5 space-y-6">
          {/* ── Pending balance + claim ──────────────────────────────── */}
          <Section
            title="Accumulated fees"
            subtitle="Auto-swept on any room reset; or claim manually any time."
          >
            <div className="flex items-center justify-between p-3 rounded-xl bg-gold/[0.06] border border-gold/20">
              <div>
                <div className="text-white/50 text-[10px] font-mono uppercase tracking-wider">
                  Pending
                </div>
                <div className="text-gold font-display font-700 text-lg">
                  {formatGen(houseFeesCollectedWei, 6)} {symbol}
                </div>
              </div>
              <button
                type="button"
                onClick={claimPlatformFees}
                disabled={!hasFeesToClaim}
                className="btn btn-ghost text-sm px-4 text-gold border-gold/30 hover:bg-gold/10"
              >
                Claim now
              </button>
            </div>
          </Section>

          {/* ── Fee rate ─────────────────────────────────────────────── */}
          <Section
            title="Platform fee rate"
            subtitle="Capped at 20% by the contract. Locked once any player joins."
          >
            <Field
              label="Fee percent"
              hint={`Currently ${currentPctStr}% (${houseCutBps} bps)`}
            >
              <input
                type="number"
                min="0"
                max="20"
                step="0.01"
                placeholder={currentPctStr}
                value={feeInput}
                onChange={e => setFeeInput(e.target.value)}
                className="input flex-1"
                disabled={!canChangeFee}
              />
              <span className="text-white/50 text-sm">%</span>
              <button
                type="button"
                onClick={() => { setPlatformFeeBps(feeInput); setFeeInput('') }}
                disabled={!canChangeFee || feeInput === ''}
                className="btn btn-ghost text-sm px-4"
              >
                Save
              </button>
            </Field>
            {!canChangeFee && (
              <p className="text-white/40 text-xs leading-relaxed">
                {!inLobby
                  ? 'Game is in progress — fee rate can only be changed from LOBBY.'
                  : 'Players have already paid the current fee. Reset the room first to change the rate.'}
              </p>
            )}
          </Section>

          {/* ── Transfer ownership ───────────────────────────────────── */}
          <Section
            title="Transfer ownership"
            subtitle="Hands the recipient role to another wallet. Pending fees are auto-swept to you first."
          >
            <Field
              label="New owner address"
              hint={houseAddress ? `Current: ${houseAddress.slice(0, 6)}…${houseAddress.slice(-4)}` : ''}
            >
              <input
                type="text"
                placeholder="0x…"
                value={ownerInput}
                onChange={e => setOwnerInput(e.target.value)}
                className="input flex-1 font-mono text-xs"
              />
              <button
                type="button"
                onClick={() => { setPlatformOwner(ownerInput); setOwnerInput('') }}
                disabled={!ownerInput}
                className="btn btn-ghost text-sm px-4"
              >
                Transfer
              </button>
            </Field>
            <p className="text-white/30 text-[11px] leading-relaxed">
              After transfer, future fees will route to the new wallet and you
              will lose access to this panel.
            </p>
          </Section>
        </div>
      )}
    </div>
  )
}

function Section({ title, subtitle, children }) {
  return (
    <div className="space-y-3">
      <div>
        <div className="font-display font-600 text-sm text-white/80">{title}</div>
        {subtitle && (
          <div className="text-white/30 text-[11px] mt-0.5 leading-relaxed">{subtitle}</div>
        )}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function Field({ label, hint, children }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <label className="text-white/60 text-xs font-mono uppercase tracking-wider">
          {label}
        </label>
        {hint && (
          <span className="text-white/30 text-[10px] font-mono">{hint}</span>
        )}
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  )
}
