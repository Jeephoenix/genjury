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

// ── Multi-wallet detection ───────────────────────────────────────────────────
//
// EIP-5749 / EIP-6963 expose multiple providers in window.ethereum.providers[].
// Each provider carries fingerprint booleans (isMetaMask, isCoinbaseWallet, …).
// We normalise these into a plain descriptor array so the UI can render a
// labelled wallet selector without touching raw provider objects in React state
// (provider objects are not serialisable).
//
// The returned array is stable across calls (same identity if no new wallets).

const WALLET_DEFS = [
  { key: 'rabby',    label: 'Rabby',            flag: 'isRabby',         icon: 'rabby' },
  { key: 'coinbase', label: 'Coinbase Wallet',   flag: 'isCoinbaseWallet', icon: 'coinbase' },
  { key: 'metamask', label: 'MetaMask',          flag: 'isMetaMask',       icon: 'metamask' },
  { key: 'brave',    label: 'Brave Wallet',      flag: 'isBraveWallet',    icon: 'brave' },
  { key: 'frame',    label: 'Frame',             flag: 'isFrame',          icon: 'frame' },
  { key: 'trust',    label: 'Trust Wallet',      flag: 'isTrust',          icon: 'trust' },
  { key: 'okx',      label: 'OKX Wallet',        flag: 'isOkxWallet',      icon: 'okx' },
]

function labelProvider(p) {
  for (const def of WALLET_DEFS) {
    if (p[def.flag]) return { label: def.label, icon: def.icon, key: def.key }
  }
  return { label: 'Browser Wallet', icon: 'generic', key: 'generic' }
}

// Returns an array of { key, label, icon } — one entry per detected provider.
// The array index matches the internal _providers array so connectWithProvider
// can look up the raw provider by index.
let _providers = []

  // ── EIP-6963 multi-wallet discovery ─────────────────────────────────────────
  //
  // EIP-6963 (Multi Injected Provider Discovery) supersedes the EIP-5749
  // window.ethereum.providers[] approach.  Wallets announce themselves by:
  //   1. listening for "eip6963:requestProvider" on window, then
  //   2. firing "eip6963:announceProvider" with { detail: { info, provider } }
  //
  // info shape: { uuid: string, name: string, icon: string (data-URI), rdns: string }
  //
  // We collect these into a Map keyed by UUID so late-loading extensions are
  // automatically picked up.  A lightweight pub/sub lets the selector modal
  // re-render without polling.

  const _eip6963Map = new Map()   // uuid → { info, provider }
  const _walletListeners = new Set()

  export function subscribeWalletList(fn) {
    _walletListeners.add(fn)
    return () => _walletListeners.delete(fn)
  }

  function notifyWalletList() {
    for (const fn of _walletListeners) { try { fn() } catch {} }
  }

  // Call once (in the wallet selector modal or app root) to start discovery.
  // Returns a cleanup function.  Safe to call multiple times — duplicate
  // listeners are guarded by the "already in map" check.
  export function initEIP6963() {
    if (typeof window === 'undefined') return () => {}

    const handler = (event) => {
      const { info, provider } = event.detail ?? {}
      if (!info?.uuid || !provider) return
      if (!_eip6963Map.has(info.uuid)) {
        _eip6963Map.set(info.uuid, { info, provider })
        notifyWalletList()
      }
    }

    window.addEventListener('eip6963:announceProvider', handler)
    // Ask already-loaded wallets to re-announce
    window.dispatchEvent(new Event('eip6963:requestProvider'))

    return () => window.removeEventListener('eip6963:announceProvider', handler)
  }

  // Returns descriptors from EIP-6963 map (preferred) or EIP-5749 / single
  // window.ethereum (fallback).  Each descriptor: { key, label, icon, dataIcon?,
  // providerIndex } where dataIcon is the data-URI from EIP-6963 info when present.
  

