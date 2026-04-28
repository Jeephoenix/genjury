// ──────────────────────────────────────────────────────────────────────────────
// GenLayer JS SDK wrapper for the Genjury frontend.
//
// Wallet model: a real Web3 wallet (MetaMask et al.) reached through
// window.ethereum. The user signs every transaction. There is no burner
// fallback — the app refuses to deploy/call/read on behalf of "no one."
// ──────────────────────────────────────────────────────────────────────────────

import { createClient } from 'genlayer-js'
import {
  studionet,
  localnet,
  testnetAsimov,
  testnetBradbury,
} from 'genlayer-js/chains'

import contractSource from '../../contracts/genjury.py?raw'

// ── localStorage keys ───────────────────────────────────────────────────────
const STORAGE_ROOM     = 'genjury_last_room'
const STORAGE_INJECTED = 'genjury_injected_address'   // last connected EOA

// ── Module-level cache ──────────────────────────────────────────────────────
let _injectedAddress = null
let _client          = null
const _listeners     = new Set()
const _txListeners   = new Set()
let _txSeq           = 0

// ──────────────────────────────────────────────────────────────────────────────
// Wallet event bus
// ──────────────────────────────────────────────────────────────────────────────
export function subscribeWallet(fn) {
  _listeners.add(fn)
  return () => _listeners.delete(fn)
}

function notify() {
  for (const fn of _listeners) {
    try { fn() } catch {}
  }
}

// ── Transaction lifecycle event bus ─────────────────────────────────────────
// Anyone (typically the store + a UI banner) can subscribe to be notified
// whenever a write hits a new lifecycle stage. Events have the shape:
//   { id, label, status, hash?, error? }
// where status ∈ 'awaiting_signature' | 'pending' | 'confirmed' | 'failed'.
export function subscribeTx(fn) {
  _txListeners.add(fn)
  return () => _txListeners.delete(fn)
}

function emitTx(evt) {
  for (const fn of _txListeners) {
    try { fn(evt) } catch {}
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Injected wallet (window.ethereum / MetaMask)
// ──────────────────────────────────────────────────────────────────────────────
export function hasInjectedProvider() {
  return typeof window !== 'undefined' && !!window.ethereum
}

export function injectedAddress() {
  if (_injectedAddress) return _injectedAddress
  try {
    const stored = localStorage.getItem(STORAGE_INJECTED)
    if (stored) {
      _injectedAddress = stored
      return stored
    }
  } catch {}
  return null
}

function rememberInjected(addr) {
  _injectedAddress = addr
  try {
    if (addr) localStorage.setItem(STORAGE_INJECTED, addr)
    else localStorage.removeItem(STORAGE_INJECTED)
  } catch {}
}

async function ensureCorrectChain() {
  if (!hasInjectedProvider()) throw new Error('No Web3 wallet detected')
  const chain = getChain()
  const expected = `0x${chain.id.toString(16)}`
  let current
  try {
    current = await window.ethereum.request({ method: 'eth_chainId' })
  } catch {
    current = null
  }
  if (current === expected) return
  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: expected }],
    })
  } catch (err) {
    // 4902 = chain not added; offer to add it.
    const code = err?.code ?? err?.data?.originalError?.code
    if (code === 4902 || /unrecognized chain/i.test(err?.message || '')) {
      const rpcUrl = chain.rpcUrls?.default?.http?.[0]
      const explorerUrl = chain.blockExplorers?.default?.url
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: expected,
          chainName: chain.name,
          nativeCurrency: chain.nativeCurrency,
          rpcUrls: rpcUrl ? [rpcUrl] : [],
          blockExplorerUrls: explorerUrl ? [explorerUrl] : [],
        }],
      })
    } else {
      throw err
    }
  }
}

