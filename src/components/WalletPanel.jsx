import React, { useEffect, useState, useCallback } from 'react'
import { Copy, LogOut, Wallet as WalletIcon, X } from 'lucide-react'
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
  const [, force] = useState(0)
  const [balanceWei, setBalanceWei] = useState(null)
  const [connecting, setConnecting] = useState(false)

  const net = getNetworkInfo()
  const symbol = getChainNativeSymbol()
  const addToast = useGameStore((s) => s.addToast)
  const resetGame = useGameStore((s) => s.resetGame)

  useEffect(() => subscribeWallet(() => force((n) => n + 1)), [])

  const connected = isWalletConnected()
  const address   = myAddress()
  const hasInj    = hasInjectedProvider()

  const refreshBalance = useCallback(async () => {
    if (!address) return
    try {
      const wei = await getGenBalanceWei(address)
      setBalanceWei(wei)
    } catch {
      setBalanceWei(null)
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
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center px-4 animate-fade-in"
      onClick={() => setOpen(false)}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative card glass max-w-md w-full space-y-5 animate-slide-up max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <WalletIcon className="w-5 h-5 text-plasma" strokeWidth={2.25} />
              <h2 className="font-display font-700 text-xl text-white">Wallet</h2>
            </div>
            <p className="text-white/50 text-xs">
              {connected ? net.label : `Connect a Web3 wallet to play on ${net.label}.`}
            </p>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="text-white/40 hover:text-white transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" strokeWidth={2.25} />
          </button>
        </div>

        {connected ? (
          <>
            {/* Network */}
            <div>
              <div className="text-white/50 text-[10px] font-mono uppercase tracking-wider mb-2">
                Network
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-white/5 border border-white/10 px-3 py-2.5">
                <span className="w-2 h-2 rounded-full bg-ice glow-ice" />
                <span className="text-white text-sm">{net.label}</span>
              </div>
            </div>

            {/* Address */}
            <div>
              <div className="text-white/50 text-[10px] font-mono uppercase tracking-wider mb-2">
                Address
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-lg bg-white/5 border border-white/10 px-3 py-2.5 font-mono text-xs text-white/90 break-all">
                  {address}
                </code>
                <button
                  className="rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-white/70 px-3 py-2.5 transition-colors"
                  onClick={() => copy(address, 'Address copied')}
                  aria-label="Copy address"
                >
                  <Copy className="w-4 h-4" strokeWidth={2.25} />
                </button>
              </div>
            </div>

            {/* Balance */}
            <div>
              <div className="text-white/50 text-[10px] font-mono uppercase tracking-wider mb-2">
                Balance
              </div>
              <div className="rounded-lg bg-white/5 border border-white/10 px-3 py-3 flex items-baseline gap-2">
                <span className="font-display font-700 text-2xl text-white tabular-nums">
                  {balanceWei !== null ? formatGen(balanceWei, 4) : '—'}
                </span>
                <span className="text-white/50 text-sm font-mono">{symbol}</span>
              </div>
            </div>

            <button
              className="w-full py-2.5 rounded-lg border border-signal/40 bg-signal/15 text-signal text-sm font-semibold hover:bg-signal/25 transition-colors inline-flex items-center justify-center gap-2"
              onClick={handleDisconnect}
            >
              <LogOut className="w-4 h-4" strokeWidth={2.25} />
              Disconnect
            </button>
          </>
        ) : (
          <>
            <div className="rounded-lg bg-white/5 border border-white/10 px-3 py-3 text-sm text-white/70 text-center">
              Genjury runs on {net.label}. Connect a Web3 wallet to play.
            </div>

            <button
              className="w-full py-3 rounded-lg border border-plasma/50 bg-plasma/15 text-plasma text-sm font-semibold hover:bg-plasma/25 disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center justify-center gap-2"
              onClick={handleConnect}
              disabled={!hasInj || connecting}
            >
              <WalletIcon className="w-4 h-4" strokeWidth={2.25} />
              {connecting
                ? 'Connecting…'
                : hasInj
                  ? 'Connect wallet'
                  : 'No wallet detected'}
            </button>

            {!hasInj && (
              <p className="text-white/40 text-xs text-center">
                Install{' '}
                <a
                  href="https://metamask.io"
                  target="_blank"
                  rel="noopener"
                  className="underline hover:text-white/70"
                >
                  MetaMask
                </a>{' '}
                or any EIP-1193 wallet to play with real {symbol}.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
