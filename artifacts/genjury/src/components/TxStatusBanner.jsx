import React, { useState } from 'react'
import { PenLine, Loader2, Check, AlertTriangle, ExternalLink, X, Copy } from 'lucide-react'
import useGameStore from '../lib/store'
import { getNetworkInfo } from '../lib/genlayer'

const STATUS_META = {
  awaiting_signature: {
    Icon:   PenLine,
    title:  'Confirm in wallet',
    accent: 'border-plasma/35 bg-plasma/[0.08]',
    top:    'from-plasma/50',
    bar:    'bg-plasma',
    dotCls: 'bg-plasma',
    text:   'text-plasma',
    badge:  'bg-plasma/15 border-plasma/30 text-plasma',
  },
  pending: {
    Icon:   Loader2,
    spin:   true,
    title:  'Transaction pending',
    accent: 'border-ice/35 bg-ice/[0.07]',
    top:    'from-ice/50',
    bar:    'bg-ice',
    dotCls: 'bg-ice',
    text:   'text-ice',
    badge:  'bg-ice/15 border-ice/30 text-ice',
  },
  confirmed: {
    Icon:   Check,
    title:  'Confirmed on-chain',
    accent: 'border-neon/35 bg-neon/[0.07]',
    top:    'from-neon/50',
    bar:    null,
    dotCls: 'bg-neon',
    text:   'text-neon',
    badge:  'bg-neon/15 border-neon/30 text-neon',
  },
  failed: {
    Icon:   AlertTriangle,
    title:  'Transaction failed',
    accent: 'border-signal/35 bg-signal/[0.07]',
    top:    'from-signal/50',
    bar:    null,
    dotCls: 'bg-signal',
    text:   'text-signal',
    badge:  'bg-signal/15 border-signal/30 text-signal',
  },
}

const short = (h) => (h ? `${h.slice(0, 10)}…${h.slice(-8)}` : '')

export default function TxStatusBanner() {
  const tx       = useGameStore((s) => s.pendingTx)
  const addToast = useGameStore((s) => s.addToast)
  const [hidden, setHidden] = useState(false)

  React.useEffect(() => {
    if (tx) setHidden(false)
  }, [tx?.id])

  if (!tx || hidden) return null

  const meta      = STATUS_META[tx.status] || STATUS_META.pending
  const explorer  = getNetworkInfo().explorer
  const txLink    = explorer && tx.hash ? `${explorer}/tx/${tx.hash}` : null
  const dismissable = tx.status === 'confirmed' || tx.status === 'failed'

  const copyHash = () => {
    if (!tx.hash) return
    try {
      navigator.clipboard?.writeText(tx.hash)
      addToast('Transaction hash copied', 'success')
    } catch {
      addToast('Copy failed', 'error')
    }
  }

  return (
    <div
      className="fixed bottom-[5.5rem] right-4 md:bottom-4 z-[80] w-[min(92vw,360px)] animate-slide-up"
      role="status"
      aria-live="polite"
    >
      <div className={`rounded-2xl border ${meta.accent} backdrop-blur-xl shadow-2xl overflow-hidden`}>
        {/* Top accent line */}
        <div className={`h-px bg-gradient-to-r ${meta.top} via-transparent to-transparent`} />

        {/* Header row */}
        <div className="flex items-start gap-3 p-4">
          {/* Status icon with pulse ring */}
          <div className="flex-shrink-0 relative mt-0.5">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
              tx.status === 'confirmed' ? 'bg-neon/15' :
              tx.status === 'failed' ? 'bg-signal/15' :
              tx.status === 'pending' ? 'bg-ice/15' : 'bg-plasma/15'
            }`}>
              <meta.Icon
                className={`w-4 h-4 ${meta.text} ${meta.spin ? 'animate-spin' : ''}`}
                strokeWidth={2.25}
              />
            </div>
            {(tx.status === 'pending' || tx.status === 'awaiting_signature') && (
              <div className={`absolute inset-0 rounded-xl ${
                tx.status === 'pending' ? 'bg-ice/20' : 'bg-plasma/20'
              } animate-ping`} style={{ animationDuration: '1.5s' }} />
            )}
          </div>

          <div className="flex-1 min-w-0">
            {/* Status badge */}
            <span className={`inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full border mb-1 ${meta.badge}`}>
              <span className={`w-1 h-1 rounded-full ${meta.dotCls}`} />
              {meta.title}
            </span>

            {/* Label */}
            <div className="text-white/90 text-sm font-display font-semibold truncate">
              {tx.label}
            </div>

            {tx.status === 'awaiting_signature' && (
              <p className="text-white/40 text-xs mt-1 leading-snug">
                Approve this transaction in your wallet
              </p>
            )}

            {tx.error && (
              <p className="text-signal/80 text-xs mt-1 break-words leading-snug">
                {tx.error}
              </p>
            )}
          </div>

          {dismissable && (
            <button
              onClick={() => setHidden(true)}
              className="flex-shrink-0 w-6 h-6 rounded-lg bg-white/[0.05] text-white/35 hover:text-white hover:bg-white/10 flex items-center justify-center transition-all"
              aria-label="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Tx hash row */}
        {tx.hash && (
          <div className="border-t border-white/[0.07] bg-black/20 px-4 py-2.5 flex items-center justify-between gap-3">
            <code className="font-mono text-[11px] text-white/45 truncate flex-1">
              {short(tx.hash)}
            </code>
            <div className="flex items-center gap-2.5 flex-shrink-0">
              <button
                onClick={copyHash}
                className="text-white/35 hover:text-white/70 transition-colors"
                aria-label="Copy hash"
              >
                <Copy className="w-3.5 h-3.5" strokeWidth={2.25} />
              </button>
              {txLink && (
                <a
                  href={txLink}
                  target="_blank"
                  rel="noopener"
                  className={`${meta.text} opacity-70 hover:opacity-100 text-[11px] font-mono inline-flex items-center gap-1 transition-opacity`}
                >
                  Explorer <ExternalLink className="w-3 h-3" strokeWidth={2.25} />
                </a>
              )}
            </div>
          </div>
        )}

        {/* Animated progress strip while in-flight */}
        {(tx.status === 'awaiting_signature' || tx.status === 'pending') && (
          <div className="h-[3px] bg-white/[0.05] overflow-hidden">
            <div
              className={`h-full ${meta.bar} animate-tx-progress rounded-full`}
              style={{ boxShadow: tx.status === 'pending' ? '0 0 8px rgba(56,217,245,0.5)' : '0 0 8px rgba(162,89,255,0.5)' }}
            />
          </div>
        )}
      </div>
    </div>
  )
}