export async function connectInjectedWallet() {
  if (!hasInjectedProvider()) {
    throw new Error('No Web3 wallet found. Install MetaMask to continue.')
  }
  const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' })
  if (!accounts?.length) throw new Error('Wallet did not return any accounts')
  const addr = accounts[0]
  await ensureCorrectChain()
  rememberInjected(addr)
  _client = null
  notify()

  // Wire up account/chain change listeners exactly once.
  if (!window.ethereum.__genjuryWired) {
    window.ethereum.__genjuryWired = true
    window.ethereum.on?.('accountsChanged', (accs) => {
      if (!accs?.length) {
        rememberInjected(null)
      } else {
        rememberInjected(accs[0])
      }
      _client = null
      notify()
    })
    window.ethereum.on?.('chainChanged', () => {
      _client = null
      notify()
    })
  }

  return addr
}

export function disconnectInjectedWallet() {
  rememberInjected(null)
  _client = null
  notify()
}

// ──────────────────────────────────────────────────────────────────────────────
// Active address — what the rest of the app sees as "me". Returns null when
// no wallet is connected; the UI must gate gameplay accordingly.
// ──────────────────────────────────────────────────────────────────────────────
export function myAddress() {
  return injectedAddress()
}

export function isWalletConnected() {
  return !!injectedAddress()
}

// ──────────────────────────────────────────────────────────────────────────────
// Network / chain
//
// We default to GenLayer Testnet (Bradbury) — the network GenLayer recommends
// for production-like testing with real AI workloads. Asimov stays available
// for infrastructure testing if you set VITE_GENLAYER_NETWORK=asimov.
// ──────────────────────────────────────────────────────────────────────────────
const DEFAULT_NETWORK = 'bradbury'

const NETWORK_INFO = {
  bradbury: {
    label:    'GenLayer Testnet (Bradbury)',
    explorer: 'https://explorer-bradbury.genlayer.com',
    faucet:   'https://testnet-faucet.genlayer.foundation',
  },
  asimov: {
    label:    'GenLayer Testnet (Asimov)',
    explorer: 'https://explorer-asimov.genlayer.com',
    faucet:   'https://testnet-faucet.genlayer.foundation',
  },
  studionet: {
    label:    'GenLayer Studio (local)',
    explorer: null,
    faucet:   null,
  },
  localnet: {
    label:    'GenLayer Localnet',
    explorer: null,
    faucet:   null,
  },
}

function normalizeNetworkKey(raw) {
  const k = (raw || '').toLowerCase()
  if (!k)                                   return DEFAULT_NETWORK
  if (k === 'testnet')                      return DEFAULT_NETWORK   // legacy alias → bradbury
  if (k === 'testnetbradbury')              return 'bradbury'
  if (k === 'testnetasimov')                return 'asimov'
  if (NETWORK_INFO[k])                      return k
  return DEFAULT_NETWORK
}

export function getNetworkName() {
  return normalizeNetworkKey(import.meta.env.VITE_GENLAYER_NETWORK)
}

export function getNetworkInfo() {
  const key = getNetworkName()
  return { key, ...(NETWORK_INFO[key] || NETWORK_INFO[DEFAULT_NETWORK]) }
}

export function getChain() {
  const key = getNetworkName()
  if (key === 'studionet') return studionet
  if (key === 'localnet')  return localnet
  if (key === 'asimov')    return testnetAsimov
  return testnetBradbury
}

export function getChainNativeSymbol() {
  return getChain()?.nativeCurrency?.symbol || 'GEN'
}

// ──────────────────────────────────────────────────────────────────────────────
// Client — requires a connected wallet
// ──────────────────────────────────────────────────────────────────────────────
export function getClient() {
  if (_client) return _client

  const addr = injectedAddress()
  if (!addr) {
    throw new Error('Connect a Web3 wallet to continue.')
  }
  if (!hasInjectedProvider()) {
    throw new Error('No Web3 wallet detected in this browser.')
  }

  const baseChain = getChain()
  const overrideRpc = import.meta.env.VITE_GENLAYER_RPC
  const chain = overrideRpc
    ? { ...baseChain, rpcUrls: { default: { http: [overrideRpc] } } }
    : baseChain

  _client = createClient({
    chain,
    account: addr,
    provider: window.ethereum,
  })
  return _client
}

