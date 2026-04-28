import React from 'react'
import useGameStore from '../lib/store'

const ICONS = { info: 'ℹ️', success: '✅', error: '❌', warning: '⚠️', xp: '⭐' }
const BORDERS = { info: 'border-ice/40', success: 'border-neon/40', error: 'border-signal/40', warning: 'border-gold/40', xp: 'border-gold/40' }

export default function ToastContainer() {
  const toasts = useGameStore(s => s.toasts)

  return (
    <div className="fixed top-20 right-4 z-50 flex flex-col gap-2 max-w-xs">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`toast glass rounded-xl px-4 py-3 border ${BORDERS[toast.type] || BORDERS.info} flex items-start gap-3 shadow-xl`}
        >
          <span className="text-lg flex-shrink-0 mt-0.5">{ICONS[toast.type] || '💬'}</span>
          <p className="text-sm text-white/90 leading-snug">{toast.message}</p>
        </div>
      ))}
    </div>
  )
}
