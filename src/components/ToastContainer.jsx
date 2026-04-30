import React from 'react'
import { Info, Check, X, AlertTriangle, Sparkles, MessageSquare } from 'lucide-react'
import useGameStore from '../lib/store'

const ICONS = {
  info:    { Icon: Info,           color: 'text-ice' },
  success: { Icon: Check,          color: 'text-neon' },
  error:   { Icon: X,              color: 'text-signal' },
  warning: { Icon: AlertTriangle,  color: 'text-gold' },
  xp:      { Icon: Sparkles,       color: 'text-gold' },
}
const BORDERS = { info: 'border-ice/40', success: 'border-neon/40', error: 'border-signal/40', warning: 'border-gold/40', xp: 'border-gold/40' }

export default function ToastContainer() {
  const toasts = useGameStore(s => s.toasts)

  return (
    <div className="fixed top-20 right-4 z-50 flex flex-col gap-2 max-w-xs">
      {toasts.map(toast => {
        const def = ICONS[toast.type] || { Icon: MessageSquare, color: 'text-white/60' }
        const { Icon, color } = def
        return (
          <div
            key={toast.id}
            className={`toast glass rounded-xl px-4 py-3 border ${BORDERS[toast.type] || BORDERS.info} flex items-start gap-3 shadow-xl`}
          >
            <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${color}`} strokeWidth={2.25} />
            <p className="text-sm text-white/90 leading-snug">{toast.message}</p>
          </div>
        )
      })}
    </div>
  )
}
