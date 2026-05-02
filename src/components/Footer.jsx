import React from 'react'
import { getNetworkInfo } from '../lib/genlayer'
import { Github, ExternalLink } from 'lucide-react'

const CONTRACT = import.meta.env.VITE_GENJURY_CONTRACT || null
const short = (a) => a ? `${a.slice(0, 6)}…${a.slice(-4)}` : null

export default function Footer() {
  const net = getNetworkInfo()
  const explorerLink = CONTRACT && net.explorer ? `${net.explorer}/address/${CONTRACT}` : null

  return (
    <footer className="relative z-10 mt-16 px-6 pt-8 pb-28 md:pb-8 border-t border-white/5">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Brand + network */}
        <div className="flex flex-col items-center sm:items-start gap-1.5">
          <div className="flex items-center gap-2">
            <span className="font-display font-800 text-sm text-white">
              Gen<span className="text-neon">jury</span>
            </span>
            <span className="badge bg-white/5 border border-white/10 text-white/40 font-mono text-[10px] tracking-widest">
              {net.label}
            </span>
          </div>
          <p className="text-white/20 text-[11px] max-w-xs text-center sm:text-left">
            Testnet only. Tokens have no monetary value. Not financial advice.
          </p>
        </div>

        {/* Contract + links */}
        <div className="flex flex-col items-center sm:items-end gap-2">
          {CONTRACT && (
            <div className="flex items-center gap-1.5">
              <span className="text-white/25 text-[10px] font-mono uppercase tracking-wider">Contract</span>
              {explorerLink ? (
                <a
                  href={explorerLink}
                  target="_blank"
                  rel="noopener"
                  className="font-mono text-[11px] text-plasma/60 hover:text-plasma transition-colors inline-flex items-center gap-1"
                >
                  {short(CONTRACT)}
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              ) : (
                <span className="font-mono text-[11px] text-white/30">{short(CONTRACT)}</span>
              )}
            </div>
          )}
          <div className="flex items-center gap-3">
            <a
              href="https://github.com/Jeephoenix/genjury"
              target="_blank"
              rel="noopener"
              className="text-white/25 hover:text-white/60 transition-colors inline-flex items-center gap-1 text-[11px] font-mono"
            >
              <Github className="w-3.5 h-3.5" />
              GitHub
            </a>
            <span className="text-white/15 text-[10px]">·</span>
            <a
              href="https://genlayer.com"
              target="_blank"
              rel="noopener"
              className="text-plasma/40 hover:text-plasma transition-colors text-[11px] font-mono"
            >
              GenLayer
            </a>
            <span className="text-white/15 text-[10px]">·</span>
            <span className="text-white/20 text-[11px] font-mono">Optimistic Democracy</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
