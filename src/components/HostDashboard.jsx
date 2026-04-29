import React, { useState } from 'react'
import useGameStore from '../lib/store'
import { formatGen, getChainNativeSymbol } from '../lib/genlayer'

// ──────────────────────────────────────────────────────────────────────────────
// HostDashboard
//
// A LOBBY-only admin panel that surfaces every host-only setter in the
// contract behind a single collapsible card. Mounted from LobbyPage and
// rendered only when the connected wallet matches the room's `host`.
//
// All actions delegate to the store (`setEntryFee`, `setMaxRounds`,
// `setMaxPlayers`, `kickPlayer`, `transferHost`, `resetToLobby`). Every
// store action surfaces a toast on failure and re-polls on success, so this
// component stays purely presentational.
// ──────────────────────────────────────────────────────────────────────────────
export default function HostDashboard() {
  const players      = useGameStore(s => s.players)
  const myId         = useGameStore(s => s.myId)
  const phase        = useGameStore(s => s.phase)
  const entryFeeWei  = useGameStore(s => s.entryFeeWei)
  const maxRounds    = useGameStore(s => s.maxRounds)
  const maxPlayers   = useGameStore(s => s.maxPlayers)
  const hostAddress  = useGameStore(s => s.hostAddress)

  const setEntryFee   = useGameStore(s => s.setEntryFee)
  const setMaxRounds  = useGameStore(s => s.setMaxRounds)
  const setMaxPlayers = useGameStore(s => s.setMaxPlayers)
  const kickPlayer    = useGameStore(s => s.kickPlayer)
  const transferHost  = useGameStore(s => s.transferHost)
  const resetToLobby  = useGameStore(s => s.resetToLobby)

  const [open, setOpen] = useState(false)
  const symbol = getChainNativeSymbol()

  const noPlayersJoined = players.length === 0
  const inLobby = phase === 'lobby'

  // Inputs (controlled). We default each input to the current on-chain value
  // so the host can see what they're about to overwrite.
  const [feeInput,     setFeeInput]     = useState('')
  const [roundsInput,  setRoundsInput]  = useState('')
  const [playersInput, setPlayersInput] = useState('')
  const [hostInput,    setHostInput]    = useState('')
  const [confirmReset, setConfirmReset] = useState(false)

  // Other players the host could kick or hand off to (excludes self).
  const otherPlayers = players.filter(p => p.id !== myId)

  return (
    <div className="card border-plasma/30">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between text-left"
      >
        <span className="font-display font-700 text-white flex items-center gap-2">
          ⚙️ Host Dashboard
          <span className="badge bg-plasma/15 text-plasma border border-plasma/30 text-[10px]">
            HOST ONLY
          </span>
        </span>
        <span className="text-white/40 text-sm">{open ? '▾' : '▸'}</span>
      </button>

      {open && (
        <div className="mt-5 space-y-6">
          {/* ── Game settings ─────────────────────────────────────────── */}
          <Section title="Game settings" subtitle="Locked once any player has joined.">
            <Field
              label="Entry fee"
              hint={`Currently ${formatGen(entryFeeWei, 6)} ${symbol}`}
            >
              <input
                type="text"
                inputMode="decimal"
                placeholder="e.g. 0.1"
                value={feeInput}
                onChange={e => setFeeInput(e.target.value)}
                className="input flex-1"
                disabled={!noPlayersJoined || !inLobby}
              />
              <button
                type="button"
                onClick={() => { setEntryFee(feeInput); setFeeInput('') }}
                disabled={!noPlayersJoined || !inLobby || !feeInput}
                className="btn btn-ghost text-sm px-4"
              >
                Save
              </button>
            </Field>

            <Field
              label="Max rounds"
              hint={`Currently ${maxRounds} (1–50)`}
            >
              <input
                type="number"
                min="1"
                max="50"
                placeholder={String(maxRounds)}
                value={roundsInput}
                onChange={e => setRoundsInput(e.target.value)}
                className="input flex-1"
                disabled={!noPlayersJoined || !inLobby}
              />
              <button
                type="button"
                onClick={() => { setMaxRounds(roundsInput); setRoundsInput('') }}
                disabled={!noPlayersJoined || !inLobby || !roundsInput}
                className="btn btn-ghost text-sm px-4"
              >
                Save
              </button>
            </Field>

            <Field
              label="Max players"
              hint={`Currently ${maxPlayers} (2–12, must be ≥ ${players.length} joined)`}
            >
              <input
                type="number"
                min="2"
                max="12"
                placeholder={String(maxPlayers)}
                value={playersInput}
                onChange={e => setPlayersInput(e.target.value)}
                className="input flex-1"
                disabled={!inLobby}
              />
              <button
                type="button"
                onClick={() => { setMaxPlayers(playersInput); setPlayersInput('') }}
                disabled={!inLobby || !playersInput}
                className="btn btn-ghost text-sm px-4"
              >
                Save
              </button>
            </Field>

            {!noPlayersJoined && inLobby && (
              <p className="text-white/40 text-xs leading-relaxed">
                Entry fee and max rounds are locked because players have already
                paid the current fee. Use <span className="font-mono text-plasma">Reset to lobby</span>{' '}
                below if you need to refund everyone and start over.
              </p>
            )}
            {!inLobby && (
              <p className="text-white/40 text-xs leading-relaxed">
                Game is in progress — settings can only be changed from LOBBY.
              </p>
            )}
          </Section>

          {/* ── Player management ─────────────────────────────────────── */}
          <Section
            title="Player management"
            subtitle="Kicked players are refunded their entry fee in full."
          >
            {otherPlayers.length === 0 ? (
              <p className="text-white/40 text-xs">
                No other players are in the lobby yet.
              </p>
            ) : (
              <div className="space-y-2">
                {otherPlayers.map(p => (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 p-2 rounded-xl bg-white/[0.03] border border-white/[0.06]"
                  >
                    <div
                      className="avatar text-base"
                      style={{ background: p.color + '22', color: p.color }}
                    >
                      {p.avatar}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-white truncate">{p.name}</div>
                      <div className="text-white/30 text-[10px] font-mono truncate">{p.id}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => kickPlayer(p.id)}
                      disabled={!inLobby}
                      className="btn btn-ghost text-xs px-3 text-red-400 border-red-400/30 hover:bg-red-400/10"
                    >
                      Kick
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* ── Transfer host ─────────────────────────────────────────── */}
          <Section
            title="Transfer host role"
            subtitle="Hand off room admin rights. Only allowed in LOBBY."
          >
            <Field
              label="New host address"
              hint={hostAddress ? `Current host: ${hostAddress.slice(0, 6)}…${hostAddress.slice(-4)}` : ''}
            >
              <input
                type="text"
                placeholder="0x…"
                value={hostInput}
                onChange={e => setHostInput(e.target.value)}
                className="input flex-1 font-mono text-xs"
                disabled={!inLobby}
              />
              <button
                type="button"
                onClick={() => { transferHost(hostInput); setHostInput('') }}
                disabled={!inLobby || !hostInput}
                className="btn btn-ghost text-sm px-4"
              >
                Transfer
              </button>
            </Field>
            <p className="text-white/30 text-[11px] leading-relaxed">
              Once you transfer, you'll lose access to this dashboard until the
              role is handed back.
            </p>
          </Section>

          {/* ── Danger zone ───────────────────────────────────────────── */}
          <Section
            title="Danger zone"
            subtitle="Resetting wipes the player roster — joined players are NOT refunded."
            tone="danger"
          >
            {!confirmReset ? (
              <button
                type="button"
                onClick={() => setConfirmReset(true)}
                className="btn btn-ghost text-sm w-full text-red-400 border-red-400/30 hover:bg-red-400/10"
              >
                Reset to lobby…
              </button>
            ) : (
              <div className="space-y-2">
                <p className="text-red-400/90 text-xs leading-relaxed">
                  This will wipe all joined players. Use this only after a
                  finished game, or if you're certain the lobby is abandoned.
                  Any unclaimed platform fees are auto-swept on reset.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { resetToLobby(); setConfirmReset(false) }}
                    className="btn flex-1 text-sm bg-red-500/20 text-red-300 border border-red-500/40 hover:bg-red-500/30"
                  >
                    Yes, reset
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmReset(false)}
                    className="btn btn-ghost flex-1 text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </Section>
        </div>
      )}
    </div>
  )
}

function Section({ title, subtitle, tone, children }) {
  const accent = tone === 'danger' ? 'text-red-300' : 'text-white/80'
  return (
    <div className="space-y-3">
      <div>
        <div className={`font-display font-600 text-sm ${accent}`}>{title}</div>
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
