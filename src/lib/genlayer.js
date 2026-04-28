// ──────────────────────────────────────────────────────────────────────────────
// GenLayer JS SDK wrapper for the Genjury frontend.
//
// Two wallet modes are supported:
//
//   * "burner"   — a private key generated in-browser and stored in
//                  localStorage. Frictionless for demos and single-device play.
//   * "injected" — a real Web3 wallet (MetaMask et al.) reached through
//                  window.ethereum. The user signs every transaction.
//
// The active mode is persisted in localStorage so refreshes keep the same
// identity. The SDK client is rebuilt whenever the mode or address changes.
// ──────────────────────────────────────────────────────────────────────────────

import {
  createClient,
  createAccount,
  generatePrivateKey,
} from 'genlayer-js'
import { studionet, localnet, testnetAsimov, testnetBradbury } from 'genlayer-js/chains'

import contractSource from '../../contracts/genjury.py?raw'

// ── localStorage keys ───────────────────────────────────────────────────────
const STORAGE_PK       = 'genjury_account_pk'
const STORAGE_ROOM     = 'genjury_last_room'
const STORAGE_MODE     = 'genjury_wallet_mode'        // 'burner' | 'injected'
const STORAGE_INJECTED = 'genjury_injected_address'   // last connected EOA

// ── Module-level cache ──────────────────────────────────────────────────────
let _burnerAccount   = null
let _injectedAddress = null
let _client          = null
const _listeners     = new Set()
const _txListeners   = new Set()
let _txSeq           = 0

// ──────────────────────────────────────────────────────────────────────────────
// Wallet mode
// ──────────────────────────────────────────────────────────────────────────────
export function getWalletMode() {
  try {
    const m = localStorage.getItem(STORAGE_MODE)
    if (m === 'injected' || m === 'burner') return m
  } catch {}
  return 'burner'
}

function setWalletMode(mode) {
  try { localStorage.setItem(STORAGE_MODE, mode) } catch {}
  _client = null
  notify()
}

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
// Burner wallet
// ──────────────────────────────────────────────────────────────────────────────
function loadBurnerAccount() {
  if (_burnerAccount) return _burnerAccount
  let pk = null
  try { pk = localStorage.getItem(STORAGE_PK) } catch {}
  if (!pk) {
    pk = generatePrivateKey()
    try { localStorage.setItem(STORAGE_PK, pk) } catch {}
  }
  _burnerAccount = createAccount(pk)
  return _burnerAccount
}

export function burnerAddress() {
  return loadBurnerAccount().address
}

export function getPrivateKey() {
  try { return localStorage.getItem(STORAGE_PK) } catch { return null }
}

export function resetBurner() {
  try { localStorage.removeItem(STORAGE_PK) } catch {}
  _burnerAccount = null
  _client = null
  notify()
}

export function importPrivateKey(pk) {
  const trimmed = (pk || '').trim()
  if (!trimmed) throw new Error('Empty private key')
  const normalized = trimmed.startsWith('0x') ? trimmed : `0x${trimmed}`
  const acct = createAccount(normalized)
  try { localStorage.setItem(STORAGE_PK, normalized) } catch {}
  _burnerAccount = acct
  _client = null
  setWalletMode('burner')
  return acct.address
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
  setWalletMode('injected')

  // Wire up account/chain change listeners exactly once.
  if (!window.ethereum.__genjuryWired) {
    window.ethereum.__genjuryWired = true
    window.ethereum.on?.('accountsChanged', (accs) => {
      if (!accs?.length) {
        rememberInjected(null)
        if (getWalletMode() === 'injected') setWalletMode('burner')
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
  setWalletMode('burner')
}

// ──────────────────────────────────────────────────────────────────────────────
// Active address — what the rest of the app sees as "me"
// ──────────────────────────────────────────────────────────────────────────────
export function myAddress() {
  if (getWalletMode() === 'injected') {
    const a = injectedAddress()
    if (a) return a
  }
  return burnerAddress()
}

export function isInjectedActive() {
  return getWalletMode() === 'injected' && !!injectedAddress()
}

// ──────────────────────────────────────────────────────────────────────────────
// Network / chain
// ──────────────────────────────────────────────────────────────────────────────
const NETWORK_INFO = {
  testnet: {
    label: 'GenLayer Testnet (Asimov)',
    explorer: 'https://explorer.genlayer.com',
    faucet: 'https://faucet.genlayer.com',
  },
  studionet: {
    label: 'GenLayer Studio (local)',
    explorer: null,
    faucet: null,
  },
  localnet: {
    label: 'GenLayer Localnet',
    explorer: null,
    faucet: null,
  },
}

export function getNetworkName() {
  return (import.meta.env.VITE_GENLAYER_NETWORK || 'testnet').toLowerCase()
}

export function getNetworkInfo() {
  const name = getNetworkName()
  const key = name === 'testnetasimov' ? 'testnet' : name
  return { key, ...(NETWORK_INFO[key] || NETWORK_INFO.testnet) }
}

export function getChain() {
  const network = getNetworkName()
  if (network === 'studionet') return studionet
  if (network === 'localnet') return localnet
  return testnetAsimov
}

export function getChainNativeSymbol() {
  return getChain()?.nativeCurrency?.symbol || 'GEN'
}

// ──────────────────────────────────────────────────────────────────────────────
// Client
// ──────────────────────────────────────────────────────────────────────────────
export function getClient() {
  if (_client) return _client

  const baseChain = getChain()
  const overrideRpc = import.meta.env.VITE_GENLAYER_RPC
  const chain = overrideRpc
    ? { ...baseChain, rpcUrls: { default: { http: [overrideRpc] } } }
    : baseChain

  const cfg = { chain }

  if (isInjectedActive()) {
    // Pass the address as a string so the SDK forwards signing to window.ethereum.
    cfg.account = injectedAddress()
    cfg.provider = window.ethereum
  } else {
    cfg.account = loadBurnerAccount()
  }

  _client = createClient(cfg)
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
    // We optimistically treat receipt-wait failures as confirmed so the UI
    // stops spinning — the polling loop will catch any real divergence.
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

// Best-effort, human-readable distillation of a wallet/SDK error.
function friendlyTxError(e) {
  if (!e) return 'Unknown error'
  if (typeof e === 'string') return e
  // MetaMask user rejections
  if (e.code === 4001 || /user rejected|user denied/i.test(e.message || '')) {
    return 'You rejected the request in your wallet.'
  }
  return e.shortMessage || e.message || String(e)
}

/**
 * Read the active wallet's GEN balance (wei) via raw eth_getBalance.
 * Falls back to 0n if anything goes wrong — the caller can decide whether to
 * surface that to the UI.
 */
export async function getGenBalanceWei(addr) {
  const target = addr || myAddress()
  if (!target) return 0n

  if (isInjectedActive() && hasInjectedProvider()) {
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

/**
 * Format wei as a human-readable GEN amount.
 *
 *   formatGen(1500000000000000000n) === "1.5"
 *   formatGen(0n)                   === "0"
 *
 * @param {bigint|number|string} wei
 * @param {number} maxFractionDigits  Trim trailing zeros up to this many digits.
 */
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

/**
 * Parse a decimal GEN string into wei. Throws on malformed input.
 *
 *   parseGen("1.5")  === 1500000000000000000n
 *   parseGen("")     === 0n
 */
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