// ──────────────────────────────────────────────────────────────────────────────
// Reads / writes / deploys
// ──────────────────────────────────────────────────────────────────────────────
export async function readView(address, fn, args = []) {
  return await getClient().readContract({
    address,
    functionName: fn,
    args,
  })
}

export async function callMethod(address, fn, args = [], valueWei = 0n, label = null) {
  const client = getClient()
  const id = ++_txSeq
  const description = label || fn
  emitTx({ id, label: description, status: 'awaiting_signature' })
  let hash
  try {
    hash = await client.writeContract({
      address,
      functionName: fn,
      args,
      value: typeof valueWei === 'bigint' ? valueWei : BigInt(valueWei || 0),
    })
  } catch (e) {
    emitTx({ id, label: description, status: 'failed', error: friendlyTxError(e) })
    throw e
  }
  emitTx({ id, label: description, status: 'pending', hash })
  try {
    await client.waitForTransactionReceipt({ hash })
    emitTx({ id, label: description, status: 'confirmed', hash })
  } catch (e) {
    console.warn('[genjury] waitForTransactionReceipt:', e?.message || e)
    emitTx({ id, label: description, status: 'confirmed', hash })
  }
  return hash
}

/**
 * Deploy the Genjury contract.
 *
 * @param {object} opts
 * @param {number} opts.maxRounds        Total rounds in the game (>=1).
 * @param {bigint} opts.entryFeeWei      Wei each player pays to join (0 = free).
 * @param {number} opts.platformFeeBps   Basis points (0..2000) of every entry fee
 *                                       routed to the platform owner.
 * @param {string} opts.platformOwner    EOA that may claim platform fees. Empty
 *                                       string => deployer becomes owner.
 */
export async function deployGenjury({
  maxRounds = 3,
  entryFeeWei = 0n,
  platformFeeBps = 0,
  platformOwner = '',
} = {}) {
  const client = getClient()
  const id = ++_txSeq
  const label = 'Deploy Genjury contract'
  emitTx({ id, label, status: 'awaiting_signature' })
  let hash
  try {
    hash = await client.deployContract({
      code: contractSource,
      args: [
        Number(maxRounds),
        typeof entryFeeWei === 'bigint' ? entryFeeWei : BigInt(entryFeeWei || 0),
        Number(platformFeeBps) | 0,
        String(platformOwner || ''),
      ],
    })
  } catch (e) {
    emitTx({ id, label, status: 'failed', error: friendlyTxError(e) })
    throw e
  }
  emitTx({ id, label, status: 'pending', hash })
  let receipt
  try {
    receipt = await client.waitForTransactionReceipt({ hash })
  } catch (e) {
    emitTx({ id, label, status: 'failed', hash, error: friendlyTxError(e) })
    throw e
  }
  const addr =
    receipt?.txDataDecoded?.contractAddress ||
    receipt?.contractAddress ||
    receipt?.recipient ||
    receipt?.to_address
  if (!addr) {
    console.error('[genjury] deploy receipt:', receipt)
    emitTx({ id, label, status: 'failed', hash, error: 'Deployment finalized but no contract address was returned' })
    throw new Error('Deployment finalized but no contract address was returned')
  }
  emitTx({ id, label, status: 'confirmed', hash })
  return addr
}

function friendlyTxError(e) {
  if (!e) return 'Unknown error'
  if (typeof e === 'string') return e
  if (e.code === 4001 || /user rejected|user denied/i.test(e.message || '')) {
    return 'You rejected the request in your wallet.'
  }
  return e.shortMessage || e.message || String(e)
}

/**
 * Read the active wallet's GEN balance (wei). Returns 0n if no wallet is
 * connected or anything goes wrong.
 */