export function detectWallets() {
    if (typeof window === 'undefined' || !window.ethereum) return []

    // ── EIP-6963 providers (preferred) ──────────────────────────────────────
    if (_eip6963Map.size > 0) {
      _providers = []
      const seen = new Set()
      const result = []
      for (const { info, provider } of _eip6963Map.values()) {
        const rdns = info.rdns ?? ''
        // Derive a stable key from rdns (io.metamask → metamask) or name
        const key = rdns.split('.').pop()?.toLowerCase() || info.name.toLowerCase().replace(/\s+/g, '_')
        if (!seen.has(key)) {
          seen.add(key)
          _providers.push(provider)
          result.push({
            key,
            label:         info.name,
            icon:          'generic',       // inline SVG fallback key
            dataIcon:      info.icon ?? null, // data-URI (preferred for rendering)
            providerIndex: _providers.length - 1,
          })
        }
      }
      return result
    }

    // ── EIP-5749 fallback: window.ethereum.providers[] ───────────────────────
    const multi = window.ethereum.providers
    if (Array.isArray(multi) && multi.length > 0) {
      _providers = multi
    } else {
      _providers = [window.ethereum]
    }

    const seen = new Set()
    const result = []
    for (let i = 0; i < _providers.length; i++) {
      const meta = labelProvider(_providers[i])
      if (!seen.has(meta.key)) {
        seen.add(meta.key)
        result.push({ ...meta, dataIcon: null, providerIndex: i })
      }
    }
    return result
  }
  

// Connect via descriptor.providerIndex from detectWallets().
// Falls back to window.ethereum if index is out of range.
export async function connectWithProvider(providerIndex = 0) {
  const provider = _providers[providerIndex] ?? window.ethereum
  if (!provider) throw new Error('No Web3 wallet found. Install MetaMask to continue.')

  const accounts = await provider.request({ method: 'eth_requestAccounts' })
  if (!accounts?.length) throw new Error('Wallet did not return any accounts')
  const addr = accounts[0]

  // Pass the chosen provider directly — never write to window.ethereum
  // (wallets like Rabby define it as getter-only via Object.defineProperty)
  await ensureCorrectChain(provider)

  // Wire events on the chosen provider
  rememberInjected(addr)
  _client = null
  notify()

  const tag = '__genjuryWired'
  if (!provider[tag]) {
    provider[tag] = true
    provider.on?.('accountsChanged', (accs) => {
      rememberInjected(accs?.[0] ?? null)
      _client = null
      notify()
    })
    provider.on?.('chainChanged', () => {
      _client = null
      notify()
    })
  }

  // Store chosen provider so getClient() uses it
  _chosenProvider = provider

  return addr
}

// The provider chosen at last connectWithProvider call; used by getClient().
let _chosenProvider = null

