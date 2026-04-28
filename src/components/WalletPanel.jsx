import React, { useEffect, useState, useCallback } from 'react'
import {
  myAddress,
  injectedAddress,
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
  const [open, setOpen] = useState(false)
  const [, force] = useState(0)
  const [balanceWei, setBalanceWei] = useState(null)
  const [balanceLoading, setBalanceLoading] = useState(false)
  const [connecting, setConnecting] = useState(false)

  const net = getNetworkInfo()
  const symbol = getChainNativeSymbol()
  const addToast = useGameStore((s) => s.addToast)
  const resetGame = useGameStore((s) => s.resetGame)

  useEffect(() => subscribeWallet(() => force((n) => n + 1)), [])

  const connected = isWalletConnected()
  const address   = myAddress()
  const hasInj    = hasInjectedProvider()
  const injAddr   = injectedAddress()

  const refreshBalance = useCallback(async () => {
    if (!address) return
    setBalanceLoading(true)
    try {
      const wei = await getGenBalanceWei(address)
      setBalanceWei(wei)
    } catch {
      setBalanceWei(null)
    } finally {
      setBalanceLoading(false)
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

  return (
    <>
      {/* Trigger pill — fixed top-right */}
      <button
        onClick={() => setOpen(true)}
        className="fixed top-3 right-3 z-[60] badge bg-white/5 border border-white/10 text-white/80 hover:text-white hover:bg-white/10 transition-colors px-3 py-2 cursor-pointer"
        aria-label="Open wallet panel"
      >
        <span
          className={`w-2 h-2 rounded-full ${
            connected ? 'bg-plasma glow-plasma' : 'bg-signal glow-signal'
          }`}
        />
        {connected ? (
          <>
            <span className="font-mono">{short(address)}</span>
            <span className="text-white/30 text-[10px] uppercase tracking-widest ml-1">
              wallet
            </span>
          </>
        ) : (
          <span className="font-semibold text-xs uppercase tracking-wider">
            Connect wallet
          </span>
        )}
      </button>

      {/* Modal */}
      {open && (
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
                <h2 className="font-display font-700 text-xl text-white">Your Wallet</h2>
                <p className="text-white/40 text-xs font-mono mt-0.5">
                  {connected
                    ? 'Connected via Web3 wallet'
                    : 'A Web3 wallet is required to play'}
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-white/40 hover:text-white transition-colors text-xl leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {/* Network */}
            <div>
              <label className="text-white/50 text-xs font-mono uppercase tracking-wider mb-2 block">
                Network
              </label>
              <div className="flex items-center gap-2 rounded-lg bg-white/5 border border-white/10 px-3 py-2.5">
                <span className="w-2 h-2 rounded-full bg-ice glow-ice" />
                <span className="text-white text-sm">{net.label}</span>
              </div>
            </div>

            {/* Connected state */}
            {connected ? (
              <>
                <div>
                  <label className="text-white/50 text-xs font-mono uppercase tracking-wider mb-2 block">
                    Active address
                  </label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 rounded-lg bg-white/5 border border-white/10 px-3 py-2.5 font-mono text-xs text-white/90 break-all">
                      {address}
                    </code>
                    <button
                      className="btn btn-ghost px-3 py-2 text-xs"
                      onClick={() => copy(address, 'Address copied')}
                    >
                      Copy
                    </button>
                  </div>
                  <div className="flex items-center justify-between mt-2 px-1">
                    <span className="text-white/40 text-xs font-mono">
                      Balance:{' '}
                      {balanceLoading
                        ? '…'
                        : balanceWei !== null
                          ? `${formatGen(balanceWei, 4)} ${symbol}`
                          : '—'}
                    </span>
                    <button
                      className="text-plasma/70 hover:text-plasma text-xs font-mono"
                      onClick={refreshBalance}
                      disabled={balanceLoading}
                    >
                      ↻ Refresh
                    </button>
                  </div>
                </div>

                <div className="rounded-lg bg-plasma/10 border border-plasma/30 px-3 py-2.5 text-xs text-plasma/90">
                  Signing with your Web3 wallet ({short(injAddr)}).
                </div>

                {(net.faucet || net.explorer) && (
                  <div className="flex flex-wrap gap-2">
                    {net.faucet && (
                      <a
                        href={`${net.faucet}?address=${address}`}
                        target="_blank"
                        rel="noopener"
                        className="btn btn-plasma px-3 py-2 text-xs"
                      >
                        Get test {symbol}
                      </a>
                    )}
                    {net.explorer && (
                      <a
                        href={`${net.explorer}/address/${address}`}
                        target="_blank"
                        rel="noopener"
                        className="btn btn-ghost px-3 py-2 text-xs"
                      >
                        View on explorer
                      </a>
                    )}
                  </div>
                )}

                <div className="pt-2 border-t border-white/10">
                  <button
                    className="btn btn-signal w-full py-2 text-xs"
                    onClick={handleDisconnect}
                  >
                    Disconnect wallet
                  </button>
                </div>
              </>
            ) : (
              /* Disconnected state — single, prominent connect CTA */
              <>
                <div className="rounded-lg bg-white/5 border border-white/10 px-3 py-3 text-sm text-white/70 text-center">
                  Genjury runs on {net.label}. Connect a Web3 wallet to play.
                </div>

                <button
                  className="btn btn-plasma w-full py-3 text-sm disabled:cursor-not-allowed"
                  onClick={handleConnect}
                  disabled={!hasInj || connecting}
                >
                  {connecting
                    ? 'Connecting…'
                    : hasInj
                      ? '🦊 Connect MetaMask / Web3 wallet'
                      : '🦊 No Web3 wallet detected'}
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
                    (or any EIP-1193 wallet) to play with real {symbol}.
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
