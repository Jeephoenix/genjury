import React, { useEffect } from 'react'
import { X, Shield } from 'lucide-react'

export default function PrivacyPolicyModal({ onClose }) {
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
      aria-label="Privacy Policy"
    >
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative w-full sm:max-w-2xl max-h-[90dvh] flex flex-col glass rounded-t-2xl sm:rounded-2xl border border-white/[0.09] overflow-hidden animate-slide-up">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-plasma/30 to-transparent" />

        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-white/[0.07] flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-plasma/10 border border-plasma/25 flex items-center justify-center">
              <Shield className="w-4 h-4 text-plasma" strokeWidth={2} />
            </div>
            <div>
              <h2 className="font-display font-bold text-base text-white">Privacy Policy</h2>
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

          <section>
            <h3 className="font-semibold text-white/85 mb-2">1. Overview</h3>
            <p>
              Genjury ("we", "the game", "the application") is a testnet blockchain game built on the GenLayer network.
              This Privacy Policy explains what information is collected, how it is used, and your rights regarding that information.
              By using Genjury you agree to the practices described here.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-white/85 mb-2">2. Information we collect</h3>
            <ul className="space-y-2 list-none">
              <li className="flex gap-2">
                <span className="text-plasma flex-shrink-0 mt-0.5">·</span>
                <span><strong className="text-white/75">Wallet address.</strong> When you connect a wallet, your public Ethereum-compatible address is read from the browser provider. This address is used to identify your game sessions and record XP on-chain. We never have access to private keys.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-plasma flex-shrink-0 mt-0.5">·</span>
                <span><strong className="text-white/75">Username.</strong> If you claim an identity in-game, your chosen username is stored in the Genjury Intelligent Contract on the GenLayer testnet. This is a public blockchain — anyone can read it.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-plasma flex-shrink-0 mt-0.5">·</span>
                <span><strong className="text-white/75">Game actions.</strong> Statements, votes, confidence levels, and objection votes are submitted as on-chain transactions. All on-chain data is permanently public by nature of the blockchain.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-plasma flex-shrink-0 mt-0.5">·</span>
                <span><strong className="text-white/75">Local storage.</strong> Preferences such as onboarding status are stored in your browser's local storage. This data never leaves your device.</span>
              </li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold text-white/85 mb-2">3. What we do not collect</h3>
            <p>We do not collect your name, email address, IP address, or any personally identifiable information beyond your public wallet address. We do not run advertising networks or sell data to third parties.</p>
          </section>

          <section>
            <h3 className="font-semibold text-white/85 mb-2">4. Third-party services</h3>
            <p>
              Genjury interacts with the GenLayer blockchain network. On-chain interactions are processed by GenLayer's infrastructure.
              Please review <a href="https://genlayer.com" target="_blank" rel="noopener" className="text-plasma/70 hover:text-plasma underline underline-offset-2 transition-colors">GenLayer's own policies</a> for how they handle network data.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-white/85 mb-2">5. Cookies</h3>
            <p>Genjury does not use tracking cookies or analytics cookies. The application may use browser local storage for session preferences only.</p>
          </section>

          <section>
            <h3 className="font-semibold text-white/85 mb-2">6. Data retention</h3>
            <p>
              Data stored in local storage remains on your device until you clear it. On-chain data is permanent and cannot be deleted — this is an inherent property of public blockchains.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-white/85 mb-2">7. Testnet notice</h3>
            <p>
              Genjury operates exclusively on GenLayer testnets. All tokens, XP, and rewards have no monetary value. Do not use wallets containing real assets.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-white/85 mb-2">8. Changes to this policy</h3>
            <p>We may update this Privacy Policy from time to time. Changes will be reflected by an updated date at the top of this document. Continued use of Genjury after changes constitutes acceptance.</p>
          </section>

          <section>
            <h3 className="font-semibold text-white/85 mb-2">9. Contact</h3>
            <p>
              Questions about this policy can be directed via the <a href="https://github.com/Jeephoenix/genjury" target="_blank" rel="noopener" className="text-plasma/70 hover:text-plasma underline underline-offset-2 transition-colors">GitHub repository</a>.
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
