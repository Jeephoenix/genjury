import React, { useEffect, useState, useCallback } from 'react'
  import { X, ExternalLink, ChevronRight, Wallet as WalletIcon } from 'lucide-react'
  import {
    detectWallets,
    connectWithProvider,
    hasInjectedProvider,
    initEIP6963,
    subscribeWalletList,
  } from '../lib/genlayer'

  // ── Inline SVG wallet icons (fallback when EIP-6963 dataIcon is absent) ───────

  function IconMetaMask({ size = 28 }) {
    return (
      <svg width={size} height={size} viewBox="0 0 35 33" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M32.958 1L19.843 10.686l2.414-5.705L32.958 1z" fill="#E2761B" stroke="#E2761B" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M2.029 1l13.003 9.779-2.296-5.798L2.029 1zM28.18 23.533l-3.492 5.348 7.468 2.055 2.144-7.279-6.12-.124zM1.721 23.657l2.133 7.279 7.468-2.055-3.48-5.348-6.121.124z" fill="#E4761B" stroke="#E4761B" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M10.898 14.557l-2.08 3.146 7.408.33-.264-7.973-5.064 4.497zM24.089 14.557l-5.143-4.59-.177 8.066 7.397-.33-2.077-3.146zM11.322 28.881l4.455-2.166-3.845-3-1.61 5.166H11.322zM19.21 26.715l4.466 2.166-1.62-5.166-3.845 3h.999z" fill="#E4761B" stroke="#E4761B" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M23.676 28.881l-4.466-2.166.358 2.91-.04 1.237 4.148-1.981zM11.322 28.881l4.158 1.981-.029-1.237.347-2.91-4.476 2.166z" fill="#D7C1B3" stroke="#D7C1B3" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M15.539 22.069l-3.704-1.09 2.616-1.198 1.088 2.288zM19.448 22.069l1.088-2.288 2.627 1.198-3.715 1.09z" fill="#233447" stroke="#233447" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M11.322 28.881l1.641-5.348-3.492.124 1.851 5.224zM22.024 23.533l1.652 5.348 1.851-5.224-3.503-.124zM26.166 17.703l-7.397.33.687 3.816 1.088-2.288 2.627 1.198 3.995-3.056zM11.835 20.979l2.616-1.198 1.088 2.288.698-3.816-7.408-.33 3.006 3.056z" fill="#CD6116" stroke="#CD6116" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M8.818 17.703l3.108 6.072-.1-3.016-3.008-3.056zM23.183 20.759l-.11 3.016 3.109-6.072-3.0 3.056zM15.533 18.033l-.698 3.816.875 4.507.198-5.938-.375-2.385zM19.469 18.033l-.363 2.374.186 5.949.876-4.507-.699-3.816z" fill="#E4751F" stroke="#E4751F" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M19.448 22.069l-.876 4.507.636.44 3.845-3 .11-3.016-3.715 1.069zM11.835 20.979l.1 3.016 3.845 3 .636-.44-.875-4.507-3.706-1.069z" fill="#F6851B" stroke="#F6851B" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M19.48 30.862l.04-1.237-.335-.286h-4.4l-.314.286.029 1.237-4.158-1.981 1.455 1.19 2.95 2.044h5.033l2.96-2.044 1.445-1.19-4.705 1.981z" fill="#C0AD9E" stroke="#C0AD9E" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M19.21 26.715l-.636-.44h-3.16l-.636.44-.347 2.91.314-.286h4.4l.335.286-.27-2.91z" fill="#161616" stroke="#161616" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M33.514 11.133l1.107-5.368L32.958 1 19.21 10.334l5.064 4.285 7.158 2.09 1.576-1.84-.684-.495 1.09-.993-.836-.649 1.09-.835-.153-.859zM.378 5.765l1.107 5.368-.706.506 1.09.835-.826.649 1.09.993-.684.495 1.576 1.84 7.158-2.09 5.064-4.285L2.04 1 .378 5.765z" fill="#763D16" stroke="#763D16" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M31.432 16.709l-7.158-2.09 2.077 3.146-3.108 6.072 4.103-.055h6.12l-2.034-7.073zM10.714 14.619l-7.158 2.09-2.022 7.073h6.108l4.092.055-3.097-6.072 2.077-3.146zM19.769 18.033l.45-7.699 2.044-5.53h-9.099l2.034 5.53.463 7.699.165 2.407.011 5.927h3.712l.022-5.927.198-2.407z" fill="#F6851B" stroke="#F6851B" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    )
  }

  function IconRabby({ size = 28 }) {
    return (
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill="#7B5BF5"/>
        <path d="M8 20c0-4.418 3.582-8 8-8s8 3.582 8 8" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/>
        <circle cx="11" cy="20" r="2.5" fill="#fff"/>
        <circle cx="21" cy="20" r="2.5" fill="#fff"/>
        <path d="M13 14.5c0-1.657 1.343-3 3-3s3 1.343 3 3" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
        <circle cx="16" cy="13" r="1.5" fill="#fff"/>
      </svg>
    )
  }

  function IconCoinbase({ size = 28 }) {
    return (
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill="#1652F0"/>
        <path d="M16 7C11.029 7 7 11.029 7 16s4.029 9 9 9 9-4.029 9-9-4.029-9-9-9zm0 14.4A5.4 5.4 0 1116 10.6a5.4 5.4 0 010 10.8z" fill="#fff"/>
        <rect x="13" y="14" width="6" height="4" rx="1" fill="#1652F0"/>
      </svg>
    )
  }

  function IconBrave({ size = 28 }) {
    return (
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill="#FB542B"/>
        <path d="M16 6l7 4.5v9L16 26l-7-6.5v-9L16 6z" fill="#fff" fillOpacity=".9"/>
        <path d="M16 10l4 2.5v5L16 21l-4-3.5v-5L16 10z" fill="#FB542B"/>
      </svg>
    )
  }

  function IconGeneric({ size = 28 }) {
    return (
      <div
        style={{ width: size, height: size }}
        className="rounded-lg bg-white/10 border border-white/20 flex items-center justify-center flex-shrink-0"
        aria-hidden="true"
      >
        <WalletIcon className="w-4 h-4 text-white/60" strokeWidth={2} />
      </div>
    )
  }

  const WALLET_ICONS = {
    metamask: IconMetaMask,
    rabby:    IconRabby,
    coinbase: IconCoinbase,
    brave:    IconBrave,
    frame:    IconGeneric,
    trust:    IconGeneric,
    okx:      IconGeneric,
    generic:  IconGeneric,
  }

  // ── Install links ─────────────────────────────────────────────────────────────
  const INSTALL_LINKS = {
    metamask: { url: 'https://metamask.io/download/',             label: 'metamask.io' },
    rabby:    { url: 'https://rabby.io/',                         label: 'rabby.io' },
    coinbase: { url: 'https://www.coinbase.com/wallet/downloads', label: 'coinbase.com' },
    brave:    { url: 'https://brave.com/wallet/',                 label: 'brave.com' },
  }

  const SUGGESTED = [
    { key: 'metamask', label: 'MetaMask',        icon: 'metamask' },
    { key: 'rabby',    label: 'Rabby',           icon: 'rabby' },
    { key: 'coinbase', label: 'Coinbase Wallet', icon: 'coinbase' },
  ]

  // ── Wallet icon renderer ──────────────────────────────────────────────────────
  // Prefers the data-URI sent by the wallet itself via EIP-6963 info.icon.
  // Falls back to the inline SVG keyed by w.icon.

  function WalletIcon6963({ wallet, size = 32 }) {
    if (wallet.dataIcon) {
      return (
        <img
          src={wallet.dataIcon}
          alt=""
          aria-hidden="true"
          width={size}
          height={size}
          className="rounded-lg flex-shrink-0 object-contain"
          style={{ width: size, height: size }}
        />
      )
    }
    const Icon = WALLET_ICONS[wallet.icon] || IconGeneric
    return <Icon size={size} />
  }

  // ── Component ─────────────────────────────────────────────────────────────────

  export default function WalletSelectorModal({ onConnect, onClose }) {
    const [wallets, setWallets]     = useState([])
    const [connecting, setConnecting] = useState(null) // providerIndex | null
    const [error, setError]         = useState('')
    const hasInj = hasInjectedProvider()

    // Refresh wallet list helper
    const refresh = useCallback(() => {
      setWallets(detectWallets())
    }, [])

    useEffect(() => {
      // Start EIP-6963 discovery — fires requestProvider and attaches listener.
      // Each new wallet announcement calls notifyWalletList() in genlayer.js,
      // which triggers our subscribeWalletList callback to re-run detectWallets().
      const cleanup6963  = initEIP6963()
      const cleanupSub   = subscribeWalletList(refresh)

      // Initial snapshot (covers EIP-5749 + any already-announced EIP-6963 wallets)
      refresh()

      return () => {
        cleanup6963()
        cleanupSub()
      }
    }, [refresh])

    const handleSelect = async (providerIndex) => {
      setError('')
      setConnecting(providerIndex)
      try {
        const addr = await connectWithProvider(providerIndex)
        onConnect(addr)
      } catch (e) {
        const msg = e?.message || 'Could not connect wallet'
        setError(
          /rejected|denied|cancel/i.test(msg)
            ? 'Request cancelled — please approve in your wallet.'
            : msg
        )
        setConnecting(null)
      }
    }

    return (
      <div
        className="fixed inset-0 z-[75] modal-overlay flex items-end md:items-center justify-center md:px-4"
        role="dialog"
        aria-modal="true"
        aria-label="Choose a wallet"
        onClick={onClose}
      >
        <div className="absolute inset-0 bg-black/80 backdrop-blur-md" />

        <div
          className="relative w-full md:max-w-sm sheet-panel"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Mobile drag handle */}
          <div className="md:hidden flex justify-center pt-3" aria-hidden="true">
            <div className="w-10 h-1 rounded-full bg-white/25" />
          </div>

          <div className="glass-strong rounded-t-3xl md:rounded-2xl border-t border-x md:border border-white/[0.1] overflow-hidden max-h-[90vh] overflow-y-auto">
            {/* Top accent */}
            <div className="h-px bg-gradient-to-r from-transparent via-plasma/60 to-transparent" />

            <div className="p-5 space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-display font-bold text-lg text-white tracking-tight">Connect wallet</h2>
                  <p className="text-white/40 text-xs mt-0.5">
                    {wallets.length > 0
                      ? `${wallets.length} wallet${wallets.length !== 1 ? 's' : ''} detected`
                      : 'Choose a wallet to continue'}
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white/40 hover:text-white hover:bg-white/10 transition-all flex items-center justify-center flex-shrink-0"
                  aria-label="Close wallet selector"
                >
                  <X className="w-4 h-4" strokeWidth={2.25} />
                </button>
              </div>

              {/* Error message */}
              {error && (
                <div
                  role="alert"
                  className="rounded-xl bg-signal/10 border border-signal/30 px-3.5 py-2.5 text-signal text-xs leading-snug"
                >
                  {error}
                </div>
              )}

              {hasInj && wallets.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-white/30 px-0.5">
                    Detected wallets
                  </p>
                  {wallets.map((w) => {
                    const busy = connecting === w.providerIndex
                    return (
                      <button
                        key={w.key}
                        onClick={() => handleSelect(w.providerIndex)}
                        disabled={connecting !== null}
                        className={`w-full flex items-center gap-3.5 px-4 py-3.5 rounded-xl border transition-all duration-200 text-left group ${
                          busy
                            ? 'border-plasma/50 bg-plasma/12'
                            : 'border-white/[0.09] bg-white/[0.03] hover:bg-white/[0.07] hover:border-white/20 active:scale-[0.99]'
                        } disabled:cursor-wait`}
                        aria-busy={busy}
                        aria-label={`Connect with ${w.label}`}
                      >
                        {/* Icon — EIP-6963 data-URI or inline SVG fallback */}
                        <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center">
                          <WalletIcon6963 wallet={w} size={32} />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="text-white font-display font-semibold text-sm">{w.label}</div>
                          <div className="text-white/35 text-[11px] font-mono mt-0.5">
                            {busy ? 'Approve in wallet…' : 'EIP-1193 · EIP-6963'}
                          </div>
                        </div>

                        <div className="flex-shrink-0">
                          {busy ? (
                            <div className="w-5 h-5 rounded-full border-2 border-plasma/30 border-t-plasma animate-spin" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-white/25 group-hover:text-white/60 group-hover:translate-x-0.5 transition-all" strokeWidth={2.25} />
                          )}
                        </div>
                      </button>
                    )
                  })}

                  {/* Subtle divider + "don't see yours?" hint */}
                  <div className="pt-1 flex items-center gap-3">
                    <div className="flex-1 h-px bg-white/[0.06]" />
                    <p className="text-white/25 text-[10px] font-mono whitespace-nowrap">Don't see yours?</p>
                    <div className="flex-1 h-px bg-white/[0.06]" />
                  </div>
                  <p className="text-white/22 text-[11px] text-center leading-relaxed">
                    Make sure your extension is enabled, then{' '}
                    <button
                      onClick={() => window.location.reload()}
                      className="text-plasma/60 hover:text-plasma underline underline-offset-2 transition-colors"
                    >
                      refresh the page
                    </button>
                    .
                  </p>
                </div>
              ) : !hasInj ? (
                /* No wallet installed — show install suggestions */
                <div className="space-y-2">
                  <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-white/30 px-0.5">
                    Get a wallet
                  </p>
                  {SUGGESTED.map((w) => {
                    const Icon = WALLET_ICONS[w.icon] || IconGeneric
                    const link = INSTALL_LINKS[w.key]
                    return (
                      <a
                        key={w.key}
                        href={link?.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full flex items-center gap-3.5 px-4 py-3.5 rounded-xl border border-white/[0.09] bg-white/[0.03] hover:bg-white/[0.07] hover:border-white/20 transition-all duration-200 group"
                        aria-label={`Install ${w.label}`}
                      >
                        <div className="flex-shrink-0">
                          <Icon size={32} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-white font-display font-semibold text-sm">{w.label}</div>
                          <div className="text-white/35 text-[11px] font-mono mt-0.5">{link?.label}</div>
                        </div>
                        <ExternalLink className="w-3.5 h-3.5 text-white/25 group-hover:text-white/60 transition-colors flex-shrink-0" strokeWidth={2.25} />
                      </a>
                    )
                  })}
                </div>
              ) : (
                /* Fallback: ethereum present but no wallets in map yet (still loading) */
                <button
                  onClick={() => handleSelect(0)}
                  disabled={connecting !== null}
                  className="btn-connect"
                  aria-busy={connecting !== null}
                >
                  {connecting !== null ? (
                    <>
                      <div className="w-4 h-4 rounded-full border-2 border-plasma/30 border-t-plasma animate-spin" />
                      Connecting…
                    </>
                  ) : (
                    <>
                      <WalletIcon className="w-4 h-4" strokeWidth={2.25} />
                      Connect Wallet
                      <ChevronRight className="w-4 h-4 ml-auto opacity-50" strokeWidth={2.5} />
                    </>
                  )}
                </button>
              )}

              {/* Footer note */}
              <p className="text-white/22 text-[11px] text-center font-mono leading-relaxed pb-1">
                {hasInj
                  ? 'EIP-6963 · EIP-5749 · EIP-1193 compatible'
                  : 'Install any EIP-1193 wallet then refresh this page'}
              </p>

              {/* Safe-area spacer */}
              <div className="md:hidden h-[env(safe-area-inset-bottom,0px)]" />
            </div>
          </div>
        </div>
      </div>
    )
  }
  