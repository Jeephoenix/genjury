import React, { useEffect, useState, useCallback } from 'react'
import {
  myAddress,
  burnerAddress,
  injectedAddress,
  isInjectedActive,
  hasInjectedProvider,
  connectInjectedWallet,
  disconnectInjectedWallet,
  subscribeWallet,
  getNetworkInfo,
  getChainNativeSymbol,
  getPrivateKey,
  resetBurner,
  importPrivateKey,
  getGenBalanceWei,
  formatGen,
} from '../lib/genlayer'
import useGameStore from '../lib/store'

const short = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '')

export default function WalletPanel() {
  const [open, setOpen] = useState(false)
  const [, force] = useState(0)
  const [showPk, setShowPk] = useState(false)
  const [importVal, setImportVal] = useState('')
  const [balanceWei, setBalanceWei] = useState(null)
  const [balanceLoading, setBalanceLoading] = useState(false)
  const [connecting, setConnecting] = useState(false)

  const net = getNetworkInfo()
  const symbol = getChainNativeSymbol()
  const addToast = useGameStore((s) => s.addToast)
  const resetGame = useGameStore((s) => s.resetGame)

  // Re-render on wallet mode / account changes.
  useEffect(() => subscribeWallet(() => force((n) => n + 1)), [])

  const address  = myAddress()
  const injected = isInjectedActive()
  const burner   = burnerAddress()
  const hasInj   = hasInjectedProvider()
  const injAddr  = injectedAddress()

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
    if (open) refreshBalance()
  }, [open, address, injected, refreshBalance])

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
    disconnectInjectedWallet()
    addToast('Wallet disconnected — back to burner key', 'info')
  }

  const handleResetBurner = () => {
    if (!confirm('Generate a new burner key? The current one will be lost unless you copied it.')) return
    resetGame()
    resetBurner()
    addToast('New burner wallet created', 'success')
  }

  const handleImport = () => {
    try {
      importPrivateKey(importVal)
      resetGame()
      setImportVal('')
      addToast('Wallet imported', 'success')
    } catch (e) {
      addToast(`Import failed: ${e?.message || e}`, 'error')
    }
  }

  return (
    <>
      {/* Trigger pill — fixed top-right */}
      <button
        onClick={() => setOpen(true)}
        className="fixed top-3 right-3 z-[60] badge bg-white/5 border border-white/10 text-white/80 hover:text-white hover:bg-white/10 transition-colors px-3 py-2 cursor-pointer"
        aria-label="Open wallet panel"
      >
        <span className={`w-2 h-2 rounded-full ${injected ? 'bg-plasma glow-plasma' : 'bg-neon glow-neon'}`} />
        <span className="font-mono">{short(address)}</span>
        <span className="text-white/30 text-[10px] uppercase tracking-widest ml-1">
          {injected ? 'wallet' : 'burner'}
        </span>
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
                  {injected
                    ? 'Connected via Web3 wallet'
                    : 'Burner key — stored only in this browser'}
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

            {/* Active address + balance */}
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

            {/* Wallet mode toggle */}
            <div>
              <label className="text-white/50 text-xs font-mono uppercase tracking-wider mb-2 block">
                Wallet mode
              </label>
              {injected ? (
                <div className="space-y-2">
                  <div className="rounded-lg bg-plasma/10 border border-plasma/30 px-3 py-2.5 text-xs text-plasma/90">
                    Signing with your Web3 wallet ({short(injAddr)}).
                  </div>
                  <button
                    className="btn btn-ghost w-full py-2 text-xs"
                    onClick={handleDisconnect}
                  >
                    Disconnect — switch back to burner key
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="rounded-lg bg-white/5 border border-white/10 px-3 py-2.5 text-xs text-white/70">
                    Using a burner key generated in this browser. No real funds
                    at risk — perfect for trying out the game.
                  </div>
                  <button
                    className="btn btn-plasma w-full py-2.5 text-sm disabled:cursor-not-allowed"
                    onClick={handleConnect}
                    disabled={!hasInj || connecting}
                    title={hasInj ? 'Connect a Web3 wallet' : 'No Web3 wallet detected'}
                  >
                    {connecting
                      ? 'Connecting…'
                      : hasInj
                        ? '🦊 Connect MetaMask / Web3 wallet'
                        : '🦊 No Web3 wallet detected'}
                  </button>
                  {!hasInj && (
                    <p className="text-white/30 text-xs">
                      Install <a href="https://metamask.io" target="_blank" rel="noopener" className="underline hover:text-white/60">MetaMask</a> (or any EIP-1193 wallet) to play with real {symbol}.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Faucet / explorer */}
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

            {/* Burner-only controls */}
            {!injected && (
              <>
                <div>
                  <label className="text-white/50 text-xs font-mono uppercase tracking-wider mb-2 block">
                    Burner private key
                  </label>
                  {!showPk ? (
                    <button
                      className="btn btn-ghost w-full py-2 text-xs"
                      onClick={() => setShowPk(true)}
                    >
                      Show private key
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <code className="block rounded-lg bg-signal/10 border border-signal/30 px-3 py-2.5 font-mono text-xs text-signal break-all">
                        {getPrivateKey()}
                      </code>
                      <div className="flex gap-2">
                        <button
                          className="btn btn-ghost flex-1 py-2 text-xs"
                          onClick={() => copy(getPrivateKey() || '', 'Private key copied')}
                        >
                          Copy
                        </button>
                        <button
                          className="btn btn-ghost flex-1 py-2 text-xs"
                          onClick={() => setShowPk(false)}
                        >
                          Hide
                        </button>
                      </div>
                      <p className="text-signal/80 text-xs">
                        Anyone with this key controls this wallet. Save it before resetting.
                      </p>
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-white/50 text-xs font-mono uppercase tracking-wider mb-2 block">
                    Import a private key
                  </label>
                  <div className="flex gap-2">
                    <input
                      className="input font-mono text-xs"
                      placeholder="0x…"
                      value={importVal}
                      onChange={(e) => setImportVal(e.target.value)}
                    />
                    <button
                      className="btn btn-plasma px-3 py-2 text-xs"
                      onClick={handleImport}
                      disabled={!importVal.trim()}
                    >
                      Import
                    </button>
                  </div>
                </div>

                <div className="pt-2 border-t border-white/10">
                  <button
                    className="btn btn-signal w-full py-2 text-xs"
                    onClick={handleResetBurner}
                  >
                    Reset burner (new key)
                  </button>
                </div>
              </>
            )}

            {/* Burner-key info while injected mode is active */}
            {injected && burner && (
              <div className="pt-2 border-t border-white/10">
                <p className="text-white/30 text-xs font-mono mb-1 uppercase tracking-wider">
                  Burner key (kept dormant)
                </p>
                <code className="block rounded-lg bg-white/5 border border-white/10 px-3 py-2 font-mono text-[11px] text-white/40 break-all">
                  {burner}
                </code>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
