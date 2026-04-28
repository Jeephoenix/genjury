import React, { useEffect, useState } from 'react'
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
} from '../lib/genlayer'
import useGameStore from '../lib/store'

export default function NetworkBanner() {
  const [wrongChain, setWrongChain] = useState(false)
  const [balanceWei, setBalanceWei] = useState(null)
  const [, force] = useState(0)

  const phase = useGameStore(s => s.phase)
  const roomCode = useGameStore(s => s.roomCode)
  const net = getNetworkInfo()
  const symbol = getChainNativeSymbol()
  const address = myAddress()

  useEffect(() => subscribeWallet(() => force(n => n + 1)), [])

  // Watch MetaMask chain id whenever it changes.
  useEffect(() => {
    if (!isInjectedActive() || !hasInjectedProvider()) {
      setWrongChain(false)
      return
    }
    const expected = `0x${getChain().id.toString(16)}`
    const check = async () => {
      try {
        const cur = await window.ethereum.request({ method: 'eth_chainId' })
        setWrongChain(cur !== expected)
      } catch { setWrongChain(false) }
    }
    check()
    const onChainChanged = () => check()
    window.ethereum.on?.('chainChanged', onChainChanged)
    return () => window.ethereum.removeListener?.('chainChanged', onChainChanged)
  }, [address])

  // Poll balance every 30s so the low-balance hint stays fresh.
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
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${getChain().id.toString(16)}` }],
      })
    } catch {}
  }

  if (wrongChain) {
    return (
      <div className="fixed top-0 inset-x-0 z-[80] bg-signal/20 border-b border-signal/40 backdrop-blur px-4 py-2 text-center text-sm text-signal">
        Wrong network — your wallet is on the wrong chain.{' '}
        <button onClick={switchChain} className="underline font-semibold hover:text-white">
          Switch to {net.label}
        </button>
      </div>
    )
  }

  // Low-balance nudge: only show when in a room and balance is dust.
  const lowBalance = balanceWei !== null && balanceWei < 1n * 10n ** 16n // < 0.01 GEN
  if (lowBalance && roomCode && net.faucet) {
    return (
      <div className="fixed top-0 inset-x-0 z-[80] bg-plasma/15 border-b border-plasma/30 backdrop-blur px-4 py-2 text-center text-sm text-plasma">
        Low balance: {formatGen(balanceWei, 4)} {symbol}.{' '}
        <a
          href={`${net.faucet}?address=${address}`}
          target="_blank"
          rel="noopener"
          className="underline font-semibold hover:text-white"
        >
          Get test {symbol} →
        </a>
      </div>
    )
  }

  return null
}