export function getChosenProvider() {
  return _chosenProvider ?? (typeof window !== 'undefined' ? window.ethereum : null)
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

async function ensureCorrectChain(provider) {
  // Accept an explicit provider; fall back to window.ethereum for the legacy path.
  // Never *assign* window.ethereum — wallets like Rabby make it getter-only.
  const eth = provider ?? (typeof window !== 'undefined' ? window.ethereum : null)
  if (!eth) throw new Error('No Web3 wallet detected')
  const chain = getChain()
  const expected = `0x${chain.id.toString(16)}`
  let current
  try {
    current = await eth.request({ method: 'eth_chainId' })
  } catch {
    current = null
  }
  if (current === expected) return
  try {
    await eth.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: expected }],
    })
  } catch (err) {
    const code = err?.code ?? err?.data?.originalError?.code
    if (code === 4902 || /unrecognized chain/i.test(err?.message || '')) {
      const rpcUrl = chain.rpcUrls?.default?.http?.[0]
      const explorerUrl = chain.blockExplorers?.default?.url
      await eth.request({
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

const DEFAULT_NETWORK = 'studionet'

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
    label:    'GenLayer Studio',
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
  if (key === 'localnet')  return localnet
  if (key === 'asimov')    return testnetAsimov
  if (key === 'bradbury')  return testnetBradbury
  return studionet
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
    provider: getChosenProvider(),
  })
  return _client
}

// ── Singleton contract address ───────────────────────────────────────────────
//
// The Genjury contract is deployed once by the platform owner and reused by
// every player. Set VITE_GENJURY_CONTRACT to the deployed address; the app
// throws on any read/write attempt if it's missing or malformed.

// Runtime override key — lets the platform owner configure the contract
  // address directly in the browser without requiring a redeploy.
  const STORAGE_CONTRACT_KEY = 'genjury_contract_v1'
  const _contractListeners   = new Set()

  function notifyContract() {
    for (const fn of _contractListeners) { try { fn() } catch {} }
  }

  export function subscribeContractAddress(fn) {
    _contractListeners.add(fn)
    return () => _contractListeners.delete(fn)
  }

  function isValidAddress(raw) {
    return typeof raw === 'string' && /^0x[0-9a-fA-F]{40}$/.test(raw.trim())
  }

  export function getContractAddress() {
    // 1. Build-time env var (highest priority)
    const envRaw = import.meta.env.VITE_GENJURY_CONTRACT
    if (envRaw) {
      const trimmed = String(envRaw).trim()
      if (isValidAddress(trimmed)) return trimmed
      console.warn('[genjury] VITE_GENJURY_CONTRACT is set but is not a valid 0x… address.')
    }
    // 2. Runtime override stored in localStorage by the platform owner
    try {
      const stored = localStorage.getItem(STORAGE_CONTRACT_KEY)
      if (stored && isValidAddress(stored)) return stored.trim()
    } catch {}
    return null
  }

  // Allow the platform owner to set / clear the address at runtime.
  export function setRuntimeContractAddress(addr) {
    if (!addr) {
      try { localStorage.removeItem(STORAGE_CONTRACT_KEY) } catch {}
      notifyContract()
      return null
    }
    const trimmed = String(addr).trim()
    if (!isValidAddress(trimmed)) {
      throw new Error('Invalid contract address — must be a 0x… 40-hex-char address.')
    }
    try { localStorage.setItem(STORAGE_CONTRACT_KEY, trimmed) } catch {}
    notifyContract()
    return trimmed
  }

  export function clearRuntimeContractAddress() {
    try { localStorage.removeItem(STORAGE_CONTRACT_KEY) } catch {}
    notifyContract()
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
  const _m = e.message || ''
  const _c = e.code
  if (_c === 4001 || /user rejected|user denied|cancel/i.test(_m))
    return 'You rejected the request in your wallet.'
  if (/only a getter|Cannot set property ethereum|read.only/i.test(_m))
    return 'A wallet extension conflict was detected. Disable other wallet extensions and refresh.'
  if (/wrong network|unrecognized chain/i.test(_m))
    return 'Wrong network — please switch to the correct network in your wallet.'
  if (/timeout|timed out/i.test(_m))
    return 'Request timed out. Please try again.'
  if (/insufficient funds/i.test(_m))
    return 'Insufficient funds to complete this transaction.'
  if (/no web3|no wallet|not found|not installed/i.test(_m))
    return 'No wallet detected. Install MetaMask or another Web3 wallet.'
  if (/network|rpc|econnrefused|fetch failed/i.test(_m))
    return 'Network error — check your connection and try again.'
  return e.shortMessage || e.message || 'Transaction failed. Please try again.'
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

  // ── Studionet / localnet dev-fund helper ────────────────────────────────────
  //
  // Calls the node's debug_fundAccount JSON-RPC method to credit an address with
  // test GEN.  Only available on studionet and localnet — throws on public
  // testnets so it can never be accidentally called in a production build where
  // the env var points at bradbury/asimov.
  //
  // GenLayer Studio RPC signature:
  //   debug_fundAccount(address: string, amount: hex-string)
  //   e.g. params: ["0xABC…", "0x56BC75E2D63100000"]  // 100 GEN in wei

  const FUND_DEFAULT_WEI = 100n * 10n ** 18n  // 100 GEN

  export async function fundAccount(address, amountWei = FUND_DEFAULT_WEI) {
    const key = getNetworkName()
    if (key !== 'studionet' && key !== 'localnet') {
      throw new Error('debug_fundAccount is only available on studionet and localnet.')
    }
    const chain = getChain()
    const rpc = import.meta.env.VITE_GENLAYER_RPC || chain?.rpcUrls?.default?.http?.[0]
    if (!rpc) throw new Error('No RPC URL configured for this network.')

    const amount = typeof amountWei === 'bigint' ? amountWei : BigInt(amountWei || 0)
    const res = await fetch(rpc, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id:      Date.now(),
        method:  'debug_fundAccount',
        params:  [address, `0x${amount.toString(16)}`],
      }),
    })

    if (!res.ok) throw new Error(`RPC request failed: HTTP ${res.status}`)
    const data = await res.json()
    if (data?.error) {
      const msg = data.error.message || JSON.stringify(data.error)
      throw new Error(`debug_fundAccount: ${msg}`)
    }
    return data?.result ?? null
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
