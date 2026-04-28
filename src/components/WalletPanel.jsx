import React, { useEffect, useState } from 'react'
import {
  myAddress,
  getNetworkInfo,
  getPrivateKey,
  resetAccount,
  importPrivateKey,
} from '../lib/genlayer'
import useGameStore from '../lib/store'

const short = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '')

export default function WalletPanel() {
  const [open, setOpen] = useState(false)
  const [address, setAddress] = useState('')
  const [showPk, setShowPk] = useState(false)
  const [importVal, setImportVal] = useState('')
  const net = getNetworkInfo()
  const addToast = useGameStore((s) => s.addToast)
  const resetGame = useGameStore((s) => s.resetGame)

  useEffect(() => {
    setAddress(myAddress())
  }, [])

  const copy = (text, label = 'Copied') => {
    try {
      navigator.clipboard?.writeText(text)
      addToast(label, 'success')
    } catch {
      addToast('Copy failed', 'error')
    }
  }

  const handleReset = () => {
    if (!confirm('Reset wallet? This will create a brand new private key. The current one will be lost unless you copied it.')) return
    resetGame()
    resetAccount()
    setAddress(myAddress())
    addToast('New wallet created', 'success')
  }

  const handleImport = () => {
    try {
      const next = importPrivateKey(importVal)
      resetGame()
      setAddress(next)
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
        <span className="w-2 h-2 rounded-full bg-neon glow-neon" />
        <span className="font-mono">{short(address)}</span>
      </button>

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center px-4 animate-fade-in"
          onClick={() => setOpen(false)}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div
            className="relative card glass max-w-md w-full space-y-5 animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-display font-700 text-xl text-white">Your Wallet</h2>
                <p className="text-white/40 text-xs font-mono mt-0.5">
                  Burner key — stored only in this browser
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

            {/* Address */}
            <div>
              <label className="text-white/50 text-xs font-mono uppercase tracking-wider mb-2 block">
                Address
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
                    Get test tokens
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

            {/* Private key */}
            <div>
              <label className="text-white/50 text-xs font-mono uppercase tracking-wider mb-2 block">
                Private key
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

            {/* Import */}
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

            {/* Reset */}
            <div className="pt-2 border-t border-white/10">
              <button
                className="btn btn-signal w-full py-2 text-xs"
                onClick={handleReset}
              >
                Reset wallet (new key)
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
