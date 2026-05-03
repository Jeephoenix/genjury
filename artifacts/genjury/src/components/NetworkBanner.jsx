import React, { useEffect, useState } from 'react'
import { AlertTriangle, Zap, ArrowRight, ExternalLink } from 'lucide-react'
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
} from '../lib/genlayer'
import useGameStore from '../lib/store'

export default function NetworkBanner() {
  const [wrongChain, setWrongChain] = useState(false)
  const [balanceWei, setBalanceWei] = useState(null)
  const [switching, setSwitching] = useState(false)
  const [, force] = useState(0)

  const phase = useGameStore(s => s.phase)
  const roomCode = useGameStore(s => s.roomCode)
  const net = getNetworkInfo()
  const symbol = getChainNativeSymbol()
  const address = myAddress()

  useEffect(() => subscribeWallet(() => force(n => n + 1)), [])

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
        setWrongChain(cur !== expected)
      } catch { setWrongChain(false) }
    }
    check()
    const onChainChanged = () => check()
    provider.on?.('chainChanged', onChainChanged)
    return () => provider.removeListener?.('chainChanged', onChainChanged)
  }, [address])

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
    const id = setInterval(tick, 30000)
    return () => { cancelled = true; clearInterval(id) }
  }, [address])

  const switchChain = async () => {
    setSwitching(true)
    try {
      const provider = getChosenProvider() || window.ethereum
      if (!provider) return
      await provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${getChain().id.toString(16)}` }],
      })
    } catch {} finally {
      setSwitching(false)
    }
  }

  if (wrongChain) {
    return (
      <div className="fixed top-0 inset-x-0 z-[80]" role="alert" aria-live="assertive">
        <div className="bg-signal/18 border-b border-signal/50 backdrop-blur-xl px-4 py-3 flex items-center justify-center gap-3">
          <div className="flex items-center gap-2.5 flex-wrap justify-center">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-signal flex-shrink-0" strokeWidth={2.25} />
              <span className="text-signal text-xs font-semibold">Wrong network</span>
              <span className="text-signal/65 text-xs hidden sm:inline">— your wallet is on the wrong chain.</span>
            </div>
            <button
              onClick={switchChain}
              disabled={switching}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-signal/20 border border-signal/40 text-signal text-xs font-bold hover:bg-signal/30 hover:border-signal/60 transition-all active:scale-95 disabled:opacity-50"
            >
              {switching ? (
                <span className="w-3 h-3 border border-signal border-t-transparent rounded-full animate-spin flex-shrink-0" />
              ) : (
                <Zap className="w-3 h-3 flex-shrink-0" strokeWidth={2.5} />
              )}
              Switch to {net.label}
            </button>
          </div>
        </div>
        <div className="h-[2px] bg-gradient-to-r from-transparent via-signal/60 to-transparent" />
      </div>
    )
  }

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
              rel="noopener"
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
