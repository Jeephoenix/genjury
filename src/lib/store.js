// ──────────────────────────────────────────────────────────────────────────────
// Genjury — game store (mirrors the on-chain Genjury contract).
//
// Every gameplay action ends in a contract write. A polling loop pulls the
// authoritative state via `get_state` every ~1.5s and reshapes it for the UI.
//
// On top of the original game state we also surface the contract economics:
//   * entry fee (wei) every player pays to join
//   * accumulated prize pool
//   * winner / claim status once the game ends
//
// Local-only state (kept on the client):
//   * timer / timerMax — ticked by App.jsx every second
//   * toasts
//   * "draft" statements + lieIndex during WRITING (typing buffer; not
//     overwritten by polling until the deceiver actually submits)
//   * chatMessages — in-room chat (taunts + objection coordination), backed
//     by /api/chat (Neon). De-duped by id so optimistic sends + polled
//     fetches don't double up.
// ──────────────────────────────────────────────────────────────────────────────

import { create } from 'zustand'
import { nanoid } from 'nanoid'

import {
  myAddress,
  deployGenjury,
  callMethod,
  readView,
  diagnoseAddress,
  rememberRoom,
  forgetRoom,
  subscribeWallet,
  subscribeTx,
  parseGen,
} from './genlayer'

// ── Phase constants — must match the contract's PHASE_* string literals ─────
export const PHASES = {
  LOBBY:          'lobby',
  WRITING:        'writing',
  VOTING:         'voting',
  AI_JUDGING:     'ai_judging',
  OBJECTION:      'objection',
  OBJECTION_VOTE: 'objection_vote',
  REVEAL:         'reveal',
  SCOREBOARD:     'scoreboard',
}

const PHASE_TIMERS = {
  [PHASES.WRITING]:        90,
  [PHASES.VOTING]:         45,
  [PHASES.AI_JUDGING]:     0,
  [PHASES.OBJECTION]:      15,
  [PHASES.OBJECTION_VOTE]: 20,
  [PHASES.REVEAL]:         0,
  [PHASES.SCOREBOARD]:     0,
  [PHASES.LOBBY]:          0,
}

const POLL_INTERVAL_MS = 1500
const CHAT_BUFFER_MAX  = 100

// ── Helpers ─────────────────────────────────────────────────────────────────
const norm = (a) => (typeof a === 'string' ? a.toLowerCase() : a)

function safeBigInt(v) {
  if (v === undefined || v === null || v === '') return 0n
  if (typeof v === 'bigint') return v
  try { return BigInt(v) } catch { return 0n }
}

function mapPlayers(state) {
  const order = state.playerOrder || []
  const records = state.players || {}
  const hostNorm = norm(state.host)
  return order.map((addrRaw) => {
    const addr = norm(addrRaw)
    const rec = records[addrRaw] || records[addr] || {}
    return {
      id:       addr,
      name:     rec.name || addr.slice(0, 6),
      avatar:   rec.avatar || '🦊',
      color:    rec.color || '#a259ff',
      xp:       Number(rec.xp || 0),
      level:    Number(rec.level || 1),
      isHost:   addr === hostNorm,
      isReady:  true,
      isBot:    false,
    }
  })
}

function mapVotes(state) {
  const out = {}
  for (const [k, v] of Object.entries(state.votes || {})) out[norm(k)] = Number(v)
  return out
}

function mapConfidence(state) {
  const out = {}
  for (const [k, v] of Object.entries(state.confidence || {})) {
    out[norm(k)] = Number(v) / 100
  }
  return out
}

function mapObjectionVotes(state) {
  const out = {}
  for (const [k, v] of Object.entries(state.objectionVotes || {})) out[norm(k)] = v
  return out
}

function mapAiVerdict(state) {
  if (!state.aiJudged) return null
  return {
    verdict:    Number(state.aiVerdictIndex),
    confidence: Number(state.aiConfidence || 0) / 100,
    reasoning:  state.aiReasoning || '',
    wasCorrect: Number(state.aiVerdictIndex) === Number(state.lieIndex),
  }
}

