import React, { useState } from 'react'
import { getNetworkInfo, getContractAddress, getExplorerBaseUrl } from '../lib/genlayer'
import { Github, ExternalLink, Copy, Check } from 'lucide-react'

const short = (a) => a ? `${a.slice(0, 6)}…${a.slice(-4)}` : null

export default function Footer() {
  const net    = getNetworkInfo()
  const [copied, setCopied] = useState(false)

  const copyAddr = (addr) => {
    navigator.clipboard?.writeText(addr).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  return (
    <footer className="relative z-10 mt-16 border-t border-white/[0.06]">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-plasma/20 to-transparent" />

      <div className="max-w-6xl mx-auto px-6 pt-8 pb-28 md:pb-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-5">
          <div className="flex flex-col items-center sm:items-start gap-1.5">
            <div className="flex items-center gap-2">
              <span className="font-brand font-extrabold text-sm text-white tracking-tight">
                Gen<span className="text-crimson text-glow-crimson">jury</span>
              </span>
              <span className="badge bg-white/[0.05] border border-white/[0.09] text-white/35 font-mono text-[10px] tracking-widest">
                {net.label}
              </span>
            </div>
            <p className="text-white/20 text-[11px] max-w-xs text-center sm:text-left leading-relaxed">
              Testnet only. Tokens have no monetary value. Not financial advice.
            </p>
          </div>

          <div className="flex flex-col items-center sm:items-end gap-2">
            {(() => {
                const addr = getContractAddress()
                if (!addr) return null
                // Use getExplorerBaseUrl() which checks NETWORK_INFO → chain.blockExplorers
                const explorerBase = getExplorerBaseUrl()
                const explorerHref = explorerBase ? `${explorerBase}/address/${addr}` : null
                return (
                  <div className="flex items-center gap-1.5">
                    <span className="text-white/20 text-[10px] font-mono uppercase tracking-wider">Contract</span>
                    {explorerHref ? (
                      <a
                        href={explorerHref}
                        target="_blank"
                        rel="noopener"
                        title={addr}
                        className="font-mono text-[11px] text-plasma/55 hover:text-plasma transition-colors inline-flex items-center gap-1 group"
                      >
                        {short(addr)}
                        <ExternalLink className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" strokeWidth={2.25} />
                      </a>
                    ) : (
                      /* No explorer available for this network — copy-to-clipboard */
                      <button
                        type="button"
                        onClick={() => copyAddr(addr)}
                        title={`Copy full address: ${addr}`}
                        className="font-mono text-[11px] text-plasma/55 hover:text-plasma inline-flex items-center gap-1 group transition-colors cursor-pointer"
                      >
                        {copied
                          ? <><Check className="w-2.5 h-2.5 text-neon" strokeWidth={2.5} /><span className="text-neon text-[10px]">Copied!</span></>
                          : <>{short(addr)}<Copy className="w-2.5 h-2.5 opacity-0 group-hover:opacity-60 transition-opacity" strokeWidth={2.25} /></>
                        }
                      </button>
                    )}
                  </div>
                )
              })()}

            <div className="flex items-center gap-3">
              <a
                href="https://github.com/Jeephoenix/genjury"
                target="_blank"
                rel="noopener"
                className="text-white/20 hover:text-white/55 transition-colors inline-flex items-center gap-1 text-[11px] font-mono group"
                aria-label="View on GitHub"
              >
                <Github className="w-3.5 h-3.5" />
                GitHub
              </a>
              <span className="text-white/10 text-[10px]">·</span>
              <a
                href="https://genlayer.com"
                target="_blank"
                rel="noopener"
                className="text-plasma/35 hover:text-plasma/70 transition-colors text-[11px] font-mono"
              >
                GenLayer
              </a>
              <span className="text-white/10 text-[10px]">·</span>
              <span className="text-white/18 text-[11px] font-mono">Optimistic Democracy</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
