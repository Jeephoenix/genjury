import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, Zap, ArrowRight, CheckCircle2, XCircle, RefreshCw } from 'lucide-react'
import {
  isInjectedActive,
  hasInjectedProvider,
  myAddress,
  getChain,
  getNetworkInfo,
  getChainNativeSymbol,
  getGenBalanceWei,
  formatGen,
  subscribeWallet,
  getChosenProvider,
  switchToCorrectChain,
} from '../lib/genlayer'
import useGameStore from '../lib/store'

// States: 'idle' | 'switching' | 'success' | 'error'
const STEP_LABELS = ['Requesting…', 'Confirm in wallet', 'Switching…']

export default function NetworkBanner() {
  const [wrongChain, setWrongChain]   = useState(false)
  const [balanceWei, setBalanceWei]   = useState(null)
  const [switchState, setSwitchState] = useState('idle')   // idle | switching | success | error
  const [stepIdx, setStepIdx]         = useState(0)
  const [errMsg, setErrMsg]           = useState('')
  const [, force]                     = useState(0)

  const phase    = useGameStore(s => s.phase)
  const roomCode = useGameStore(s => s.roomCode)
  const net      = getNetworkInfo()
  const symbol   = getChainNativeSymbol()
  const address  = myAddress()

  useEffect(() => subscribeWallet(() => force(n => n + 1)), [])

  // ── Chain-check ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isInjectedActive() || !hasInjectedProvider()) {
      setWrongChain(false)
      return
    }
    const provider = getChosenProvider() || window.ethereum
    if (!provider) return
    const expected = `0x${getChain().id.toString(16)}`

    const check = async () => {
      try {
        const cur = await provider.request({ method: 'eth_chainId' })
        const wrong = cur !== expected
        setWrongChain(wrong)
        if (!wrong && switchState === 'switching') {
          setSwitchState('success')
          setTimeout(() => setSwitchState('idle'), 2200)
        }
      } catch {
        setWrongChain(false)
      }
    }

    check()
    provider.on?.('chainChanged', check)
    return () => provider.removeListener?.('chainChanged', check)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address])

  // ── Balance poll ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!address) return
    let cancelled = false
    const tick = async () => {
      try {
        const wei = await getGenBalanceWei(address)
        if (!cancelled) setBalanceWei(wei)
      } catch {}
    }
    tick()
    const id = setInterval(tick, 30_000)
    return () => { cancelled = true; clearInterval(id) }
  }, [address])

  // ── Switch handler ───────────────────────────────────────────────────────────
  const switchChain = async () => {
    if (switchState === 'switching') return
    setSwitchState('switching')
    setErrMsg('')
    setStepIdx(0)

    // Step animation
    const t1 = setTimeout(() => setStepIdx(1), 600)
    const t2 = setTimeout(() => setStepIdx(2), 1400)

    try {
      const provider = getChosenProvider() || window.ethereum
      // switchToCorrectChain handles both wallet_switchEthereumChain AND
      // the 4902 fallback (wallet_addEthereumChain) for unknown chains.
      const ok = await switchToCorrectChain(provider)
      clearTimeout(t1); clearTimeout(t2)

      if (ok) {
        setSwitchState('success')
        // success flash then hide banner if chain is now correct
        setTimeout(() => setSwitchState('idle'), 2400)
      } else {
        setSwitchState('error')
        setErrMsg('Switch cancelled')
        setTimeout(() => setSwitchState('idle'), 3500)
      }
    } catch (err) {
      clearTimeout(t1); clearTimeout(t2)
      const code = err?.code ?? err?.data?.originalError?.code
      if (code === 4001 || /reject|cancel|denied/i.test(err?.message || '')) {
        setSwitchState('error')
        setErrMsg('Rejected in wallet')
      } else {
        setSwitchState('error')
        setErrMsg('Switch failed — try manually')
      }
      setTimeout(() => setSwitchState('idle'), 3500)
    }
  }

  // ── Wrong-chain banner ───────────────────────────────────────────────────────
  if (wrongChain) {
    return (
      <div className="fixed top-0 inset-x-0 z-[80]" role="alert" aria-live="assertive">
        {/* Animated gradient bar */}
        <div className="relative overflow-hidden bg-[#1a0a00] border-b border-signal/40">
          {/* Sweep shimmer */}
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-signal/10 to-transparent pointer-events-none"
            animate={{ x: ['-100%', '150%'] }}
            transition={{ duration: 2.8, repeat: Infinity, ease: 'linear', repeatDelay: 1.2 }}
          />

          <div className="relative px-4 py-2.5 flex items-center justify-center gap-3">
            <AnimatePresence mode="wait">

              {/* ── Idle state ── */}
              {switchState === 'idle' && (
                <motion.div
                  key="idle"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  transition={{ duration: 0.18 }}
                  className="flex items-center gap-3 flex-wrap justify-center"
                >
                  <div className="flex items-center gap-2">
                    {/* Pulsing dot */}
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-signal opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-signal" />
                    </span>
                    <span className="text-signal text-xs font-semibold tracking-wide">Wrong network</span>
                    <span className="text-signal/50 text-xs hidden sm:inline">— not on {net.label}</span>
                  </div>
                  <button
                    onClick={switchChain}
                    className="group relative inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg overflow-hidden text-xs font-bold transition-all active:scale-95"
                    style={{ background: 'linear-gradient(135deg, rgba(255,100,0,0.25), rgba(255,60,0,0.15))', border: '1px solid rgba(255,100,0,0.5)' }}
                  >
                    {/* Button shimmer on hover */}
                    <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500" />
                    <Zap className="w-3 h-3 text-signal flex-shrink-0" strokeWidth={2.5} />
                    <span className="text-signal relative">Switch to {net.label}</span>
                  </button>
                </motion.div>
              )}

              {/* ── Switching state ── */}
              {switchState === 'switching' && (
                <motion.div
                  key="switching"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  transition={{ duration: 0.18 }}
                  className="flex items-center gap-3"
                >
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-signal" strokeWidth={2.25} />
                  </motion.div>
                  <span className="text-signal text-xs font-semibold">
                    {STEP_LABELS[stepIdx]}
                  </span>
                  {/* Dot progress */}
                  <div className="flex gap-1">
                    {STEP_LABELS.map((_, i) => (
                      <motion.span
                        key={i}
                        animate={{ opacity: i <= stepIdx ? 1 : 0.25, scale: i === stepIdx ? 1.25 : 1 }}
                        transition={{ duration: 0.2 }}
                        className="w-1.5 h-1.5 rounded-full bg-signal inline-block"
                      />
                    ))}
                  </div>
                </motion.div>
              )}

              {/* ── Success state ── */}
              {switchState === 'success' && (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ type: 'spring', damping: 16, stiffness: 400 }}
                  className="flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4 text-neon" strokeWidth={2.25} />
                  <span className="text-neon text-xs font-semibold">Switched to {net.label}!</span>
                </motion.div>
              )}

              {/* ── Error state ── */}
              {switchState === 'error' && (
                <motion.div
                  key="error"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  className="flex items-center gap-2.5 flex-wrap justify-center"
                >
                  <div className="flex items-center gap-1.5">
                    <XCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" strokeWidth={2.25} />
                    <span className="text-red-400 text-xs font-semibold">{errMsg}</span>
                  </div>
                  <button
                    onClick={switchChain}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-bold hover:bg-red-500/25 transition-all active:scale-95"
                  >
                    <RefreshCw className="w-3 h-3" strokeWidth={2.5} />
                    Retry
                  </button>
                </motion.div>
              )}

            </AnimatePresence>
          </div>
        </div>

        {/* Bottom accent line — animated gradient */}
        <motion.div
          className="h-[2px]"
          style={{ background: 'linear-gradient(90deg, transparent, #ff6400, #ff3000, #ff6400, transparent)' }}
          animate={{ backgroundPosition: ['0% 50%', '200% 50%'] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
        />
      </div>
    )
  }

  // ── Low-balance banner ───────────────────────────────────────────────────────
  const lowBalance = balanceWei !== null && balanceWei < 1n * 10n ** 16n
  if (lowBalance && roomCode && net.faucet) {
    return (
      <div className="fixed top-0 inset-x-0 z-[80]" role="status" aria-live="polite">
        <div className="bg-plasma/12 border-b border-plasma/35 backdrop-blur-xl px-4 py-2.5 flex items-center justify-center gap-3">
          <div className="flex items-center gap-2.5 flex-wrap justify-center">
            <span className="text-plasma/80 text-xs">
              Low balance:{' '}
              <span className="text-plasma font-semibold font-mono">{formatGen(balanceWei, 4)} {symbol}</span>
            </span>
            <a
              href={`${net.faucet}?address=${address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-plasma/20 border border-plasma/35 text-plasma text-xs font-bold hover:bg-plasma/30 hover:border-plasma/55 transition-all"
            >
              Get test {symbol}
              <ArrowRight className="w-3 h-3" strokeWidth={2.5} />
            </a>
          </div>
        </div>
        <div className="h-[2px] bg-gradient-to-r from-transparent via-plasma/50 to-transparent" />
      </div>
    )
  }

  return null
}
