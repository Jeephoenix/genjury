// ──────────────────────────────────────────────────────────────────────────────
// Genjury — game store (mirrors the on-chain Genjury contract).
//
// Every gameplay action ends in a contract write. A polling loop pulls the
// authoritative state via `get_state` every ~1.5s and reshapes it for the UI.
//
// On top of the original game state we also surface the contract economics:
//   * entry fee (wei) every player pays to join
//   * platform fee bps + platform owner address
//   * accumulated prize pool + platform fees
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
  rememberRoom,
  forgetRoom,
  subscribeWallet,
  subscribeTx,
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

async function refreshState(get) {
  const code = get().roomCode
  if (!code) return
  try {
    const raw = await readView(code, 'get_state')
    applyContractState(get, raw)
  } catch (err) {
    console.warn('[genjury] poll failed:', err?.message || err)
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
    // ── Economics (wei kept as BigInt, owner lower-cased for compares) ──
    entryFeeWei:              safeBigInt(s.entryFee),
    prizePoolWei:             safeBigInt(s.prizePool),
    platformFeeBps:           Number(s.platformFeeBps || 0),
    platformOwner:            norm(s.platformOwner) || null,
    platformFeesCollectedWei: safeBigInt(s.platformFeesCollected),
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

  // ── Game state (mirrors contract) ───────────────────────────────────
  phase:          PHASES.LOBBY,
  round:          0,
  maxRounds:      3,
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
  entryFeeWei:              0n,
  prizePoolWei:             0n,
  platformFeeBps:           0,
  platformOwner:            null,
  platformFeesCollectedWei: 0n,
  winnerAddress:            null,
  winnerWinningsWei:        0n,
  prizeDistributed:         true,

  // ── Local-only ──────────────────────────────────────────────────────
  timer:          0,
  timerMax:       0,
  toasts:         [],
  pendingTx:      null,    // { id, label, status, hash, error, at }
  chatMessages:   [],      // { id, authorId, authorName, avatar, color, text, kind, ts }

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
   * @param {bigint} [opts.entryFeeWei=0n]    Wei each player pays to join.
   * @param {number} [opts.platformFeeBps=0]  Basis points routed to the platform owner.
   * @param {number} [opts.maxRounds=3]       Total rounds in the game.
   * @param {string} [opts.platformOwner]     Optional platform-owner address;
   *                                          defaults to the deployer.
   */
  createRoom: async (name, opts = {}) => {
    if (get().loading) return
    set({ loading: true, chatMessages: [] })
    pushToast('info', 'Deploying contract to GenLayer…')
    try {
      const entryFeeWei = typeof opts.entryFeeWei === 'bigint'
        ? opts.entryFeeWei
        : BigInt(opts.entryFeeWei || 0)
      const platformFeeBps = Number(opts.platformFeeBps ?? 0) | 0
      const maxRounds = Math.max(1, Number(opts.maxRounds ?? 3))
      const platformOwner = opts.platformOwner || ''

      const addr = await deployGenjury({
        maxRounds,
        entryFeeWei,
        platformFeeBps,
        platformOwner,
      })
      rememberRoom(addr)
      const me = norm(myAddress())
      set({ roomCode: addr, myId: me })
      pushToast('success', 'Contract deployed — joining…')
      await callMethod(addr, 'join', [name], entryFeeWei,
        entryFeeWei > 0n ? 'Join room (paying entry fee)' : 'Join room')
      pushToast('success', 'Room created!')
      set({ loading: false })
      startPolling(get)
    } catch (e) {
      console.error(e)
      set({ loading: false, roomCode: null })
      forgetRoom()
      pushToast('error', `Could not create room: ${e?.shortMessage || e?.message || e}`)
    }
  },

  joinRoom: async (code, name) => {
    if (get().loading) return
    set({ loading: true, chatMessages: [] })
    const addr = code.trim()
    const me = norm(myAddress())
    set({ roomCode: addr, myId: me })
    rememberRoom(addr)
    try {
      const raw = await readView(addr, 'get_state')
      const fee = safeBigInt(raw?.entryFee)
      const playersMap = raw?.players || {}
      const alreadyIn = !!(playersMap[me] || playersMap[myAddress()])
      if (!alreadyIn) {
        await callMethod(addr, 'join', [name], fee,
          fee > 0n ? 'Join room (paying entry fee)' : 'Join room')
      }
      pushToast('success', 'Joined room!')
      set({ loading: false })
      startPolling(get)
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
    if (!addr) return null
    try {
      const raw = await readView(addr, 'get_economics')
      return {
        address:                  addr,
        entryFeeWei:              safeBigInt(raw?.entryFee),
        prizePoolWei:             safeBigInt(raw?.prizePool),
        platformFeeBps:           Number(raw?.platformFeeBps || 0),
        platformOwner:            raw?.platformOwner || '',
        platformFeesCollectedWei: safeBigInt(raw?.platformFeesCollected),
        playerCount:              Number(raw?.playerCount || 0),
        maxPlayers:               Number(raw?.maxPlayers || 0),
        phase:                    raw?.phase || 'lobby',
        host:                     raw?.host || '',
      }
    } catch (e) {
      console.warn('[genjury] previewRoom:', e?.message || e)
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
      // The contract enforces that any pending prize / platform fees are
      // claimed before this call succeeds.
      if (phase === PHASES.SCOREBOARD) {
        await callMethod(roomCode, 'reset_to_lobby', [], 0n, 'Reset room to lobby')
      }
      await callMethod(roomCode, 'start_game', [], 0n, 'Start the game')
      refreshState(get)
    } catch (e) {
      pushToast('error', e?.shortMessage || e?.message || 'Could not start game')
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

  // ── Settlement (winner + platform owner claims) ─────────────────────
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

  claimPlatformFees: async () => {
    const { roomCode } = get()
    if (!roomCode) return
    try {
      await callMethod(roomCode, 'claim_platform_fees', [], 0n, 'Sweep platform fees')
      pushToast('success', 'Platform fees swept to your wallet')
      refreshState(get)
    } catch (e) {
      pushToast('error', e?.shortMessage || e?.message || 'Could not claim platform fees')
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
      entryFeeWei:              0n,
      prizePoolWei:             0n,
      platformFeeBps:           0,
      platformOwner:            null,
      platformFeesCollectedWei: 0n,
      winnerAddress:            null,
      winnerWinningsWei:        0n,
      prizeDistributed:         true,
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