function mapReveal(state) {
  const r = state.lastReveal
  if (!r) return null
  const xpGained = {}
  for (const [k, v] of Object.entries(r.xpGained || {})) xpGained[norm(k)] = Number(v)
  const votes = {}
  for (const [k, v] of Object.entries(r.votes || {})) votes[norm(k)] = Number(v)
  const conf = {}
  for (const [k, v] of Object.entries(r.confidence || {})) conf[norm(k)] = Number(v) / 100
  const objVotes = {}
  for (const [k, v] of Object.entries(r.objectionVotes || {})) objVotes[norm(k)] = v
  const fooled = (r.fooledPlayers || []).map(norm)

  return {
    round:                  Number(r.round),
    lieIndex:               Number(r.lieIndex),
    statements:             r.statements || ['', '', ''],
    deceiverId:             norm(r.deceiver),
    aiVerdict: {
      verdict:    Number(r.aiVerdictIndex),
      confidence: Number(r.aiConfidence) / 100,
      reasoning:  r.aiReasoning || '',
      wasCorrect: !r.aiWasFooled,
    },
    effectiveVerdictIndex:  Number(r.effectiveVerdict),
    aiWasFooled:            !!r.aiWasFooled,
    objectionRaised:        !!r.objectionRaised,
    objectionBy:            r.objectionBy ? norm(r.objectionBy) : null,
    objectionVotes:         objVotes,
    votes,
    confidence:             conf,
    fooledPlayers:          fooled,
    xpGained,
  }
}

// ── Polling lifecycle ───────────────────────────────────────────────────────
let pollHandle = null

function startPolling(get) {
  stopPolling()
  pollHandle = setInterval(() => refreshState(get), POLL_INTERVAL_MS)
  refreshState(get)
}

function stopPolling() {
  if (pollHandle) {
    clearInterval(pollHandle)
    pollHandle = null
  }
}

// get_state now returns a JSON-encoded string (see contracts/genjury.py).
// Older deploys returned a decoded object directly, so we accept both shapes
// to keep the frontend backward-compatible during the cutover.
function parseContractPayload(raw) {
  if (raw == null) return null
  if (typeof raw === 'string') {
    if (raw.length === 0) return null
    try { return JSON.parse(raw) } catch { return null }
  }
  return raw
}

async function refreshState(get) {
  const code = get().roomCode
  if (!code) return
  try {
    const raw = await readView(code, 'get_state')
    const parsed = parseContractPayload(raw)
    if (!parsed) return
    applyContractState(get, parsed)
    // Best-effort auto-advance: AI_JUDGING and REVEAL are inert phases that
    // need *someone* to push the next on-chain transaction. Letting the host
    // do it from the polling loop avoids the room stalling silently.
    maybeAutoAdvance(get, parsed)
  } catch (err) {
    console.warn('[genjury] poll failed:', err?.message || err)
  }
}

// ── Auto-advance: keep the room moving even if no one clicks the button ────
let _autoAdvancing = false
async function maybeAutoAdvance(get, s) {
  if (_autoAdvancing) return
  const state = get()
  const myId = state.myId
  const host = norm(s?.host)
  // Only the host runs auto-advance, so we don't get N players racing the
  // same write.
  if (!host || !myId || host !== myId) return

  const phase = s?.phase
  try {
    if (phase === 'ai_judging' && !s?.aiJudged) {
      _autoAdvancing = true
      await callMethod(state.roomCode, 'run_ai_judge', [], 0n,
        'Summon the AI Judge')
    } else if (phase === 'reveal') {
      // Give players a beat to read the reveal screen before forcing the
      // next round. We re-check phase right before sending so we don't
      // double-advance if the host already clicked Next.
      _autoAdvancing = true
      setTimeout(async () => {
        const cur = useGameStore.getState()
        if (cur.phase === 'reveal' && cur.roomCode === state.roomCode) {
          try {
            await callMethod(cur.roomCode, 'next_round', [], 0n,
              'Advance to next round')
          } catch (e) {
            console.warn('[genjury] auto next_round:', e?.message || e)
          }
        }
        _autoAdvancing = false
      }, 6000)
      return
    } else {
      return
    }
  } catch (e) {
    console.warn('[genjury] auto-advance:', e?.message || e)
  } finally {
    if (phase !== 'reveal') _autoAdvancing = false
  }
}

