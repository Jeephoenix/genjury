import React, { useState } from 'react'
import { PenLine, Loader2, Check, AlertTriangle, ExternalLink, X } from 'lucide-react'
import useGameStore from '../lib/store'
import { getNetworkInfo } from '../lib/genlayer'

const STATUS_META = {
  awaiting_signature: {
    Icon:   PenLine,
    title:  'Confirm in your wallet',
    accent: 'border-plasma/40 bg-plasma/10',
    dotCls: 'bg-plasma animate-pulse',
    text:   'text-plasma',
  },
  pending: {
    Icon:   Loader2,
    spin:   true,
    title:  'Transaction pending',
    accent: 'border-ice/40 bg-ice/10',
    dotCls: 'bg-ice animate-pulse',
    text:   'text-ice',
  },
  confirmed: {
    Icon:   Check,
    title:  'Confirmed on-chain',
    accent: 'border-neon/40 bg-neon/10',
    dotCls: 'bg-neon',
    text:   'text-neon',
  },
  failed: {
    Icon:   AlertTriangle,
    title:  'Transaction failed',
    accent: 'border-signal/40 bg-signal/10',
    dotCls: 'bg-signal',
    text:   'text-signal',
  },
}

const short = (h) => (h ? `${h.slice(0, 10)}…${h.slice(-8)}` : '')

export default function TxStatusBanner() {
  const tx = useGameStore((s) => s.pendingTx)
  const addToast = useGameStore((s) => s.addToast)
  const [hidden, setHidden] = useState(false)

  // When a brand new tx arrives, un-hide the banner.
  React.useEffect(() => {
    if (tx) setHidden(false)
  }, [tx?.id])

  if (!tx || hidden) return null

  const meta = STATUS_META[tx.status] || STATUS_META.pending
  const explorer = getNetworkInfo().explorer
  const txLink = explorer && tx.hash ? `${explorer}/tx/${tx.hash}` : null
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
      className="fixed bottom-4 right-4 z-[80] w-[min(92vw,360px)] animate-slide-up"
      role="status"
      aria-live="polite"
    >
      <div className={`rounded-2xl border ${meta.accent} backdrop-blur-md shadow-2xl overflow-hidden`}>
        {/* Header row */}
        <div className="flex items-start gap-3 p-3.5">
          <div className="flex-shrink-0 mt-0.5 relative">
            <div className={`w-2.5 h-2.5 rounded-full ${meta.dotCls}`} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className={`text-xs font-mono uppercase tracking-wider inline-flex items-center gap-1.5 ${meta.text}`}>
                <meta.Icon className={`w-3.5 h-3.5 ${meta.spin ? 'animate-spin' : ''}`} strokeWidth={2.25} />
                {meta.title}
              </span>
            </div>
            <div className="text-white/90 text-sm font-display font-600 mt-0.5 truncate">
              {tx.label}
            </div>

            {tx.status === 'awaiting_signature' && (
              <p className="text-white/50 text-xs mt-1.5">
                Open your wallet to approve this transaction.
              </p>
            )}

            {tx.error && (
              <p className="text-signal/90 text-xs mt-1.5 break-words">
                {tx.error}
              </p>
            )}
          </div>

          {dismissable && (
            <button
              onClick={() => setHidden(true)}
              className="flex-shrink-0 text-white/40 hover:text-white"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Tx hash row */}
        {tx.hash && (
          <div className="border-t border-white/10 bg-black/20 px-3.5 py-2 flex items-center justify-between gap-2">
            <code className="font-mono text-[11px] text-white/60 truncate">
              {short(tx.hash)}
            </code>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={copyHash}
                className="text-white/50 hover:text-white text-[11px] font-mono"
              >
                Copy
              </button>
              {txLink && (
                <a
                  href={txLink}
                  target="_blank"
                  rel="noopener"
                  className="text-plasma/80 hover:text-plasma text-[11px] font-mono inline-flex items-center gap-1"
                >
                  Explorer <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>
        )}

        {/* Animated bottom progress strip while in-flight */}
        {(tx.status === 'awaiting_signature' || tx.status === 'pending') && (
          <div className="h-0.5 bg-white/5 overflow-hidden">
            <div className={`h-full ${tx.status === 'pending' ? 'bg-ice' : 'bg-plasma'} animate-tx-progress`} />
          </div>
        )}
      </div>
    </div>
  )
}