export async function getGenBalanceWei(addr) {
  const target = addr || myAddress()
  if (!target) return 0n

  if (hasInjectedProvider()) {
    try {
      const hex = await window.ethereum.request({
        method: 'eth_getBalance',
        params: [target, 'latest'],
      })
      return BigInt(hex || '0x0')
    } catch (e) {
      console.warn('[genjury] eth_getBalance via wallet:', e?.message || e)
    }
  }

  try {
    const chain = getChain()
    const rpc = import.meta.env.VITE_GENLAYER_RPC || chain?.rpcUrls?.default?.http?.[0]
    if (!rpc) return 0n
    const res = await fetch(rpc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'eth_getBalance',
        params: [target, 'latest'],
      }),
    })
    const data = await res.json()
    if (data?.result) return BigInt(data.result)
  } catch (e) {
    console.warn('[genjury] eth_getBalance via RPC:', e?.message || e)
  }
  return 0n
}

// ──────────────────────────────────────────────────────────────────────────────
// GEN amount formatting (wei <-> human strings)
// ──────────────────────────────────────────────────────────────────────────────
const GEN_DECIMALS = 18n

export function formatGen(wei, maxFractionDigits = 6) {
  let v
  try { v = typeof wei === 'bigint' ? wei : BigInt(wei || 0) }
  catch { return '0' }
  const negative = v < 0n
  if (negative) v = -v
  const base = 10n ** GEN_DECIMALS
  const whole = v / base
  const frac = v % base
  if (frac === 0n) return `${negative ? '-' : ''}${whole.toString()}`
  let fracStr = frac.toString().padStart(Number(GEN_DECIMALS), '0')
  if (maxFractionDigits >= 0 && maxFractionDigits < fracStr.length) {
    fracStr = fracStr.slice(0, maxFractionDigits)
  }
  fracStr = fracStr.replace(/0+$/, '')
  if (!fracStr) return `${negative ? '-' : ''}${whole.toString()}`
  return `${negative ? '-' : ''}${whole.toString()}.${fracStr}`
}

export function parseGen(str) {
  const s = String(str ?? '').trim()
  if (!s) return 0n
  if (!/^\d*(\.\d*)?$/.test(s)) {
    throw new Error(`Invalid GEN amount: "${str}"`)
  }
  const [wholeRaw = '0', fracRaw = ''] = s.split('.')
  const whole = wholeRaw || '0'
  const frac = (fracRaw || '').slice(0, Number(GEN_DECIMALS))
  const fracPadded = frac.padEnd(Number(GEN_DECIMALS), '0')
  return BigInt(whole) * (10n ** GEN_DECIMALS) + BigInt(fracPadded || '0')
}

// ──────────────────────────────────────────────────────────────────────────────
// Last-room persistence (so reloads can resume the session)
// ──────────────────────────────────────────────────────────────────────────────
export function rememberRoom(addr) {
  try { localStorage.setItem(STORAGE_ROOM, addr) } catch {}
}
export function getRememberedRoom() {
  try { return localStorage.getItem(STORAGE_ROOM) } catch { return null }
}
export function forgetRoom() {
  try { localStorage.removeItem(STORAGE_ROOM) } catch {}
      }

// ──────────────────────────────────────────────────────────────────────────────
// Backwards-compat shims — kept so leftover imports don't crash the bundle.
// Safe to delete once `grep -rn "burnerAddress\|getPrivateKey\|resetBurner\|
// importPrivateKey\|getWalletMode\|isInjectedActive" src/` returns nothing.
// ──────────────────────────────────────────────────────────────────────────────
export function burnerAddress()    { return null }
export function getPrivateKey()    { return null }
export function resetBurner()      {}
export function importPrivateKey() { throw new Error('Burner wallet has been removed. Connect a Web3 wallet.') }
export function getWalletMode()    { return 'injected' }
export function isInjectedActive() { return isWalletConnected() }