function applyContractState(get, s) {
  const local = get()
  const newPhase = s.phase || PHASES.LOBBY
  const phaseChanged = local.phase !== newPhase

  // Statements / lieIndex: keep local drafts during WRITING until submitted.
  const inWritingDraft =
    newPhase === PHASES.WRITING && !s.submitted &&
    norm(s.deceiver) === local.myId
  const statements = inWritingDraft
    ? local.statements
    : (s.statements || ['', '', ''])
  const lieIndex = inWritingDraft
    ? local.lieIndex
    : (s.submitted ? Number(s.lieIndex) : null)

  const next = {
    phase:          newPhase,
    round:          Number(s.round || 0),
    maxRounds:      Number(s.maxRounds || 3),
    maxPlayers:     Number(s.maxPlayers || 8),
    hostAddress:    norm(s.host) || null,
    category:       s.category || '',
    deceiverIndex:  Number(s.deceiverIndex || 0),
    players:        mapPlayers(s),
    statements,
    lieIndex,
    votes:          mapVotes(s),
    confidence:     mapConfidence(s),
    aiVerdict:      mapAiVerdict(s),
    objectionRaised: !!s.objectionRaised,
    objectionBy:    s.objectionBy ? norm(s.objectionBy) : null,
    objectionVotes: mapObjectionVotes(s),
    revealData:     mapReveal(s),
    // ── Economics (wei kept as BigInt, addresses lower-cased for compares) ──
    entryFeeWei:  safeBigInt(s.entryFee),
    prizePoolWei: safeBigInt(s.prizePool),
    // House cut: the contract returns `house` + `houseCutBps` + `houseFeesCollected`,
    // and aliases them to the legacy `platformOwner` / `platformFeeBps` /
    // `platformFeesCollected` names so older deployments keep working.
    houseAddress:             norm(s.house || s.platformOwner) || null,
    houseCutBps:              Number(s.houseCutBps ?? s.platformFeeBps ?? 0),
    houseFeesCollectedWei:    safeBigInt(s.houseFeesCollected ?? s.platformFeesCollected),
    winnerAddress:            norm(s.winnerAddress) || null,
    winnerWinningsWei:        safeBigInt(s.winnerWinningsWei),
    prizeDistributed:         !!s.prizeDistributed,
  }

  if (phaseChanged) {
    next.timer = PHASE_TIMERS[newPhase] ?? 0
    next.timerMax = PHASE_TIMERS[newPhase] ?? 0
  }

  useGameStore.setState(next)
}

// ── Toasts ──────────────────────────────────────────────────────────────────
function pushToast(type, message) {
  const id = nanoid(6)
  useGameStore.setState((s) => ({ toasts: [...s.toasts, { id, type, message }] }))
  setTimeout(() => {
    useGameStore.setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
  }, 4000)
}

// React to wallet changes (mode swap or account change) by realigning myId.
subscribeWallet(() => {
  try {
    useGameStore.setState({ myId: norm(myAddress()) })
  } catch {}
})

