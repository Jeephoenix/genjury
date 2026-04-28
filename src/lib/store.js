// ──────────────────────────────────────────────────────────────────────────────
// Genjury — game store
//
// This used to be a fully in-memory mock. It now mirrors the on-chain
// Genjury contract:
//
//   * createRoom  -> deploys the contract + joins
//   * joinRoom    -> joins an existing contract address
//   * every action ends in a contract write, then a poll cycle pulls the
//     authoritative state via get_state and reshapes it to match the
//     existing UI's state shape (so no page changes are required).
//
// Local-only state (kept on the client):
//   * timer / timerMax — ticked by App.jsx every second
//   * toasts
//   * "draft" statements + lieIndex during WRITING (typing buffer; not
//     overwritten by polling until the deceiver actually submits)
// ──────────────────────────────────────────────────────────────────────────────

import { create } from 'zustand'
import { nanoid } from 'nanoid'

import {
  myAddress,
  deployGenjury,
  callMethod,
  readView,
  rememberRoom,
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

// ── Helpers ─────────────────────────────────────────────────────────────────
const norm = (a) => (typeof a === 'string' ? a.toLowerCase() : a)

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
  // contract: votes is { addr: int }
  const out = {}
  for (const [k, v] of Object.entries(state.votes || {})) {
    out[norm(k)] = Number(v)
  }
  return out
}

function mapConfidence(state) {
  // contract sends 0..100 ints; UI uses 0..1 floats
  const out = {}
  for (const [k, v] of Object.entries(state.confidence || {})) {
    out[norm(k)] = Number(v) / 100
  }
  return out
}

function mapObjectionVotes(state) {
  const out = {}
  for (const [k, v] of Object.entries(state.objectionVotes || {})) {
    out[norm(k)] = v
  }
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
  // Also do an immediate refresh.
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
    // Transient RPC errors are fine — just try again next tick.
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
  }

  // Reset the visible timer when the phase changes.
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

  // Round data
  statements:     ['', '', ''],
  lieIndex:       null,
  votes:          {},
  confidence:     {},

  // AI verdict
  aiVerdict:      null,

  // Objection
  objectionRaised: false,
  objectionBy:     null,
  objectionVotes:  {},

  // Reveal
  revealData:     null,
  scoreHistory:   [],

  // ── Local-only ──────────────────────────────────────────────────────
  timer:          0,
  timerMax:       0,
  toasts:         [],

  // ── Toasts / timer ──────────────────────────────────────────────────
  addToast: (message, type = 'info') => pushToast(type, message),

  tickTimer: () => {
    const { timer } = get()
    if (timer > 0) set({ timer: timer - 1 })
  },

  // ── Room lifecycle ──────────────────────────────────────────────────
  createRoom: async (name) => {
    if (get().loading) return
    set({ loading: true })
    pushToast('info', 'Deploying contract to GenLayer…')
    try {
      const addr = await deployGenjury(3)
      rememberRoom(addr)
      const me = norm(myAddress())
      set({ roomCode: addr, myId: me, loading: false })
      pushToast('success', 'Contract deployed — joining…')
      await callMethod(addr, 'join', [name])
      pushToast('success', 'Room created!')
      startPolling(get)
    } catch (e) {
      console.error(e)
      set({ loading: false, roomCode: null })
      pushToast('error', `Could not create room: ${e?.shortMessage || e?.message || e}`)
    }
  },

  joinRoom: async (code, name) => {
    if (get().loading) return
    set({ loading: true })
    const addr = code.trim()
    const me = norm(myAddress())
    set({ roomCode: addr, myId: me })
    rememberRoom(addr)
    try {
      // First, peek at the contract to make sure it exists and is in lobby.
      const raw = await readView(addr, 'get_state')
      const alreadyIn = !!(raw?.players && (raw.players[me] || raw.players[myAddress()]))
      if (!alreadyIn) {
        await callMethod(addr, 'join', [name])
      }
      pushToast('success', 'Joined room!')
      set({ loading: false })
      startPolling(get)
    } catch (e) {
      console.error(e)
      set({ loading: false, roomCode: null })
      pushToast('error', `Could not join: ${e?.shortMessage || e?.message || e}`)
    }
  },

  // Bots aren't possible on-chain (each player needs a real wallet).
  addBotPlayers: () => {
    pushToast('warning', 'Bots aren\'t supported on-chain — share the room code with friends to fill the lobby.')
  },

  startGame: async () => {
    const { roomCode, phase } = get()
    if (!roomCode) return
    try {
      // "Play Again" from the scoreboard: bring the room back to lobby first.
      if (phase === PHASES.SCOREBOARD) {
        await callMethod(roomCode, 'reset_to_lobby', [])
      }
      await callMethod(roomCode, 'start_game', [])
      refreshState(get)
    } catch (e) {
      pushToast('error', e?.shortMessage || e?.message || 'Could not start game')
    }
  },

  // ── Writing phase (local drafts, then submit) ───────────────────────
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
      ])
      pushToast('success', 'Statements submitted!')
      refreshState(get)
    } catch (e) {
      pushToast('error', e?.shortMessage || e?.message || 'Submit failed')
    }
  },

  // ── Voting phase ────────────────────────────────────────────────────
  // Signature kept compatible with VotingPhase: castVote(playerId, idx, conf 0..1)
  castVote: async (_playerId, idx, conf) => {
    const { roomCode } = get()
    if (!roomCode) return
    const confPct = Math.max(0, Math.min(100, Math.round(Number(conf) * 100)))
    try {
      await callMethod(roomCode, 'cast_vote', [Number(idx), confPct])
      refreshState(get)
    } catch (e) {
      pushToast('error', e?.shortMessage || e?.message || 'Vote failed')
    }
  },

  proceedToAIJudge: async () => {
    const { roomCode, phase } = get()
    if (!roomCode) return
    try {
      // If voting is still open, host can force-close.
      if (phase === PHASES.VOTING) {
        try { await callMethod(roomCode, 'force_close_voting', []) } catch {/* not host or already closed */}
      }
      await callMethod(roomCode, 'run_ai_judge', [])
      refreshState(get)
    } catch (e) {
      // Likely "Already judged" because another client beat us to it — not an error.
      console.warn('[genjury] run_ai_judge:', e?.message || e)
      refreshState(get)
    }
  },

  // ── Objection phase ─────────────────────────────────────────────────
  raiseObjection: async (_playerId) => {
    const { roomCode } = get()
    if (!roomCode) return
    try {
      await callMethod(roomCode, 'raise_objection', [])
      refreshState(get)
    } catch (e) {
      pushToast('error', e?.shortMessage || e?.message || 'Objection failed')
    }
  },

  castObjectionVote: async (_playerId, stance) => {
    const { roomCode } = get()
    if (!roomCode) return
    try {
      await callMethod(roomCode, 'cast_objection_vote', [stance])
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
        await callMethod(roomCode, 'skip_objection', [])
      } else if (phase === PHASES.OBJECTION_VOTE) {
        await callMethod(roomCode, 'close_objection_vote', [])
      }
      refreshState(get)
    } catch (e) {
      // Race-loss — someone else closed it. Just refresh.
      console.warn('[genjury] finalizeRound:', e?.message || e)
      refreshState(get)
    }
  },

  // ── Round progression ───────────────────────────────────────────────
  nextRound: async () => {
    const { roomCode } = get()
    if (!roomCode) return
    try {
      await callMethod(roomCode, 'next_round', [])
      refreshState(get)
    } catch (e) {
      pushToast('error', e?.shortMessage || e?.message || 'Could not advance round')
    }
  },

  resetGame: () => {
    stopPolling()
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
