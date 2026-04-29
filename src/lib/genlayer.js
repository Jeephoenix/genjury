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

// Back-compat alias — LandingPage.jsx and NetworkBanner.jsx import this name.
export const isInjectedActive = isWalletConnected

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
// Clients
//
// Two separate clients:
//
//   - getReadClient(): a wallet-less, provider-less client bound to the
//     configured GenLayer chain's HTTP RPC. Used for ALL view calls
//     (previewRoom, polling, lobby refreshes). Works without a connected
//     wallet, and — critically — works regardless of which chain the user's
//     injected wallet (MetaMask) is currently switched to. Without this,
//     `readContract` would tunnel through `window.ethereum` and fail
//     whenever the wallet was on the wrong chain (e.g. Ethereum mainnet),
//     surfacing as the dreaded "Could not load this room" error even when
//     the contract address is perfectly valid.
//
//   - getClient(): the wallet-bound client used for writes (deploy, join,
//     submit, vote, etc.). Requires a connected wallet on the correct chain.
// ──────────────────────────────────────────────────────────────────────────────
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

// ──────────────────────────────────────────────────────────────────────────────
// Reads / writes / deploys
// ──────────────────────────────────────────────────────────────────────────────
export async function readView(address, fn, args = []) {
  // Reads always go through the read-only client so they:
  //   1. Don't require a connected wallet (preview before joining).
  //   2. Aren't affected by the wallet's currently selected chain.
  return await getReadClient().readContract({
    address,
    functionName: fn,
    args,
  })
}

// ──────────────────────────────────────────────────────────────────────────────
// Address diagnostics
//
// When a Join Room read fails, the user sees a generic "no room found" error
// even though several very different things may have gone wrong:
//
//   - Nothing is deployed at the address at all (typo, wrong network).
//   - There IS bytecode at the address (e.g. a GhostBlueprint proxy that the
//     GhostFactory created), but the GenLayer consensus layer never finalized
//     the contract registration — usually because the host's deploy reverted
//     or is still pending. The RPC then returns "contract not found at
//     address" from gen_call even though eth_getCode shows real bytecode.
//   - The RPC errored out for some unrelated reason.
//
// `diagnoseAddress` distinguishes these cases so the UI can give a precise,
// actionable message + an "Open in Explorer" link.
// ──────────────────────────────────────────────────────────────────────────────
export async function diagnoseAddress(addr) {
  const address = (addr || '').trim()
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
    return { kind: 'rpc_error', address, message: 'Address is not a valid 0x… hex string.' }
  }

  try {
    const data = await getReadClient().readContract({
      address,
      functionName: 'get_economics',
      args: [],
    })
    return { kind: 'ok', address, data }
  } catch (e) {
    const message = (e?.shortMessage || e?.message || String(e || '')).toString()

    if (/contract not found at address/i.test(message)) {
      const hasBytecode = await addressHasCode(address)
      return hasBytecode
        ? { kind: 'not_registered', address, hasBytecode: true }
        : { kind: 'no_bytecode', address }
    }
    return { kind: 'rpc_error', address, message }
  }
}

async function addressHasCode(address) {
  try {
    const chain = buildChain()
    const rpc = chain?.rpcUrls?.default?.http?.[0]
    if (!rpc) return false
    const res = await fetch(rpc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'eth_getCode',
        params: [address, 'latest'],
      }),
    })
    const data = await res.json()
    const code = (data?.result || '').toLowerCase()
    return !!code && code !== '0x' && code !== '0x0'
  } catch {
    return false
  }
}

// Build an explorer URL for a contract address on the configured chain. Returns
// null when the chain doesn't have an explorer configured (localnet / studio).
export function explorerAddressUrl(address) {
  const info = getNetworkInfo()
  if (!info?.explorer || !address) return null
  return `${info.explorer.replace(/\/$/, '')}/address/${address}`
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
 * The 3.00% house cut and the house wallet (= deployer) are baked into the
 * contract, so the deployer only chooses how long the game is and how much
 * each player pays to join.
 *
 * @param {object} opts
 * @param {number} opts.maxRounds        Total rounds in the game (>=1).
 * @param {bigint} opts.entryFeeWei      Wei each player pays to join (0 = free).
 */
export async function deployGenjury({
  maxRounds = 3,
  entryFeeWei = 0n,
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
// Default contract address (the "house room")
//
// Set VITE_GENJURY_DEFAULT_CONTRACT in your .env.local (locally) and in your
// Vercel project's Environment Variables (Production / Preview / Development)
// to point the app at a specific deployed Genjury contract by default. Players
// will see it as a "Featured room" on the landing page and be one click away
// from joining it without having to deploy their own.
//
// If the variable is empty / unset, the app behaves as before — every host
// must deploy a fresh contract to play.
// ──────────────────────────────────────────────────────────────────────────────
export function getDefaultContractAddress() {
  const raw = import.meta.env.VITE_GENJURY_DEFAULT_CONTRACT
  if (!raw) return null
  const trimmed = String(raw).trim()
  // Sanity check: must look like a hex address.
  if (!/^0x[0-9a-fA-F]{40}$/.test(trimmed)) {
    console.warn('[genjury] VITE_GENJURY_DEFAULT_CONTRACT is set but is not a valid 0x… address — ignoring.')
    return null
  }
  return trimmed
}

export function hasDefaultContract() {
  return !!getDefaultContractAddress()
}

// ──────────────────────────────────────────────────────────────────────────────
// Last-room persistence (so reloads can resume the session)
// ──────────────────────────────────────────────────────────────────────────────
export function rememberRoom(addr) {
  try { localStorage.setItem(STORAGE_ROOM, addr) } catch {}
}
export function getRememberedRoom() {
  try {
    const stored = localStorage.getItem(STORAGE_ROOM)
    if (stored) return stored
  } catch {}
  // Fallback: the env-configured "house room" — the default contract address
  // baked in at build time via VITE_GENJURY_DEFAULT_CONTRACT.
  return getDefaultContractAddress()
}
export function forgetRoom() {
  try { localStorage.removeItem(STORAGE_ROOM) } catch {}
      }
