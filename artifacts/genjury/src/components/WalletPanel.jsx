import React, { useEffect, useState, useCallback } from 'react'
  import {
    Copy, LogOut, Wallet as WalletIcon, X, ExternalLink,
    RefreshCw, AlertTriangle,
  } from 'lucide-react'
import {
    myAddress,
    isWalletConnected,
    hasInjectedProvider,
    connectInjectedWallet,
    disconnectInjectedWallet,
    subscribeWallet,
    getNetworkInfo,
    getNetworkName,
    getChain,
    getChainNativeSymbol,
    getGenBalanceWei,
    formatGen,
    getChosenProvider,
    switchToCorrectChain,
  } from '../lib/genlayer'
  import useGameStore from '../lib/store'

  const short = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '')

  const friendlyConnectError = (e) => {
    const msg  = e?.message || ''
    const code = e?.code
    if (code === 4001 || /rejected|denied|cancel/i.test(msg))
      return 'Request cancelled — please approve the connection in your wallet.'
    if (/only a getter|Cannot set property ethereum|read.only/i.test(msg))
      return 'A wallet conflict was detected. Disable other wallet extensions and refresh the page.'
    if (/no web3|no wallet|not found|not installed/i.test(msg))
      return 'No wallet detected. Make sure your extension is enabled, then refresh.'
    if (/timeout|timed out/i.test(msg))
      return 'Connection timed out. Please try again.'
    if (/network|rpc|econnrefused|fetch failed/i.test(msg))
      return 'Network error — check your connection and try again.'
    return 'Could not connect wallet. Please try again.'
  }

  export default function WalletPanel() {
    const open    = useGameStore((s) => s.walletPanelOpen)
    const setOpen = useGameStore((s) => s.setWalletPanelOpen)
    const [, force]           = useState(0)
    const [balanceWei, setBalanceWei]     = useState(null)
    const [refreshing, setRefreshing]     = useState(false)
    const [copied, setCopied]             = useState(false)
    const [wrongChain, setWrongChain]     = useState(false)
    const [switching, setSwitching]       = useState(false)
    const [connecting, setConnecting]     = useState(false)
    const [connectError, setConnectError] = useState('')

    const net         = getNetworkInfo()
    const networkName = getNetworkName()
    const symbol      = getChainNativeSymbol()
    const addToast    = useGameStore((s) => s.addToast)
    const resetGame   = useGameStore((s) => s.resetGame)

    useEffect(() => subscribeWallet(() => force((n) => n + 1)), [])

    const checkChain = useCallback(async () => {
      if (!isWalletConnected()) { setWrongChain(false); return }
      const provider = getChosenProvider()
      if (!provider) { setWrongChain(false); return }
      try {
        const cur      = await provider.request({ method: 'eth_chainId' })
        const expected = `0x${getChain().id.toString(16)}`
        setWrongChain(cur !== expected)
      } catch {
        setWrongChain(false)
      }
    }, [])

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
      if (open) checkChain()
      if (open) setConnectError('')
    }, [open, address, refreshBalance, checkChain])

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

    const handleConnect = async () => {
      if (connecting || !hasInj) return
      setConnecting(true)
      setConnectError('')
      try {
        const addr = await connectInjectedWallet()
        addToast(`Connected ${short(addr)}`, 'success')
        force((n) => n + 1)
        checkChain()
      } catch (e) {
        setConnectError(friendlyConnectError(e))
      } finally {
        setConnecting(false)
      }
    }

    const handleDisconnect = () => {
      resetGame()
      disconnectInjectedWallet()
      addToast('Wallet disconnected', 'info')
    }

    const handleSwitchNetwork = async () => {
      if (switching) return
      setSwitching(true)
      const ok = await switchToCorrectChain(getChosenProvider())
      if (ok) {
        setWrongChain(false)
        addToast('Switched to ' + net.label, 'success')
      } else {
        addToast('Switch cancelled — try switching manually in your wallet.', 'error')
      }
      setSwitching(false)
    }

    if (!open) return null

    return (
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

            <div className="glass-strong rounded-t-3xl md:rounded-2xl border-t border-x md:border border-white/[0.1] overflow-hidden max-h-[88vh] overflow-y-auto">
              <div className="h-px bg-gradient-to-r from-transparent via-plasma/60 to-transparent" />

              <div className="p-6 space-y-5">

                {/* Header */}
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
                        : `Connect a wallet to play on ${net.label}.`}
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
                    <div className={`rounded-xl px-3.5 py-3 flex items-center gap-3 transition-colors ${wrongChain ? 'bg-gold/[0.07] border border-gold/25' : 'bg-white/[0.04] border border-white/[0.08]'}`}>
                      <div className="relative flex-shrink-0">
                        <div className={`w-2.5 h-2.5 rounded-full ${wrongChain ? 'bg-gold' : 'bg-neon'}`} />
                        {!wrongChain && <div className="absolute inset-0 rounded-full bg-neon animate-ping opacity-40" />}
                      </div>
                      <div>
                        <p className="text-[10px] font-mono uppercase tracking-widest text-white/35 mb-0.5">Network</p>
                        <p className={`text-sm font-medium ${wrongChain ? 'text-gold' : 'text-white'}`}>
                          {wrongChain ? 'Wrong network' : net.label}
                        </p>
                      </div>
                      <div className="ml-auto">
                        {wrongChain ? (
                          <span className="badge bg-gold/10 border border-gold/25 text-gold text-[10px]">MISMATCH</span>
                        ) : (
                          <span className="badge bg-neon/10 border border-neon/25 text-neon text-[10px]">LIVE</span>
                        )}
                      </div>
                    </div>

                    {/* Switch network card */}
                    {wrongChain && (
                      <div className="rounded-xl bg-gold/[0.08] border border-gold/25 px-3.5 py-3 flex items-center gap-3">
                        <AlertTriangle className="w-4 h-4 text-gold flex-shrink-0" strokeWidth={2} />
                        <div className="flex-1 min-w-0">
                          <p className="text-gold text-xs font-semibold leading-tight">Switch to {net.label}</p>
                          <p className="text-gold/55 text-[11px] mt-0.5 leading-tight">Your wallet is on a different network</p>
                        </div>
                        <button
                          onClick={handleSwitchNetwork}
                          disabled={switching}
                          className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-gold/15 border border-gold/30 text-gold text-xs font-semibold hover:bg-gold/25 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-wait"
                        >
                          {switching ? 'Switching…' : 'Switch'}
                        </button>
                      </div>
                    )}

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
                    {/* Not-connected state */}
                    <div className="rounded-xl bg-white/[0.03] border border-white/[0.08] px-4 py-7 flex flex-col items-center gap-4 text-center">
                      <div className="w-14 h-14 rounded-2xl bg-plasma/10 border border-plasma/20 flex items-center justify-center">
                        <WalletIcon className="w-7 h-7 text-plasma/60" strokeWidth={1.75} />
                      </div>
                      <div>
                        <p className="text-white font-display font-semibold text-base">
                          {hasInj ? 'Wallet detected' : 'No wallet found'}
                        </p>
                        <p className="text-white/45 text-sm mt-1.5 leading-relaxed">
                          {hasInj
                            ? 'Approve the connection in your wallet to continue.'
                            : 'Install MetaMask or Rabby to play on GenLayer.'}
                        </p>
                      </div>
                    </div>

                    {/* Error message */}
                    {connectError && (
                      <div role="alert" className="rounded-xl bg-signal/10 border border-signal/30 px-3.5 py-2.5 text-signal text-xs leading-snug">
                        {connectError}
                      </div>
                    )}

                    {/* Action button */}
                    {hasInj ? (
                      <button
                        onClick={handleConnect}
                        disabled={connecting}
                        aria-busy={connecting}
                        className="w-full py-3.5 rounded-xl bg-plasma text-white font-display font-bold text-sm hover:bg-plasma/90 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-wait inline-flex items-center justify-center gap-2.5 shadow-[0_0_24px_rgba(162,89,255,0.35)]"
                      >
                        {connecting ? (
                          <>
                            <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin flex-shrink-0" />
                            Connecting…
                          </>
                        ) : (
                          <>
                            <WalletIcon className="w-4 h-4 flex-shrink-0" strokeWidth={2.25} />
                            Connect Wallet
                          </>
                        )}
                      </button>
                    ) : (
                      <a
                        href="https://metamask.io/download/"
                        target="_blank"
                        rel="noopener"
                        className="w-full py-3.5 rounded-xl border border-white/15 bg-white/[0.05] text-white/70 text-sm font-semibold hover:bg-white/10 hover:text-white transition-all inline-flex items-center justify-center gap-2"
                      >
                        <ExternalLink className="w-4 h-4" strokeWidth={2.25} />
                        Install MetaMask
                      </a>
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
    )
  }
  