// Mirror on-chain transaction lifecycle into the store so the global
// TxStatusBanner can render it. Confirmed/failed events live for ~5s
// and then auto-clear (unless replaced by a newer transaction).
let _clearTxTimer = null
subscribeTx((evt) => {
  const next = {
    id:     evt.id,
    label:  evt.label,
    status: evt.status,
    hash:   evt.hash || null,
    error:  evt.error || null,
    at:     Date.now(),
  }
  useGameStore.setState({ pendingTx: next })

  if (_clearTxTimer) { clearTimeout(_clearTxTimer); _clearTxTimer = null }
  if (evt.status === 'confirmed' || evt.status === 'failed') {
    const ttl = evt.status === 'failed' ? 7000 : 4000
    _clearTxTimer = setTimeout(() => {
      const cur = useGameStore.getState().pendingTx
      if (cur && cur.id === next.id) {
        useGameStore.setState({ pendingTx: null })
      }
    }, ttl)
  }
})

// ── Store ───────────────────────────────────────────────────────────────────
const useGameStore = create((set, get) => ({
  // ── Identity / room ─────────────────────────────────────────────────
  roomCode: null,
  myId:     null,
  loading:  false,

  // ── Last Join-Room preview diagnostic ───────────────────────────────
  // Populated by `previewRoom` so the Join screen can show a precise,
  // actionable error (vs. a single generic "no room found" line).
  lastPreviewDiagnostic: null,

  // ── Game state (mirrors contract) ───────────────────────────────────
  phase:          PHASES.LOBBY,
  round:          0,
  maxRounds:      3,
  maxPlayers:     8,
  hostAddress:    null,
  category:       '',
  players:        [],
  deceiverIndex:  0,

  statements:     ['', '', ''],
  lieIndex:       null,
  votes:          {},
  confidence:     {},

  aiVerdict:      null,

  objectionRaised: false,
  objectionBy:     null,
  objectionVotes:  {},

  revealData:     null,
  scoreHistory:   [],

  // ── Economics (mirrors contract) ────────────────────────────────────
  entryFeeWei:           0n,
  prizePoolWei:          0n,
  // House cut — flat 3.00% of every entry fee, paid to the deployer wallet.
  houseAddress:          null,
  houseCutBps:           0,    // 300 once a contract is loaded; 0 means "unknown / no room"
  houseFeesCollectedWei: 0n,
  winnerAddress:         null,
  winnerWinningsWei:     0n,
  prizeDistributed:      true,

  // ── Local-only ──────────────────────────────────────────────────────
  timer:          0,
  timerMax:       0,
  toasts:         [],
  pendingTx:      null,    // { id, label, status, hash, error, at }
  chatMessages:   [],      // { id, authorId, authorName, avatar, color, text, kind, ts }

  // ── Navigation (out-of-game tabs) ───────────────────────────────────
  activeTab:        'home',           // 'home' | 'mistrial' | 'games' | 'leaderboard' | 'profile'
  walletPanelOpen:  false,
  setActiveTab:       (tab)  => set({ activeTab: tab }),
  setWalletPanelOpen: (open) => set({ walletPanelOpen: !!open }),

  // ── Toasts / timer ──────────────────────────────────────────────────
  addToast: (message, type = 'info') => pushToast(type, message),

  tickTimer: () => {
    const { timer } = get()
    if (timer > 0) set({ timer: timer - 1 })
  },

  // ── Chat ────────────────────────────────────────────────────────────
  pushChat: (msg) => set((s) => {
    if (!msg || !msg.id) return s
    if (s.chatMessages.some((m) => m.id === msg.id)) return s
    const next = [...s.chatMessages, msg]
    next.sort((a, b) => a.ts - b.ts)
    if (next.length > CHAT_BUFFER_MAX) next.splice(0, next.length - CHAT_BUFFER_MAX)
    return { chatMessages: next }
  }),
  clearChat: () => set({ chatMessages: [] }),

  // ── Room lifecycle ──────────────────────────────────────────────────
  /**
   * Deploy a fresh Genjury contract and join it as the host.
   *
   * @param {string} name
   * @param {object} [opts]
   * @param {bigint} [opts.entryFeeWei=0n]   Wei each player pays to join.
   * @param {number} [opts.maxRounds=3]      Total rounds in the game.
   */
    createRoom: async (name, opts = {}) => {
    if (get().loading) return
    const me = norm(myAddress())
    if (!me) {
      pushToast('error', 'Connect your wallet first to create a room')
      return
    }
    set({ loading: true, chatMessages: [] })
    pushToast('info', 'Deploying contract to GenLayer…')
    try {
      const entryFeeWei = typeof opts.entryFeeWei === 'bigint'
        ? opts.entryFeeWei
        : BigInt(opts.entryFeeWei || 0)
      const maxRounds = Math.max(1, Number(opts.maxRounds ?? 3))

      const addr = await deployGenjury({
        maxRounds,
        entryFeeWei,
      })
      rememberRoom(addr)
      // Seed the store with what we already know about the freshly-deployed
      // contract so the Lobby renders with the correct entry fee / round count
      // immediately, instead of flashing default 0-GEN "free-play" copy until
      // the first chain poll completes after the join confirms.
      set({
        roomCode:     addr,
        myId:         me,
        phase:        PHASES.LOBBY,
        maxRounds,
        entryFeeWei,
        prizePoolWei: 0n,
        houseAddress: me,           // deployer is always the house
        houseCutBps:  300,          // hardcoded 3% in the contract
      })
      // Start polling immediately — the contract is live, so the lobby can
      // already pull authoritative state while the join tx is in flight.
      startPolling(get)
      pushToast('success', 'Contract deployed — joining…')
      await callMethod(addr, 'join', [name], entryFeeWei,
        entryFeeWei > 0n ? 'Join room (paying entry fee)' : 'Join room')
      pushToast('success', 'Room created!')
      set({ loading: false })
    } catch (e) {
      console.error(e)
      set({ loading: false, roomCode: null })
      forgetRoom()
      pushToast('error', `Could not create room: ${e?.shortMessage || e?.message || e}`)
    }
  },

    joinRoom: async (code, name) => {
    if (get().loading) return
    const me = norm(myAddress())
    if (!me) {
      pushToast('error', 'Connect your wallet first to join a room')
      return
    }
    set({ loading: true, chatMessages: [] })
    const addr = code.trim()
    set({ roomCode: addr, myId: me })
    rememberRoom(addr)
    try {
      const raw = await readView(addr, 'get_state')
      const parsed = parseContractPayload(raw) || {}
      const fee = safeBigInt(parsed?.entryFee)
      const playersMap = parsed?.players || {}
      const alreadyIn = !!(playersMap[me] || playersMap[myAddress()])
      // Seed the store with the room's real economics + phase BEFORE awaiting
      // the join transaction, so the lobby shows the correct entry fee and
      // prize pool right away instead of flashing default 0-GEN values.
      applyContractState(get, parsed)
      // Start polling immediately so the lobby keeps refreshing while the
      // join tx is pending.
      startPolling(get)
      if (!alreadyIn) {
        await callMethod(addr, 'join', [name], fee,
          fee > 0n ? 'Join room (paying entry fee)' : 'Join room')
      }
      pushToast('success', 'Joined room!')
      set({ loading: false })
    } catch (e) {
      console.error(e)
      set({ loading: false, roomCode: null })
      forgetRoom()
      pushToast('error', `Could not join: ${e?.shortMessage || e?.message || e}`)
    }
  },

  /**
   * Look up a room's economics (entry fee, prize pool, etc.) without joining.
   * Used by the Join screen to preview the cost before the user commits.
   */
  previewRoom: async (code) => {
    const addr = (code || '').trim()
    if (!addr) {
      set({ lastPreviewDiagnostic: null })
      return null
    }
    try {
      const diag = await diagnoseAddress(addr)
      set({ lastPreviewDiagnostic: diag })
      if (diag.kind === 'ok') {
        const raw = diag.data
        return {
          address:      addr,
          entryFeeWei:  safeBigInt(raw?.entryFee),
          prizePoolWei: safeBigInt(raw?.prizePool),
          playerCount:  Number(raw?.playerCount || 0),
          maxPlayers:   Number(raw?.maxPlayers || 0),
          phase:        raw?.phase || 'lobby',
          host:         raw?.host || '',
        }
      }
      console.warn('[genjury] previewRoom diagnostic:', diag)
      return null
    } catch (e) {
      console.warn('[genjury] previewRoom:', e?.message || e)
      set({
        lastPreviewDiagnostic: {
          kind: 'rpc_error',
          address: addr,
          message: e?.shortMessage || e?.message || String(e),
        },
      })
      return null
    }
  },

  addBotPlayers: () => {
    pushToast('warning', 'Bots aren\'t supported on-chain — share the room code with friends to fill the lobby.')
  },

  startGame: async () => {
    const { roomCode, phase } = get()
    if (!roomCode) return
    try {
      // "Play Again" from the scoreboard: bring the room back to lobby first.
      // The contract enforces that any pending prize / dev fees are claimed
      // before this call succeeds.
      if (phase === PHASES.SCOREBOARD) {
        await callMethod(roomCode, 'reset_to_lobby', [], 0n, 'Reset room to lobby')
      }
      await callMethod(roomCode, 'start_game', [], 0n, 'Start the game')
      refreshState(get)
    } catch (e) {
      pushToast('error', e?.shortMessage || e?.message || 'Could not start game')
    }
  },

  // ── Host admin actions ──────────────────────────────────────────────
  // All of these mirror the host-only setters added in contracts/genjury.py.
  // The contract enforces phase / role guards, so we just translate inputs,
  // call the method, surface a toast on failure, and re-poll on success.

  setEntryFee: async (humanGenStr) => {
    const { roomCode } = get()
    if (!roomCode) return
    let wei
    try {
      wei = parseGen(humanGenStr)
    } catch (e) {
      pushToast('error', e?.message || 'Invalid GEN amount')
      return
    }
    try {
      await callMethod(roomCode, 'set_entry_fee', [wei], 0n, 'Update entry fee')
      pushToast('success', 'Entry fee updated')
      refreshState(get)
    } catch (e) {
      pushToast('error', e?.shortMessage || e?.message || 'Could not change entry fee')
    }
  },

  setMaxRounds: async (n) => {
    const { roomCode } = get()
    if (!roomCode) return
    const rounds = Math.floor(Number(n))
    if (!Number.isFinite(rounds) || rounds < 1 || rounds > 50) {
      pushToast('error', 'Rounds must be a whole number between 1 and 50')
      return
    }
    try {
      await callMethod(roomCode, 'set_max_rounds', [rounds], 0n, 'Update max rounds')
      pushToast('success', `Max rounds set to ${rounds}`)
      refreshState(get)
    } catch (e) {
      pushToast('error', e?.shortMessage || e?.message || 'Could not change max rounds')
    }
  },

  setMaxPlayers: async (n) => {
    const { roomCode } = get()
    if (!roomCode) return
    const cap = Math.floor(Number(n))
    if (!Number.isFinite(cap) || cap < 2 || cap > 12) {
      pushToast('error', 'Player cap must be between 2 and 12')
      return
    }
    try {
      await callMethod(roomCode, 'set_max_players', [cap], 0n, 'Update max players')
      pushToast('success', `Max players set to ${cap}`)
      refreshState(get)
    } catch (e) {
      pushToast('error', e?.shortMessage || e?.message || 'Could not change max players')
    }
  },

  kickPlayer: async (addr) => {
    const { roomCode } = get()
    if (!roomCode) return
    const target = (addr || '').trim().toLowerCase()
    if (!/^0x[0-9a-f]{40}$/.test(target)) {
      pushToast('error', 'Invalid player address')
      return
    }
    try {
      await callMethod(roomCode, 'kick_player', [target], 0n, `Kick ${target.slice(0, 6)}…`)
      pushToast('success', 'Player kicked and refunded')
      refreshState(get)
    } catch (e) {
      pushToast('error', e?.shortMessage || e?.message || 'Could not kick player')
    }
  },

  transferHost: async (addr) => {
    const { roomCode } = get()
    if (!roomCode) return
    const target = (addr || '').trim().toLowerCase()
    if (!/^0x[0-9a-f]{40}$/.test(target)) {
      pushToast('error', 'New host must be a valid 0x… address')
      return
    }
    try {
      await callMethod(roomCode, 'transfer_host', [target], 0n, 'Transfer host role')
      pushToast('success', 'Host role transferred')
      refreshState(get)
    } catch (e) {
      pushToast('error', e?.shortMessage || e?.message || 'Could not transfer host')
    }
  },

  resetToLobby: async () => {
    const { roomCode } = get()
    if (!roomCode) return
    try {
      await callMethod(roomCode, 'reset_to_lobby', [], 0n, 'Reset room to lobby')
      pushToast('success', 'Room reset to lobby')
      refreshState(get)
    } catch (e) {
      pushToast('error', e?.shortMessage || e?.message || 'Could not reset room')
    }
  },

  // ── Writing phase ───────────────────────────────────────────────────
  setStatement: (i, val) => {
    const next = [...get().statements]
    next[i] = val
    set({ statements: next })
  },

  setLieIndex: (i) => set({ lieIndex: i }),

  submitStatements: async () => {
    const { roomCode, statements, lieIndex } = get()
    if (!roomCode || lieIndex === null) return
    try {
      await callMethod(roomCode, 'submit_statements', [
        statements[0] || '',
        statements[1] || '',
        statements[2] || '',
        Number(lieIndex),
      ], 0n, 'Submit your statements')
      pushToast('success', 'Statements submitted!')
      refreshState(get)
    } catch (e) {
      pushToast('error', e?.shortMessage || e?.message || 'Submit failed')
    }
  },

  // ── Voting phase ────────────────────────────────────────────────────
  castVote: async (_playerId, idx, conf) => {
    const { roomCode } = get()
    if (!roomCode) return
    const confPct = Math.max(0, Math.min(100, Math.round(Number(conf) * 100)))
    try {
      await callMethod(roomCode, 'cast_vote', [Number(idx), confPct], 0n, 'Cast your vote')
      refreshState(get)
    } catch (e) {
      pushToast('error', e?.shortMessage || e?.message || 'Vote failed')
    }
  },

  proceedToAIJudge: async () => {
    const { roomCode, phase } = get()
    if (!roomCode) return
    try {
      if (phase === PHASES.VOTING) {
        try { await callMethod(roomCode, 'force_close_voting', [], 0n, 'Close voting') } catch {/* not host */}
      }
      await callMethod(roomCode, 'run_ai_judge', [], 0n, 'Summon the AI Judge')
      refreshState(get)
    } catch (e) {
      console.warn('[genjury] run_ai_judge:', e?.message || e)
      refreshState(get)
    }
  },

  // ── Objection phase ─────────────────────────────────────────────────
  raiseObjection: async (_playerId) => {
    const { roomCode } = get()
    if (!roomCode) return
    try {
      await callMethod(roomCode, 'raise_objection', [], 0n, 'Raise objection')
      refreshState(get)
    } catch (e) {
      pushToast('error', e?.shortMessage || e?.message || 'Objection failed')
    }
  },

  castObjectionVote: async (_playerId, stance) => {
    const { roomCode } = get()
    if (!roomCode) return
    try {
      await callMethod(roomCode, 'cast_objection_vote', [stance], 0n, 'Vote on objection')
      refreshState(get)
    } catch (e) {
      pushToast('error', e?.shortMessage || e?.message || 'Objection vote failed')
    }
  },

  finalizeRound: async () => {
    const { roomCode, phase } = get()
    if (!roomCode) return
    try {
      if (phase === PHASES.OBJECTION) {
        await callMethod(roomCode, 'skip_objection', [], 0n, 'Skip objection')
      } else if (phase === PHASES.OBJECTION_VOTE) {
        await callMethod(roomCode, 'close_objection_vote', [], 0n, 'Close objection vote')
      }
      refreshState(get)
    } catch (e) {
      console.warn('[genjury] finalizeRound:', e?.message || e)
      refreshState(get)
    }
  },

  nextRound: async () => {
    const { roomCode } = get()
    if (!roomCode) return
    try {
      await callMethod(roomCode, 'next_round', [], 0n, 'Advance to next round')
      refreshState(get)
    } catch (e) {
      pushToast('error', e?.shortMessage || e?.message || 'Could not advance round')
    }
  },

  // ── Settlement (winner claims the prize) ────────────────────────────
  claimPrize: async () => {
    const { roomCode } = get()
    if (!roomCode) return
    try {
      await callMethod(roomCode, 'claim_prize', [], 0n, 'Claim prize')
      pushToast('success', 'Prize claimed — funds in your wallet')
      refreshState(get)
    } catch (e) {
      pushToast('error', e?.shortMessage || e?.message || 'Could not claim prize')
    }
  },

  // ── House (deployer) sweeps the accumulated 3% cut ──────────────────
  // Calls the new `claim_house_fees` method; falls back to the legacy
  // `claim_platform_fees` shim so older contracts deployed before the
  // rename still work.
  claimHouseFees: async () => {
    const { roomCode } = get()
    if (!roomCode) return
    try {
      await callMethod(roomCode, 'claim_house_fees', [], 0n, 'Claim house fees')
      pushToast('success', 'House fees swept — funds in your wallet')
      refreshState(get)
    } catch (e) {
      const msg = e?.shortMessage || e?.message || ''
      // Old deployments don't have claim_house_fees yet — try the alias.
      if (/method.*not.*found|unknown method|no.*method/i.test(msg)) {
        try {
          await callMethod(roomCode, 'claim_platform_fees', [], 0n, 'Claim house fees')
          pushToast('success', 'House fees swept — funds in your wallet')
          refreshState(get)
          return
        } catch (e2) {
          pushToast('error', e2?.shortMessage || e2?.message || 'Could not claim house fees')
          return
        }
      }
      pushToast('error', msg || 'Could not claim house fees')
    }
  },

  // ── Reset to landing page ───────────────────────────────────────────
  resetGame: () => {
    stopPolling()
    forgetRoom()
    set({
      roomCode:        null,
      myId:            null,
      loading:         false,
      phase:           PHASES.LOBBY,
      round:           0,
      maxRounds:       3,
      category:        '',
      players:         [],
      deceiverIndex:   0,
      statements:      ['', '', ''],
      lieIndex:        null,
      votes:           {},
      confidence:      {},
      aiVerdict:       null,
      objectionRaised: false,
      objectionBy:     null,
      objectionVotes:  {},
      revealData:      null,
      scoreHistory:    [],
      timer:           0,
      timerMax:        0,
      pendingTx:       null,
      chatMessages:    [],
      entryFeeWei:           0n,
      prizePoolWei:          0n,
      houseAddress:          null,
      houseCutBps:           0,
      houseFeesCollectedWei: 0n,
      winnerAddress:         null,
      winnerWinningsWei:     0n,
      prizeDistributed:      true,
    })
  },
}))

// Build scoreHistory from contract reveal data so the scoreboard can render
// per-round XP breakdowns. Idempotent: only writes when a new round's reveal
// actually arrives, otherwise the poll cycle would churn it every tick.
useGameStore.subscribe((state) => {
  if (!state.revealData) return
  const idx = state.revealData.round - 1
  if (idx < 0) return
  const existing = state.scoreHistory[idx]
  if (existing && existing.round === state.revealData.round) return
  const sh = [...state.scoreHistory]
  sh[idx] = { round: state.revealData.round, xpGained: state.revealData.xpGained }
  useGameStore.setState({ scoreHistory: sh })
})

export default useGameStore
