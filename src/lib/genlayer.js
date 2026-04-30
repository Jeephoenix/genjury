// GenLayer SDK wrapper for Genjury frontend.
//
// The contract is a singleton deployed by the platform owner — its address
// is baked in via VITE_GENJURY_CONTRACT. End users never deploy contracts.

import { createClient } from 'genlayer-js'
import {
  studionet,
  localnet,
  testnetAsimov,
  testnetBradbury,
} from 'genlayer-js/chains'

const STORAGE_INJECTED = 'genjury_injected_address'

let _injectedAddress = null
let _client          = null
const _listeners     = new Set()
const _txListeners   = new Set()
let _txSeq           = 0

export function subscribeWallet(fn) {
  _listeners.add(fn)
  return () => _listeners.delete(fn)
}

function notify() {
  for (const fn of _listeners) {
    try { fn() } catch {}
  }
}

export function subscribeTx(fn) {
  _txListeners.add(fn)
  return () => _txListeners.delete(fn)
}

function emitTx(evt) {
  for (const fn of _txListeners) {
    try { fn(evt) } catch {}
  }
}

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

export function myAddress() {
  return injectedAddress()
}

export function isWalletConnected() {
  return !!injectedAddress()
}

export const isInjectedActive = isWalletConnected

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
  if (!k)                      return DEFAULT_NETWORK
  if (k === 'testnet')         return DEFAULT_NETWORK
  if (k === 'testnetbradbury') return 'bradbury'
  if (k === 'testnetasimov')   return 'asimov'
  if (NETWORK_INFO[k])         return k
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

let _readClient = null

function buildChain() {
  const baseChain = getChain()
  const overrideRpc = import.meta.env.VITE_GENLAYER_RPC
  return overrideRpc
    ? { ...baseChain, rpcUrls: { default: { http: [overrideRpc] } } }
    : baseChain
}

export function getReadClient() {
  if (_readClient) return _readClient
  _readClient = createClient({ chain: buildChain() })
  return _readClient
}

export function getClient() {
  if (_client) return _client

  const addr = injectedAddress()
  if (!addr) {
    throw new Error('Connect a Web3 wallet to continue.')
  }
  if (!hasInjectedProvider()) {
    throw new Error('No Web3 wallet detected in this browser.')
  }

  _client = createClient({
    chain: buildChain(),
    account: addr,
    provider: window.ethereum,
  })
  return _client
}

// ── Singleton contract address ───────────────────────────────────────────────
//
// The Genjury contract is deployed once by the platform owner and reused by
// every player. Set VITE_GENJURY_CONTRACT to the deployed address; the app
// throws on any read/write attempt if it's missing or malformed.

export function getContractAddress() {
  const raw = import.meta.env.VITE_GENJURY_CONTRACT
  if (!raw) return null
  const trimmed = String(raw).trim()
  if (!/^0x[0-9a-fA-F]{40}$/.test(trimmed)) {
    console.warn('[genjury] VITE_GENJURY_CONTRACT is set but is not a valid 0x… address.')
    return null
  }
  return trimmed
}

export function hasContractAddress() {
  return !!getContractAddress()
}

export function requireContractAddress() {
  const addr = getContractAddress()
  if (!addr) {
    throw new Error(
      'VITE_GENJURY_CONTRACT is not configured. The platform owner must deploy the Genjury contract once and set this env var.'
    )
  }
  return addr
}

// ── Reads / writes ───────────────────────────────────────────────────────────

export async function readView(address, fn, args = []) {
  return await getReadClient().readContract({
    address,
    functionName: fn,
    args,
  })
}

// Convenience: read a method on the singleton contract.
export async function readContractView(fn, args = []) {
  return await readView(requireContractAddress(), fn, args)
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

// Convenience: call a method on the singleton contract.
export async function callContractMethod(fn, args = [], valueWei = 0n, label = null) {
  return await callMethod(requireContractAddress(), fn, args, valueWei, label)
}

// Returns the transaction receipt so callers can read its decoded return value
// (used for create_room, where we need the generated room code).
export async function callMethodForResult(address, fn, args = [], valueWei = 0n, label = null) {
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
  let receipt = null
  try {
    receipt = await client.waitForTransactionReceipt({ hash })
    emitTx({ id, label: description, status: 'confirmed', hash })
  } catch (e) {
    console.warn('[genjury] waitForTransactionReceipt:', e?.message || e)
    emitTx({ id, label: description, status: 'confirmed', hash })
  }
  return { hash, receipt }
}

function friendlyTxError(e) {
  if (!e) return 'Unknown error'
  if (typeof e === 'string') return e
  if (e.code === 4001 || /user rejected|user denied/i.test(e.message || '')) {
    return 'You rejected the request in your wallet.'
  }
  return e.shortMessage || e.message || String(e)
}

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

export function explorerAddressUrl(address) {
  const info = getNetworkInfo()
  if (!info?.explorer || !address) return null
  return `${info.explorer.replace(/\/$/, '')}/address/${address}`
}

// ── Room code helpers ────────────────────────────────────────────────────────
const ROOM_CODE_RE = /^[A-Z2-9]{6}$/

export function isValidRoomCode(code) {
  return typeof code === 'string' && ROOM_CODE_RE.test(code.trim().toUpperCase())
}

export function normalizeRoomCode(raw) {
  if (!raw) return ''
  return String(raw).trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
}
