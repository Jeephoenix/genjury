import React, { useEffect, useState, useCallback } from 'react'
import { Copy, LogOut, Wallet as WalletIcon, X, ExternalLink, RefreshCw, ChevronRight } from 'lucide-react'
import {
  myAddress,
  isWalletConnected,
  hasInjectedProvider,
  connectInjectedWallet,
  disconnectInjectedWallet,
  subscribeWallet,
  getNetworkInfo,
  getChainNativeSymbol,
  getGenBalanceWei,
  formatGen,
} from '../lib/genlayer'
import useGameStore from '../lib/store'

const short = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '')

export default function WalletPanel() {
  const open    = useGameStore((s) => s.walletPanelOpen)
  const setOpen = useGameStore((s) => s.setWalletPanelOpen)
  const [, force]      = useState(0)
  const [balanceWei, setBalanceWei] = useState(null)
  const [connecting, setConnecting] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const net       = getNetworkInfo()
  const symbol    = getChainNativeSymbol()
  const addToast  = useGameStore((s) => s.addToast)
  const resetGame = useGameStore((s) => s.resetGame)

  useEffect(() => subscribeWallet(() => force((n) => n + 1)), [])

  const connected = isWalletConnected()
  const address   = myAddress()
  const hasInj    = hasInjectedProvider()

  const refreshBalance = useCallback(async () => {
    if (!address) return
    setRefreshing(true)
    try {
      const wei = await getGenBalanceWei(address)
      setBalanceWei(wei)
    } catch {
      setBalanceWei(null)
    } finally {
      setRefreshing(false)
    }
  }, [address])

  useEffect(() => {
    setBalanceWei(null)
    if (open && address) refreshBalance()
  }, [open, address, refreshBalance])

  const copy = (text, label = 'Copied') => {
    if (!text) return
    try {
      navigator.clipboard?.writeText(text)
      addToast(label, 'success')
    } catch {
      addToast('Copy failed', 'error')
    }
  }

  const handleConnect = async () => {
    if (!hasInj) {
      addToast('No Web3 wallet detected. Install MetaMask first.', 'error')
      return
    }
    setConnecting(true)
    try {
      const addr = await connectInjectedWallet()
      addToast(`Connected ${short(addr)}`, 'success')
    } catch (e) {
      addToast(e?.shortMessage || e?.message || 'Could not connect wallet', 'error')
    } finally {
      setConnecting(false)
    }
  }

  const handleDisconnect = () => {
    if (!confirm('Disconnect your wallet? Any active game session will end.')) return
    resetGame()
    disconnectInjectedWallet()
    addToast('Wallet disconnected', 'info')
  }

  if (!open) return null

  return (
    /* Full-screen overlay */
    <div
      className="fixed inset-0 z-[70] modal-overlay"
      onClick={() => setOpen(false)}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/75 backdrop-blur-md" />

      {/*
        Positioning wrapper:
          Mobile  → anchored to bottom edge (bottom sheet)
          Desktop → centred in viewport (card modal)
      */}
      <div className="absolute inset-x-0 bottom-0 md:inset-0 md:flex md:items-center md:justify-center md:px-4">

        {/* Panel */}
        <div
          className="sheet-panel relative w-full md:max-w-md"
          onClick={(e) => e.stopPropagation()}
        >
          {/* ── Drag handle (mobile only) ── */}
          <div className="md:hidden flex justify-center pt-3 pb-0 relative z-10">
            <div className="w-10 h-1 rounded-full bg-white/25" />
          </div>

          {/* ── Inner card ── */}
          <div className="glass-strong rounded-t-3xl md:rounded-2xl border-t border-x md:border border-white/[0.1] overflow-hidden max-h-[88vh] overflow-y-auto">

            {/* Top accent line */}
            <div className="h-px bg-gradient-to-r from-transparent via-plasma/60 to-transparent" />

            <div className="p-6 space-y-5">

              {/* Header row */}
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2.5 mb-1">
                    <div className="w-8 h-8 rounded-xl bg-plasma/15 border border-plasma/25 flex items-center justify-center">
                      <WalletIcon className="w-4 h-4 text-plasma" strokeWidth={2.25} />
                    </div>
                    <h2 className="font-display font-bold text-xl text-white tracking-tight">Wallet</h2>
                  </div>
                  <p className="text-white/40 text-xs leading-relaxed pl-10">
                    {connected
                      ? `Connected to ${net.label}`
                      : `Connect a Web3 wallet to play on ${net.label}.`}
                  </p>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="w-8 h-8 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white/40 hover:text-white hover:bg-white/10 transition-all flex items-center justify-center flex-shrink-0"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" strokeWidth={2.25} />
                </button>
              </div>

              {connected ? (
                <>
                  {/* Network row */}
                  <div className="rounded-xl bg-white/[0.04] border border-white/[0.08] px-3.5 py-3 flex items-center gap-3">
                    <div className="relative">
                      <div className="w-2.5 h-2.5 rounded-full bg-neon" />
                      <div className="absolute inset-0 rounded-full bg-neon animate-ping opacity-40" />
                    </div>
                    <div>
                      <p className="text-[10px] font-mono uppercase tracking-widest text-white/35 mb-0.5">Network</p>
                      <p className="text-white text-sm font-medium">{net.label}</p>
                    </div>
                    <div className="ml-auto">
                      <span className="badge bg-neon/10 border border-neon/25 text-neon text-[10px]">LIVE</span>
                    </div>
                  </div>

                  {/* Address */}
                  <div>
                    <p className="text-[10px] font-mono uppercase tracking-widest text-white/35 mb-2 px-0.5">Address</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 rounded-xl bg-white/[0.04] border border-white/[0.08] px-3.5 py-3 font-mono text-xs text-white/75 break-all leading-relaxed">
                        {address}
                      </code>
                      <button
                        className="w-11 h-11 rounded-xl border border-white/[0.08] bg-white/[0.04] hover:bg-white/10 text-white/50 hover:text-white transition-all flex items-center justify-center flex-shrink-0"
                        onClick={() => copy(address, 'Address copied')}
                        aria-label="Copy address"
                      >
                        <Copy className="w-4 h-4" strokeWidth={2.25} />
                      </button>
                    </div>
                  </div>

                  {/* Balance */}
                  <div className="rounded-xl bg-gradient-to-br from-plasma/10 via-white/[0.03] to-transparent border border-plasma/20 px-4 py-4 relative overflow-hidden">
                    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-plasma/40 to-transparent" />
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[10px] font-mono uppercase tracking-widest text-white/35">Balance</p>
                      <button
                        onClick={refreshBalance}
                        className="text-white/30 hover:text-white/60 transition-colors"
                        aria-label="Refresh balance"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} strokeWidth={2.25} />
                      </button>
                    </div>
                    <div className="flex items-baseline gap-2.5">
                      <span className="font-display font-bold text-3xl text-white tabular-nums">
                        {balanceWei !== null ? formatGen(balanceWei, 4) : '—'}
                      </span>
                      <span className="text-white/40 text-sm font-mono">{symbol}</span>
                    </div>
                  </div>

                  {/* Explorer link */}
                  {net.explorer && (
                    <a
                      href={`${net.explorer}/address/${address}`}
                      target="_blank"
                      rel="noopener"
                      className="flex items-center justify-between px-3.5 py-3 rounded-xl bg-white/[0.03] border border-white/[0.07] text-white/45 hover:text-white/70 hover:bg-white/[0.05] transition-all group"
                    >
                      <span className="text-xs font-mono">View on Explorer</span>
                      <ExternalLink className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" strokeWidth={2.25} />
                    </a>
                  )}

                  <div className="h-px bg-white/[0.06]" />

                  {/* Disconnect */}
                  <button
                    className="w-full py-3 rounded-xl border border-signal/30 bg-signal/8 text-signal text-sm font-semibold hover:bg-signal/15 hover:border-signal/50 transition-all inline-flex items-center justify-center gap-2"
                    onClick={handleDisconnect}
                  >
                    <LogOut className="w-4 h-4" strokeWidth={2.25} />
                    Disconnect Wallet
                  </button>

                  {/* Safe-area spacer for phones with a home bar */}
                  <div className="md:hidden h-[env(safe-area-inset-bottom,0px)]" />
                </>
              ) : (
                <>
                  {/* Not-connected info */}
                  <div className="rounded-xl bg-white/[0.03] border border-white/[0.08] px-4 py-4 text-sm text-white/55 text-center leading-relaxed">
                    Genjury runs on{' '}
                    <span className="text-white/80 font-medium">{net.label}</span>.
                    <br />Connect a Web3 wallet to play.
                  </div>

                  {/* Connect button */}
                  <button
                    className="btn-connect"
                    onClick={handleConnect}
                    disabled={!hasInj || connecting}
                  >
                    {connecting ? (
                      <>
                        <div className="orbit-loader w-5 h-5 border-t-plasma" />
                        Connecting…
                      </>
                    ) : (
                      <>
                        <WalletIcon className="w-4.5 h-4.5" strokeWidth={2.25} />
                        {hasInj ? 'Connect Wallet' : 'No wallet detected'}
                        {hasInj && <ChevronRight className="w-4 h-4 ml-auto opacity-50" strokeWidth={2.5} />}
                      </>
                    )}
                  </button>

                  {!hasInj && (
                    <div className="text-center space-y-2">
                      <p className="text-white/35 text-xs">
                        Install a Web3 wallet to get started
                      </p>
                      <a
                        href="https://metamask.io"
                        target="_blank"
                        rel="noopener"
                        className="inline-flex items-center gap-1.5 text-plasma/70 hover:text-plasma text-xs transition-colors"
                      >
                        Get MetaMask <ExternalLink className="w-3 h-3" strokeWidth={2.25} />
                      </a>
                    </div>
                  )}

                  {hasInj && (
                    <p className="text-white/25 text-xs text-center font-mono">
                      EIP-1193 compatible · {symbol} required for play
                    </p>
                  )}

                  {/* Safe-area spacer for phones with a home bar */}
                  <div className="md:hidden h-[env(safe-area-inset-bottom,0px)]" />
                </>
              )}
            </div>

            {/* Bottom accent */}
            <div className="h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
          </div>
        </div>
      </div>
    </div>
  )
}
