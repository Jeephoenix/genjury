import React, { useEffect } from 'react'
import { X, ScrollText } from 'lucide-react'

export default function TermsModal({ onClose }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Terms of Service"
    >
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative w-full sm:max-w-2xl max-h-[90dvh] flex flex-col glass rounded-t-2xl sm:rounded-2xl border border-white/[0.09] overflow-hidden animate-slide-up">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/30 to-transparent" />

        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-white/[0.07] flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gold/10 border border-gold/25 flex items-center justify-center">
              <ScrollText className="w-4 h-4 text-gold" strokeWidth={2} />
            </div>
            <div>
              <h2 className="font-display font-bold text-base text-white">Terms of Service</h2>
              <p className="text-white/30 text-[10px] font-mono">Last updated: May 2025</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/[0.05] hover:bg-white/[0.10] border border-white/[0.08] flex items-center justify-center transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4 text-white/50" strokeWidth={2} />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5 space-y-5 text-white/60 text-sm leading-relaxed">

          <section className="rounded-xl bg-signal/[0.07] border border-signal/20 px-4 py-3">
            <p className="text-signal/90 text-xs font-mono font-semibold uppercase tracking-wider mb-1">Testnet only</p>
            <p className="text-white/55 text-xs">Genjury operates exclusively on GenLayer test networks. All in-game tokens and XP have no monetary value and cannot be exchanged for real currency or assets.</p>
          </section>

          <section>
            <h3 className="font-semibold text-white/85 mb-2">1. Acceptance of terms</h3>
            <p>
              By accessing or using Genjury (the "Application") you agree to be bound by these Terms of Service ("Terms"). If you do not agree, do not use the Application.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-white/85 mb-2">2. Eligibility</h3>
            <p>You must be at least 13 years of age to use Genjury. By using the Application you represent that you meet this requirement. The Application is intended for entertainment purposes only.</p>
          </section>

          <section>
            <h3 className="font-semibold text-white/85 mb-2">3. Testnet tokens and XP</h3>
            <p>
              All tokens and XP points within Genjury are testnet assets with zero real-world monetary value. They cannot be withdrawn, sold, or exchanged for any currency or item of value.
              We reserve the right to reset testnet state, modify token amounts, or alter game mechanics at any time without notice.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-white/85 mb-2">4. Your wallet</h3>
            <p>
              You are solely responsible for the security of your browser wallet and private keys. Genjury never has access to your private keys. We are not liable for any loss resulting from unauthorised access to your wallet.
              Only connect wallets that do not hold real assets — use a dedicated testnet wallet.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-white/85 mb-2">5. Acceptable use</h3>
            <p className="mb-2">You agree not to:</p>
            <ul className="space-y-1.5 list-none">
              {[
                'Exploit bugs, vulnerabilities, or unintended mechanics for unfair advantage.',
                'Attempt to manipulate or interfere with the GenLayer contract or network.',
                'Impersonate other players or claim usernames that are misleading or harmful.',
                'Use the Application for any unlawful purpose.',
                'Engage in behaviour that harasses or harms other players.',
              ].map((item, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-gold flex-shrink-0 mt-0.5">·</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3 className="font-semibold text-white/85 mb-2">6. On-chain data</h3>
            <p>
              Game actions (statements, votes, objections) are submitted as blockchain transactions and are permanently public. You are responsible for the content of any statements you submit.
              Do not include personally identifiable information, offensive content, or anything you would not want permanently recorded on a public blockchain.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-white/85 mb-2">7. Intellectual property</h3>
            <p>
              The Genjury source code is released under the MIT licence. The "Genjury" name, logo, and game concept are the property of the respective creators.
              GenLayer and its associated trademarks belong to Yeager AI.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-white/85 mb-2">8. Disclaimer of warranties</h3>
            <p>
              Genjury is provided "as is" and "as available" without warranty of any kind. We do not warrant that the Application will be uninterrupted, error-free, or secure.
              Because this is a testnet application, expect instability, resets, and breaking changes.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-white/85 mb-2">9. Limitation of liability</h3>
            <p>
              To the maximum extent permitted by law, the creators of Genjury shall not be liable for any indirect, incidental, or consequential damages arising from your use of the Application,
              including but not limited to loss of data or wallet assets.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-white/85 mb-2">10. Changes to terms</h3>
            <p>We reserve the right to modify these Terms at any time. Continued use of the Application after changes constitutes your acceptance of the revised Terms.</p>
          </section>

          <section>
            <h3 className="font-semibold text-white/85 mb-2">11. Contact</h3>
            <p>
              For questions or reports, open an issue on the <a href="https://github.com/Jeephoenix/genjury" target="_blank" rel="noopener" className="text-gold/70 hover:text-gold underline underline-offset-2 transition-colors">GitHub repository</a>.
            </p>
          </section>

        </div>

        <div className="px-6 py-4 border-t border-white/[0.07] flex-shrink-0">
          <button
            onClick={onClose}
            className="btn w-full py-2.5 text-sm font-semibold bg-white/[0.06] hover:bg-white/[0.10] border border-white/[0.10] text-white/70 hover:text-white transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
