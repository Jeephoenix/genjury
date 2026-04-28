// ──────────────────────────────────────────────────────────────────────────────
// Thin GenLayer JS SDK wrapper for the Genjury frontend.
//
// Loads the contract source as a raw string (Vite ?raw import) so we can
// deploy the contract directly from the browser when the user clicks
// "Create Room". A single account is generated per browser and persisted
// in localStorage so refreshes keep the same identity.
// ──────────────────────────────────────────────────────────────────────────────

import {
  createClient,
  createAccount,
  generatePrivateKey,
} from 'genlayer-js'
import { studionet, localnet, testnetAsimov } from 'genlayer-js/chains'

import contractSource from '../../contracts/genjury.py?raw'

const STORAGE_PK   = 'genjury_account_pk'
const STORAGE_ROOM = 'genjury_last_room'

let _account = null
let _client  = null

// ── Account ─────────────────────────────────────────────────────────────────
export function getAccount() {
  if (_account) return _account
  let pk = null
  try { pk = localStorage.getItem(STORAGE_PK) } catch {}
  if (!pk) {
    pk = generatePrivateKey()
    try { localStorage.setItem(STORAGE_PK, pk) } catch {}
  }
  _account = createAccount(pk)
  return _account
}

export function myAddress() {
  return getAccount().address
}

// ── Client ──────────────────────────────────────────────────────────────────
function getChain() {
  const network = (import.meta.env.VITE_GENLAYER_NETWORK || 'studionet').toLowerCase()
  if (network === 'testnet' || network === 'testnetasimov') return testnetAsimov
  if (network === 'localnet') return localnet
  return studionet
}

export function getClient() {
  if (_client) return _client
  const chain = getChain()
  const overrideRpc = import.meta.env.VITE_GENLAYER_RPC
  const cfg = { chain, account: getAccount() }
  if (overrideRpc) {
    // Override the chain's default endpoint while keeping the chain id.
    cfg.chain = {
      ...chain,
      rpcUrls: { default: { http: [overrideRpc] } },
    }
  }
  _client = createClient(cfg)
  return _client
}

// ── Reads / writes / deploys ────────────────────────────────────────────────
export async function readView(address, fn, args = []) {
  return await getClient().readContract({
    address,
    functionName: fn,
    args,
  })
}

export async function callMethod(address, fn, args = []) {
  const client = getClient()
  const hash = await client.writeContract({
    address,
    functionName: fn,
    args,
    value: 0n,
  })
  // Wait until the validators have finalized the transaction so a follow-up
  // read sees the new state.
  try {
    await client.waitForTransactionReceipt({ hash })
  } catch (e) {
    console.warn('[genjury] waitForTransactionReceipt:', e?.message || e)
  }
  return hash
}

export async function deployGenjury(maxRounds = 3) {
  const client = getClient()
  const hash = await client.deployContract({
    code: contractSource,
    args: [maxRounds],
  })
  const receipt = await client.waitForTransactionReceipt({ hash })
  const addr =
    receipt?.txDataDecoded?.contractAddress ||
    receipt?.contractAddress ||
    receipt?.recipient ||
    receipt?.to_address
  if (!addr) {
    console.error('[genjury] deploy receipt:', receipt)
    throw new Error('Deployment finalized but no contract address was returned')
  }
  return addr
}

// ── Convenience: persist last joined room ───────────────────────────────────
export function rememberRoom(addr) {
  try { localStorage.setItem(STORAGE_ROOM, addr) } catch {}
}
export function getRememberedRoom() {
  try { return localStorage.getItem(STORAGE_ROOM) } catch { return null }
}
