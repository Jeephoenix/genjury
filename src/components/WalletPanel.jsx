import React, { useEffect, useState, useCallback } from 'react'
import {
  Copy, LogOut, Wallet as WalletIcon, X, ExternalLink,
  RefreshCw, ChevronRight, AlertCircle, Zap,
} from 'lucide-react'
import {
  myAddress,
  isWalletConnected,
  hasInjectedProvider,
  disconnectInjectedWallet,
  subscribeWallet,
  getNetworkInfo,
  getNetworkName,
  getChainNativeSymbol,
  getGenBalanceWei,
  formatGen,
  fundAccount,
} from '../lib/genlayer'
import useGameStore from '../lib/store'
import WalletSelectorModal from './WalletSelectorModal'

const short = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '')

export default function WalletPanel() {
  const open    = useGameStore((s) => s.walletPanelOpen)
  const setOpen = useGameStore((s) => s.setWalletPanelOpen)
  const [, force]      = useState(0)
  const [balanceWei, setBalanceWei] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [copied, setCopied]         = useState(false)
  const [showSelector, setShowSelector] = useState(false)
  const [funding, setFunding]           = useState(false)
  const [fundDone, setFundDone]         = useState(false)

  const net         = getNetworkInfo()
  const networkName = getNetworkName()
  const symbol      = getChainNativeSymbol()
  const isDevNet    = networkName === 'studionet' || networkName === 'localnet'
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

  // Reset selector when panel closes
  useEffect(() => {
    if (!open) setShowSelector(false)
  }, [open])

  const copy = (text, label = 'Copied') => {
    if (!text) return
    try {
      navigator.clipboard?.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
      addToast(label, 'success')
    } catch {
      addToast('Copy failed', 'error')
    }
  }

  const handleConnected = (addr) => {
    setShowSelector(false)
    addToast(`Connected ${short(addr)}`, 'success')
    force((n) => n + 1)
  }

  const handleDisconnect = () => {
    resetGame()
    disconnectInjectedWallet()
    addToast('Wallet disconnected', 'info')
  }

  const handleFund = async () => {
    if (!address || funding) return
    setFunding(true)
    setFundDone(false)
    try {
      await fundAccount(address)
      addToast('100 GEN added to your account', 'success')
      setFundDone(true)
      setTimeout(() => setFundDone(false), 3000)
      // Refresh balance after a short delay so the node has time to update
      setTimeout(refreshBalance, 800)
    } catch (e) {
      addToast(e?.message || 'Fund failed', 'error')
    } finally {
      setFunding(false)
    }
  }

  if (!open) return null

  return (
    <>
      <div
        className="fixed inset-0 z-[70] modal-overlay"
        onClick={() => setOpen(false)}
        role="dialog"
        aria-modal="true"
        aria-label="Wallet panel"
      >
        <div className="absolute inset-0 bg-black/75 backdrop-blur-md" />

        <div className="absolute inset-x-0 bottom-0 md:inset-0 md:flex md:items-center md:justify-center md:px-4">
          <div
            className="sheet-panel relative w-full md:max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Mobile drag handle */}
            <div className="md:hidden flex justify-center pt-3 pb-0 relative z-10" aria-hidden="true">
              <div className="w-10 h-1 rounded-full bg-white/25" />
            </div>

            {/* Inner card */}
            <div className="glass-strong rounded-t-3xl md:rounded-2xl border-t border-x md:border border-white/[0.1] overflow-hidden max-h-[88vh] overflow-y-auto">
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
                    aria-label="Close wallet panel"
                  >
                    <X className="w-4 h-4" strokeWidth={2.25} />
                  </button>
                </div>

                {connected ? (
                  <>
                    {/* Network row */}
                    <div className="rounded-xl bg-white/[0.04] border border-white/[0.08] px-3.5 py-3 flex items-center gap-3">
                      <div className="relative flex-shrink-0">
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
                          className={`w-11 h-11 rounded-xl border transition-all flex items-center justify-center flex-shrink-0 ${
                            copied
                              ? 'border-neon/40 bg-neon/10 text-neon'
                              : 'border-white/[0.08] bg-white/[0.04] hover:bg-white/10 text-white/50 hover:text-white'
                          }`}
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
                          className="text-white/30 hover:text-white/65 transition-colors p-0.5 rounded"
                          aria-label="Refresh balance"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} strokeWidth={2.25} />
                        </button>
                      </div>
                      <div className="flex items-baseline gap-2.5">
                        <span className="font-display font-bold text-3xl text-white tnum">
                          {balanceWei !== null ? formatGen(balanceWei, 4) : '—'}
                        </span>
                        <span className="text-white/40 text-sm font-mono">{symbol}</span>
                      </div>

                      {/* Fund / faucet nudge */}
                      {isDevNet ? (
                        /* Studionet / localnet: one-click debug_fundAccount button */
                        <div className="mt-3">
                          <button
                            onClick={handleFund}
                            disabled={funding}
                            aria-busy={funding}
                            className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-200 border ${
                              fundDone
                                ? 'border-neon/40 bg-neon/10 text-neon'
                                : funding
                                ? 'border-plasma/30 bg-plasma/10 text-plasma/60 cursor-wait'
                                : 'border-plasma/25 bg-plasma/[0.08] text-plasma hover:bg-plasma/15 hover:border-plasma/45 active:scale-[0.98]'
                            }`}
                          >
                            {funding ? (
                              <>
                                <div className="w-3.5 h-3.5 rounded-full border-2 border-plasma/30 border-t-plasma animate-spin flex-shrink-0" />
                                Funding…
                              </>
                            ) : fundDone ? (
                              <>
                                <Zap className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={2.25} />
                                100 GEN added!
                              </>
                            ) : (
                              <>
                                <Zap className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={2.25} />
                                Fund 100 GEN
                              </>
                            )}
                          </button>
                          <p className="text-white/20 text-[10px] text-center font-mono mt-1.5">
                            dev only · debug_fundAccount
                          </p>
                        </div>
                      ) : balanceWei !== null && balanceWei < 1n * 10n ** 16n && net.faucet ? (
                        /* Public testnet: link to faucet when balance is low */
                        <div className="mt-3 flex items-center gap-2">
                          <AlertCircle className="w-3.5 h-3.5 text-gold flex-shrink-0" strokeWidth={2.25} />
                          <a
                            href={`${net.faucet}?address=${address}`}
                            target="_blank"
                            rel="noopener"
                            className="text-gold/70 hover:text-gold text-xs transition-colors underline underline-offset-2"
                          >
                            Low balance — get test {symbol} from faucet
                          </a>
                        </div>
                      ) : null}
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

                    {/* Switch wallet */}
                    <button
                      onClick={() => setShowSelector(true)}
                      className="w-full py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.03] text-white/50 text-sm hover:bg-white/[0.07] hover:text-white/80 hover:border-white/15 transition-all inline-flex items-center justify-center gap-2"
                    >
                      <WalletIcon className="w-4 h-4" strokeWidth={2.25} />
                      Switch wallet
                      <ChevronRight className="w-4 h-4 ml-auto opacity-40" strokeWidth={2.25} />
                    </button>

                    {/* Disconnect */}
                    <button
                      className="w-full py-3 rounded-xl border border-signal/25 bg-signal/[0.07] text-signal text-sm font-semibold hover:bg-signal/15 hover:border-signal/45 transition-all inline-flex items-center justify-center gap-2 active:scale-[0.98]"
                      onClick={handleDisconnect}
                    >
                      <LogOut className="w-4 h-4" strokeWidth={2.25} />
                      Disconnect Wallet
                    </button>

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

                    {/* Open wallet selector */}
                    <button
                      className="btn-connect"
                      onClick={() => setShowSelector(true)}
                    >
                      <WalletIcon className="w-4 h-4" strokeWidth={2.25} />
                      {hasInj ? 'Choose wallet' : 'Get a wallet'}
                      <ChevronRight className="w-4 h-4 ml-auto opacity-50" strokeWidth={2.5} />
                    </button>

                    {!hasInj && (
                      <p className="text-white/28 text-xs text-center leading-relaxed">
                        MetaMask, Rabby, Coinbase Wallet and any EIP-1193 wallet works.
                      </p>
                    )}

                    {hasInj && (
                      <p className="text-white/22 text-xs text-center font-mono">
                        EIP-1193 compatible · {symbol} required for play
                      </p>
                    )}

                    <div className="md:hidden h-[env(safe-area-inset-bottom,0px)]" />
                  </>
                )}
              </div>

              <div className="h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
            </div>
          </div>
        </div>
      </div>

      {/* Wallet selector sheet — rendered on top of the panel at z-[75] */}
      {showSelector && (
        <WalletSelectorModal
          onConnect={handleConnected}
          onClose={() => setShowSelector(false)}
        />
      )}
    </>
  )
}
