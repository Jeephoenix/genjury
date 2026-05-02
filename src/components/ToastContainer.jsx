import React from 'react'
import { Info, Check, X, AlertTriangle, Sparkles, MessageSquare } from 'lucide-react'
import useGameStore from '../lib/store'

const VARIANTS = {
  info:    { Icon: Info,          color: 'text-ice',    border: 'border-ice/35',    bg: 'bg-ice/[0.07]',    dot: 'bg-ice' },
  success: { Icon: Check,         color: 'text-neon',   border: 'border-neon/35',   bg: 'bg-neon/[0.07]',   dot: 'bg-neon' },
  error:   { Icon: X,             color: 'text-signal', border: 'border-signal/35', bg: 'bg-signal/[0.07]', dot: 'bg-signal' },
  warning: { Icon: AlertTriangle, color: 'text-gold',   border: 'border-gold/35',   bg: 'bg-gold/[0.07]',   dot: 'bg-gold' },
  xp:      { Icon: Sparkles,      color: 'text-gold',   border: 'border-gold/40',   bg: 'bg-gold/[0.08]',   dot: 'bg-gold' },
}

export default function ToastContainer() {
  const toasts = useGameStore((s) => s.toasts)

  return (
    <div
      className="fixed top-20 right-4 z-[90] flex flex-col gap-2.5 w-[min(88vw,340px)]"
      aria-live="polite"
    >
      {toasts.map((toast) => {
        const v = VARIANTS[toast.type] || { Icon: MessageSquare, color: 'text-white/60', border: 'border-white/20', bg: 'bg-white/[0.05]', dot: 'bg-white/40' }
        const { Icon, color, border, bg, dot } = v
        return (
          <div
            key={toast.id}
            className={`toast glass-strong rounded-2xl border ${border} ${bg} flex items-start gap-3 px-4 py-3.5 shadow-2xl overflow-hidden`}
          >
            {/* Left accent bar */}
            <div className={`absolute left-0 inset-y-0 w-[3px] ${dot} rounded-l-2xl opacity-80`} />

            <div className={`w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 ${bg} border ${border} mt-0.5`}>
              <Icon className={`w-3.5 h-3.5 ${color}`} strokeWidth={2.5} />
            </div>

            <div className="flex-1 min-w-0">
              {toast.type === 'xp' && (
                <p className="text-gold text-[10px] font-mono uppercase tracking-widest mb-0.5 font-semibold">
                  XP Earned
                </p>
              )}
              <p className="text-sm text-white/90 leading-snug">{toast.message}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
