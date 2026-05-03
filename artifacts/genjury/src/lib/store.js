// Genjury — game store (mirrors the singleton on-chain Genjury contract).
//
// Every gameplay action ends in a contract write. A polling loop pulls the
// authoritative state via `get_room_state(roomCode)` every ~1.5s and reshapes
// it for the UI.
//
// `roomCode` here is a 6-char alphanumeric string (e.g. "TRIAL9"), NOT a
// contract address. The contract address itself is the singleton deployed by
// the platform owner and configured via VITE_GENJURY_CONTRACT.

import { create } from 'zustand'
import { nanoid } from 'nanoid'

import {
  myAddress,
  callMethod,
  callMethodForResult,
  readView,
  requireContractAddress,
  hasContractAddress,
  subscribeWallet,
  subscribeTx,
  isValidRoomCode,
  normalizeRoomCode,
  formatGen,
  getChainNativeSymbol,
} from './genlayer'
import { getProfile } from './profile'
import { rememberJoinedRoom, forgetJoinedRoom, markRoomFinished } from './joinedRooms'
import { registerMember, clearRoom } from './chatApi'

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

const norm = (a) => (typeof a === 'string' ? a.toLowerCase() : a)

function safeBigInt(v) {
  if (v === undefined || v === null || v === '') return 0n
  if (typeof v === 'bigint') return v
  try { return BigInt(v) } catch { return 0n }
}

// Returns true when a blockchain transaction is already in-flight, blocking
// additional calls until the current one resolves or fails.
function isTxBusy(get) {
  const s = get().pendingTx?.status
  return s === 'awaiting_signature' || s === 'pending'
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
      avatar:   rec.avatar || '',
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
  if (!hasContractAddress()) return
  try {
    const raw = await readView(requireContractAddress(), 'get_room_state', [code])
    const parsed = parseContractPayload(raw)
    if (!parsed) return
    applyContractState(get, parsed)
    maybeAutoAdvance(get, parsed)
  } catch (err) {
    console.warn('[genjury] poll failed:', err?.message || err)
  }
}

let _autoAdvancing = false
// Track which room codes have already had run_ai_judge submitted so the
// polling loop never re-triggers the wallet popup after the tx is sent.
const _aiJudgeAttempted = new Set()

async function maybeAutoAdvance(get, s) {
  if (_autoAdvancing) return
  const state = get()
  const myId = state.myId
  const host = norm(s?.host)
  if (!host || !myId || host !== myId) return

  const phase = s?.phase
  const code = state.roomCode
  // Only auto-advance through AI judging — the host triggers run_ai_judge
  // automatically so the rest of the players don't have to wait. The reveal →
  // next_round transition is intentionally left to a manual button click so
  // the winner has time to review results and claim rewards.
  if (phase !== 'ai_judging' || s?.aiJudged) return
  // Already submitted for this room — don't prompt the wallet again.
  if (_aiJudgeAttempted.has(code)) return
  try {
    _autoAdvancing = true
    // Mark before awaiting so concurrent polling ticks are also blocked.
    _aiJudgeAttempted.add(code)
    await callMethod(requireContractAddress(), 'run_ai_judge', [code], 0n,
      'Summon the AI Judge')
  } catch (e) {
    console.warn('[genjury] auto-advance:', e?.message || e)
    // Allow one retry if the tx failed (e.g. user rejected).
    _aiJudgeAttempted.delete(code)
  } finally {
    _autoAdvancing = false
  }
}

function applyContractState(get, s) {
  const local = get()
  const newPhase = s.phase || PHASES.LOBBY
  const phaseChanged = local.phase !== newPhase

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
    hostName:       s.hostName || '',
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
    entryFeeWei:           safeBigInt(s.entryFee),
    prizePoolWei:          safeBigInt(s.prizePool),
    houseAddress:          norm(s.house) || null,
    houseCutBps:           Number(s.houseCutBps || 0),
    winnerAddress:         norm(s.winnerAddress) || null,
    winnerWinningsWei:     safeBigInt(s.winnerWinnings),
    prizeDistributed:      !!s.prizeDistributed,
    houseFeesCollectedWei: safeBigInt(s.houseFeesCollected ?? s.houseFeesCollectedWei),
  }

  if (phaseChanged) {
    next.timer = PHASE_TIMERS[newPhase] ?? 0
    next.timerMax = PHASE_TIMERS[newPhase] ?? 0
    // When a room reaches scoreboard, mark it finished in localStorage so the
    // docket removes it automatically without requiring a manual dismiss.
    // When a room reaches scoreboard, persist rich metadata so the Profile
      // history panel can display rank, XP, category etc. without any RPC call.
      if (newPhase === PHASES.SCOREBOARD && local.roomCode) {
        const _sorted    = [...(next.players || [])].sort((a, b) => b.xp - a.xp)
        const _myId      = local.myId
        const _me        = _sorted.find((p) => p.id === _myId)
        let   _myRank    = _me ? _sorted.findIndex((p) => p.id === _myId) + 1 : 0
        // Prefer the contract's explicit winnerAddress over XP-sort rank.
        // This is the authoritative source of truth for who won the game.
        if (next.winnerAddress && _myId && next.winnerAddress === _myId) {
          _myRank = 1
        }
        markRoomFinished(local.roomCode, {
          category:    next.category    || local.category    || '',
          rounds:      next.round       || local.round       || 0,
          maxRounds:   next.maxRounds   || local.maxRounds   || 3,
          playerCount: _sorted.length,
          myRank:      _myRank,
          myXP:        _me?.xp ?? 0,
          winnerName:  _sorted[0]?.name || null,
          finishedAt:  Date.now(),
        })
        // Wipe server-side chat history so the room starts fresh if reused
        if (local.myId && norm(local.myId) === norm(local.hostAddress)) {
          clearRoom(local.roomCode, local.myId).catch(() => {})
        }
      }
  }

  useGameStore.setState(next)
}

function pushToast(type, message) {
  const id = nanoid(6)
  useGameStore.setState((s) => ({ toasts: [...s.toasts, { id, type, message }] }))
  setTimeout(() => {
    useGameStore.setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
  }, 4000)
}

subscribeWallet(() => {
  try {
    useGameStore.setState({ myId: norm(myAddress()) })
  } catch {}
})

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

// Extract the room code returned by `create_room`. GenLayer receipts vary in
// shape across SDK versions; we check the most common spots and fall back to
// scraping the raw consensus_data field.
function extractReturnedCode(receipt) {
  if (!receipt) return null
  const candidates = [
    receipt?.txDataDecoded?.returnValue,
    receipt?.returnValue,
    receipt?.return_value,
    receipt?.data?.returnValue,
    receipt?.consensus_data?.leader_receipt?.[0]?.result,
  ]
  for (const c of candidates) {
    if (typeof c === 'string') {
      const cleaned = c.replace(/^"|"$/g, '').trim().toUpperCase()
      if (isValidRoomCode(cleaned)) return cleaned
    }
  }
  // Last-ditch: scan the receipt JSON for a 6-char A-Z2-9 token.
  try {
    const s = JSON.stringify(receipt)
    const m = s.match(/"([A-Z2-9]{6})"/)
    if (m) return m[1]
  } catch {}
  return null
}

const useGameStore = create((set, get) => ({
  roomCode:    null,
  myId:        null,
  loading:     false,

  phase:          PHASES.LOBBY,
  round:          0,
  maxRounds:      3,
  maxPlayers:     8,
  hostAddress:    null,
  hostName:       '',
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

  entryFeeWei:           0n,
  prizePoolWei:          0n,
  houseAddress:          null,
  houseCutBps:           0,
  winnerAddress:         null,
  winnerWinningsWei:     0n,
  prizeDistributed:      true,
  houseFeesCollectedWei: 0n,

  // Live-lobby caches: rooms in-lobby (joinable) and rooms mid-game (spectating
  // info only — joining is gated by phase).
  openRooms:       [],
  liveRooms:       [],
  roomsLoadedAt:   0,
  roomsLoading:    false,

  timer:          0,
  timerMax:       0,
  toasts:         [],
  pendingTx:      null,
  chatMessages:   [],

  activeTab:        'home',
  walletPanelOpen:  false,
  identityGatePending: null,

  setActiveTab:       (tab)  => set({ activeTab: tab }),
  setWalletPanelOpen: (open) => set({ walletPanelOpen: !!open }),
  openIdentityGate:   (pending) => set({ identityGatePending: pending }),
  closeIdentityGate:  () => set({ identityGatePending: null }),

  profileCardTarget: null,
  openProfileCard: (target) => set({ profileCardTarget: target }),
  closeProfileCard: () => set({ profileCardTarget: null }),

  addToast: (message, type = 'info') => pushToast(type, message),

  tickTimer: () => {
    const { timer } = get()
    if (timer > 0) set({ timer: timer - 1 })
  },

  pushChat: (msg) => set((s) => {
    if (!msg || !msg.id) return s
    if (s.chatMessages.some((m) => m.id === msg.id)) return s
    const next = [...s.chatMessages, msg]
    next.sort((a, b) => a.ts - b.ts)
    if (next.length > CHAT_BUFFER_MAX) next.splice(0, next.length - CHAT_BUFFER_MAX)
    return { chatMessages: next }
  }),
  clearChat: () => set({ chatMessages: [] }),

    patchChatReaction: (msgId, reactions) => set((s) => ({
      chatMessages: s.chatMessages.map((m) =>
        m.id === msgId ? { ...m, reactions } : m
      ),
    })),

  // ── Live lobby loaders ────────────────────────────────────────────────────
  loadOpenRooms: async () => {
    if (!hasContractAddress()) return
    try {
      const raw = await readView(requireContractAddress(), 'list_open_rooms', [20])
      const parsed = parseContractPayload(raw) || []
      set({
        openRooms:     Array.isArray(parsed) ? parsed : [],
        roomsLoadedAt: Date.now(),
      })
    } catch (e) {
      console.warn('[genjury] loadOpenRooms:', e?.message || e)
    }
  },

  loadLiveRooms: async () => {
    if (!hasContractAddress()) return
    try {
      const raw = await readView(requireContractAddress(), 'list_live_rooms', [20])
      const parsed = parseContractPayload(raw) || []
      set({ liveRooms: Array.isArray(parsed) ? parsed : [] })
    } catch (e) {
      console.warn('[genjury] loadLiveRooms:', e?.message || e)
    }
  },

  refreshLobby: async () => {
    set({ roomsLoading: true })
    try {
      await Promise.all([get().loadOpenRooms(), get().loadLiveRooms()])
    } finally {
      set({ roomsLoading: false })
    }
  },

  // ── Room lifecycle ────────────────────────────────────────────────────────
  /**
   * Create a new room inside the singleton contract and join it as host.
   *
   * @param {string} rawName
   * @param {object} [opts]
   * @param {bigint} [opts.entryFeeWei=0n]   Wei each player pays to join.
   * @param {number} [opts.maxRounds=3]      Total rounds in the game.
   * @param {number} [opts.maxPlayers=8]     Max seats in the room.
   */
  createRoom: async (rawName, opts = {}) => {
    if (get().loading) return
    if (!hasContractAddress()) {
      pushToast('error', 'Genjury contract not configured. Ask the platform owner to set VITE_GENJURY_CONTRACT.')
      return
    }
    const me = norm(myAddress())
    if (!me) {
      pushToast('error', 'Connect your wallet to create a room')
      return
    }
    // Gate: wallet must have a claimed identity before creating a room
    if (!getProfile().claimed) {
      set({ identityGatePending: { action: 'create', args: [rawName, opts] } })
      return
    }
    const name = (rawName || getProfile().name || '').trim()
    if (!name) {
      pushToast('error', 'Set a player name in your profile first')
      return
    }
    set({ loading: true, chatMessages: [] })
    try {
      const entryFeeWei = typeof opts.entryFeeWei === 'bigint'
        ? opts.entryFeeWei
        : BigInt(opts.entryFeeWei || 0)
      const maxRounds  = Math.max(1, Number(opts.maxRounds  ?? 3))
      const maxPlayers = Math.max(2, Math.min(12, Number(opts.maxPlayers ?? 8)))

      const sym = getChainNativeSymbol()
      const { receipt } = await callMethodForResult(
        requireContractAddress(),
        'create_room',
        [name, maxRounds, entryFeeWei, maxPlayers],
        entryFeeWei,
        entryFeeWei > 0n ? `Open new room (stake ${formatGen(entryFeeWei)} ${sym})` : 'Open new room',
      )

      const code = extractReturnedCode(receipt)
      if (!code) {
        // Fall back to scanning the most-recent open room hosted by us.
        await get().loadOpenRooms()
        const mine = get().openRooms.find((r) => norm(r.host) === me)
        if (mine?.roomCode) {
          await get().enterRoom(mine.roomCode)
          set({ loading: false })
          pushToast('success', `Room created: ${mine.roomCode}`)
          return
        }
        throw new Error('Room created but the new code was not returned. Refresh and look for it under "Live cases".')
      }

      rememberJoinedRoom(code, { isHost: true, label: 'Your case' })
      set({
        roomCode:     code,
        myId:         me,
        phase:        PHASES.LOBBY,
        maxRounds,
        maxPlayers,
        entryFeeWei,
        prizePoolWei: 0n,
        activeTab:    'lobby',
      })
      registerMember(code, me, true).catch(() => {})
      startPolling(get)
      pushToast('success', `Room opened — code ${code}`)
      // Refresh lobby in the background so the new room shows up.
      get().loadOpenRooms()
      set({ loading: false })
    } catch (e) {
      console.error(e)
      set({ loading: false, roomCode: null })
      pushToast('error', `Could not open room: ${e?.shortMessage || e?.message || e}`)
    }
  },

  /**
   * Join an existing room by code. Pays the entry fee atomically.
   */
  joinRoom: async (rawCode, rawName) => {
    if (get().loading) return
    if (!hasContractAddress()) {
      pushToast('error', 'Genjury contract not configured.')
      return
    }
    const code = normalizeRoomCode(rawCode)
    if (!isValidRoomCode(code)) {
      pushToast('error', 'Invalid room code')
      return
    }
    const me = norm(myAddress())
    if (!me) {
      pushToast('error', 'Connect your wallet to join a room')
      return
    }
    // Gate: wallet must have a claimed identity before joining a room
    if (!getProfile().claimed) {
      set({ identityGatePending: { action: 'join', args: [rawCode, rawName] } })
      return
    }
    const name = (rawName || getProfile().name || '').trim()
    if (!name) {
      pushToast('error', 'Set a player name in your profile first')
      return
    }
    set({ loading: true, chatMessages: [] })
    try {
      const raw = await readView(requireContractAddress(), 'get_room_state', [code])
      const parsed = parseContractPayload(raw) || {}
      if (!parsed?.roomCode) {
        throw new Error(`Room "${code}" does not exist`)
      }

      // ── Access control ────────────────────────────────────────────────────
      // Once the host starts the game (phase leaves 'lobby'), the room is
      // locked. Only players who already have a seat can re-enter.
      const roomPhase = parsed?.phase || 'lobby'
      const playersMap = parsed?.players || {}
      // Normalize all keys to lowercase — contract may return mixed-case
      // addresses, but `me` is always lowercased via norm().
      const alreadyIn = Object.keys(playersMap).some((k) => norm(k) === me)

      if (roomPhase !== 'lobby' && !alreadyIn) {
        set({ loading: false })
        pushToast('error', 'This case is already in session. Only players who joined during the lobby can enter.')
        return
      }

      // ── Capacity check ────────────────────────────────────────────────────
      // Reject early when the lobby is full so the user gets instant feedback
      // instead of an on-chain rejection with a confusing error message.
      if (roomPhase === 'lobby' && !alreadyIn) {
        const currentCount = Number(parsed?.playerCount ?? Object.keys(playersMap).length)
        const cap          = Number(parsed?.maxPlayers ?? 8)
        if (currentCount >= cap) {
          set({ loading: false })
          pushToast('error', `This case is full (${currentCount}/${cap} jurors seated).`)
          return
        }
      }

      const fee = safeBigInt(parsed?.entryFee)

      if (!alreadyIn) {
        // Submit the join tx BEFORE navigating so the player list is already
        // updated on-chain by the time the lobby page starts polling.
        const sym = getChainNativeSymbol()
        await callMethod(
          requireContractAddress(),
          'join',
          [code, name],
          fee,
          fee > 0n ? `Take seat in ${code} (stake ${formatGen(fee)} ${sym})` : `Take seat in ${code}`,
        )
        // Re-fetch state after the join tx so the player already appears in
        // the player list when the lobby first renders.
        try {
          const freshRaw = await readView(requireContractAddress(), 'get_room_state', [code])
          const freshParsed = parseContractPayload(freshRaw)
          if (freshParsed) {
            rememberJoinedRoom(code)
            set({ roomCode: code, myId: me, activeTab: 'lobby' })
            applyContractState(get, freshParsed)
            startPolling(get)
            registerMember(code, me, false).catch(() => {})
            pushToast('success', `You're seated in ${code}`)
            set({ loading: false })
            return
          }
        } catch {
          // Fall through to the original path on network error
        }
      }

      rememberJoinedRoom(code)
      set({ roomCode: code, myId: me, activeTab: 'lobby' })
      applyContractState(get, parsed)
      startPolling(get)
      registerMember(code, me, false).catch(() => {})
      pushToast('success', `You're seated in ${code}`)
      set({ loading: false })
    } catch (e) {
      console.error(e)
      set({ loading: false, roomCode: null })
      forgetJoinedRoom(code)
      pushToast('error', `Could not join: ${e?.shortMessage || e?.message || e}`)
    }
  },

  /**
   * Re-enter a room without re-paying the entry fee (used by ProfilePage's
   * "Resume" action and after we recover a freshly-created room, and by the
   * docket's "Rejoin" button for players already seated in a live game).
   *
   * Access control: if the game has left the lobby phase, only players who
   * were already seated when the game started may re-enter. Spectators are
   * blocked to keep each room independent and fair.
   */
  enterRoom: async (rawCode) => {
    const code = normalizeRoomCode(rawCode)
    if (!isValidRoomCode(code)) return
    const me = norm(myAddress())

    // Pre-flight check: fetch room state to enforce participant-only access
    // for in-progress games before updating any local state.
    if (hasContractAddress()) {
      try {
        const raw = await readView(requireContractAddress(), 'get_room_state', [code])
        const parsed = parseContractPayload(raw)
        if (parsed) {
          const roomPhase = parsed.phase || 'lobby'
          const playersMap = parsed.players || {}
          const alreadyIn = Object.keys(playersMap).some((k) => norm(k) === me)

          if (roomPhase !== 'lobby' && !alreadyIn) {
            pushToast('error', 'This case is already in session. Only players who joined during the lobby can enter.')
            return
          }

          // If still in lobby and not yet on-chain, submit the join tx first
          // so the player actually appears in the room before we navigate.
          if (roomPhase === 'lobby' && !alreadyIn) {
            const name = getProfile().name || me.slice(0, 6)
            const fee  = safeBigInt(parsed?.entryFee)
            const sym  = getChainNativeSymbol()
            try {
              await callMethod(
                requireContractAddress(),
                'join',
                [code, name],
                fee,
                fee > 0n ? `Take seat in ${code} (stake ${formatGen(fee)} ${sym})` : `Take seat in ${code}`,
              )
            } catch (e) {
              pushToast('error', `Could not join: ${e?.shortMessage || e?.message || e}`)
              return
            }
          }

          set({ roomCode: code, myId: me, chatMessages: [], activeTab: 'lobby' })
          rememberJoinedRoom(code)
          applyContractState(get, parsed)
          startPolling(get)
          registerMember(code, me, false).catch(() => {})
          return
        }
      } catch {
        // Fall through to the original flow on network error.
      }
    }

    set({ roomCode: code, myId: me, chatMessages: [], activeTab: 'lobby' })
    rememberJoinedRoom(code)
    startPolling(get)
    registerMember(code, me, false).catch(() => {})
    await refreshState(get)
  },

  /**
   * Look up a room's economics without joining. Used by Open Cases preview.
   */
  previewRoom: async (rawCode) => {
    const code = normalizeRoomCode(rawCode)
    if (!isValidRoomCode(code) || !hasContractAddress()) return null
    try {
      const raw = await readView(requireContractAddress(), 'get_room_state', [code])
      const parsed = parseContractPayload(raw)
      if (!parsed?.roomCode) return null
      return {
        roomCode:     parsed.roomCode,
        host:         parsed.host || '',
        hostName:     parsed.hostName || '',
        phase:        parsed.phase || 'lobby',
        entryFeeWei:  safeBigInt(parsed.entryFee),
        prizePoolWei: safeBigInt(parsed.prizePool),
        playerCount:  Number(parsed.playerCount || 0),
        maxPlayers:   Number(parsed.maxPlayers || 0),
        maxRounds:    Number(parsed.maxRounds || 0),
      }
    } catch (e) {
      console.warn('[genjury] previewRoom:', e?.message || e)
      return null
    }
  },

  addBotPlayers: () => {
    pushToast('warning', "Bots aren't supported on-chain — share the room code with friends to fill the lobby.")
  },

  startGame: async () => {
    const { roomCode, phase } = get()
    if (!roomCode || isTxBusy(get)) return
    try {
      if (phase === PHASES.SCOREBOARD) {
        await callMethod(requireContractAddress(), 'reset_to_lobby', [roomCode], 0n, 'Reset case to lobby')
      }
      await callMethod(requireContractAddress(), 'start_game', [roomCode], 0n, 'Convene the trial')
      refreshState(get)
    } catch (e) {
      pushToast('error', e?.shortMessage || e?.message || 'Could not start trial')
    }
  },

  // ── Host admin ────────────────────────────────────────────────────────────
  setEntryFee: async (humanGenStr) => {
    const { roomCode } = get()
    if (!roomCode || isTxBusy(get)) return
    let wei
    try {
      const { parseGen } = await import('./genlayer')
      wei = parseGen(humanGenStr)
    } catch (e) {
      pushToast('error', e?.message || 'Invalid GEN amount')
      return
    }
    try {
      await callMethod(requireContractAddress(), 'set_entry_fee', [roomCode, wei], 0n, 'Update entry fee')
      pushToast('success', 'Entry fee updated')
      refreshState(get)
    } catch (e) {
      pushToast('error', e?.shortMessage || e?.message || 'Could not change entry fee')
    }
  },

  setMaxRounds: async (n) => {
    const { roomCode } = get()
    if (!roomCode || isTxBusy(get)) return
    const rounds = Math.floor(Number(n))
    if (!Number.isFinite(rounds) || rounds < 1 || rounds > 50) {
      pushToast('error', 'Rounds must be a whole number between 1 and 50')
      return
    }
    try {
      await callMethod(requireContractAddress(), 'set_max_rounds', [roomCode, rounds], 0n, 'Update max rounds')
      pushToast('success', `Max rounds set to ${rounds}`)
      refreshState(get)
    } catch (e) {
      pushToast('error', e?.shortMessage || e?.message || 'Could not change max rounds')
    }
  },

  setMaxPlayers: async (n) => {
    const { roomCode } = get()
    if (!roomCode || isTxBusy(get)) return
    const cap = Math.floor(Number(n))
    if (!Number.isFinite(cap) || cap < 2 || cap > 12) {
      pushToast('error', 'Player cap must be between 2 and 12')
      return
    }
    try {
      await callMethod(requireContractAddress(), 'set_max_players', [roomCode, cap], 0n, 'Update max players')
      pushToast('success', `Max players set to ${cap}`)
      refreshState(get)
    } catch (e) {
      pushToast('error', e?.shortMessage || e?.message || 'Could not change max players')
    }
  },

  kickPlayer: async (addr) => {
    const { roomCode } = get()
    if (!roomCode || isTxBusy(get)) return
    const target = (addr || '').trim().toLowerCase()
    if (!/^0x[0-9a-f]{40}$/.test(target)) {
      pushToast('error', 'Invalid player address')
      return
    }
    try {
      await callMethod(requireContractAddress(), 'kick_player', [roomCode, target], 0n, `Kick ${target.slice(0, 6)}…`)
      pushToast('success', 'Player kicked and refunded')
      refreshState(get)
    } catch (e) {
      pushToast('error', e?.shortMessage || e?.message || 'Could not kick player')
    }
  },

  transferHost: async (addr) => {
    const { roomCode } = get()
    if (!roomCode || isTxBusy(get)) return
    const target = (addr || '').trim().toLowerCase()
    if (!/^0x[0-9a-f]{40}$/.test(target)) {
      pushToast('error', 'New host must be a valid 0x… address')
      return
    }
    try {
      await callMethod(requireContractAddress(), 'transfer_host', [roomCode, target], 0n, 'Transfer host role')
      pushToast('success', 'Host role transferred')
      refreshState(get)
    } catch (e) {
      pushToast('error', e?.shortMessage || e?.message || 'Could not transfer host')
    }
  },

  resetToLobby: async () => {
    const { roomCode } = get()
    if (!roomCode || isTxBusy(get)) return
    try {
      await callMethod(requireContractAddress(), 'reset_to_lobby', [roomCode], 0n, 'Reset case to lobby')
      pushToast('success', 'Case reset to lobby')
      refreshState(get)
    } catch (e) {
      pushToast('error', e?.shortMessage || e?.message || 'Could not reset case')
    }
  },

  // ── House (deployer) admin ────────────────────────────────────────────────
  claimHouseFees: async () => {
    if (!hasContractAddress()) return
    try {
      await callMethod(requireContractAddress(), 'claim_house_fees', [], 0n, 'Claim house fees')
      pushToast('success', 'House fees swept — funds in your wallet')
    } catch (e) {
      pushToast('error', e?.shortMessage || e?.message || 'Could not claim house fees')
    }
  },

  // ── Platform owner admin ──────────────────────────────────────────────────
  claimPlatformFees: async () => {
    if (!hasContractAddress()) return
    try {
      await callMethod(requireContractAddress(), 'claim_platform_fees', [], 0n, 'Claim platform fees')
      pushToast('success', 'Platform fees swept — funds in your wallet')
      refreshState(get)
    } catch (e) {
      pushToast('error', e?.shortMessage || e?.message || 'Could not claim platform fees')
    }
  },

  setPlatformFeeBps: async (pctStr) => {
    if (!hasContractAddress()) return
    const pct = parseFloat(pctStr)
    if (isNaN(pct) || pct < 0 || pct > 20) {
      pushToast('error', 'Fee must be between 0% and 20%')
      return
    }
    const bps = Math.round(pct * 100)
    try {
      await callMethod(requireContractAddress(), 'set_platform_fee_bps', [bps], 0n, 'Set platform fee')
      pushToast('success', `Platform fee set to ${pct.toFixed(2)}%`)
      refreshState(get)
    } catch (e) {
      pushToast('error', e?.shortMessage || e?.message || 'Could not set platform fee')
    }
  },

  setPlatformOwner: async (newOwner) => {
    if (!hasContractAddress()) return
    if (!newOwner || !newOwner.startsWith('0x')) {
      pushToast('error', 'Enter a valid 0x… wallet address')
      return
    }
    try {
      await callMethod(requireContractAddress(), 'set_platform_owner', [newOwner], 0n, 'Transfer platform ownership')
      pushToast('success', 'Platform ownership transferred')
      refreshState(get)
    } catch (e) {
      pushToast('error', e?.shortMessage || e?.message || 'Could not transfer ownership')
    }
  },

  // ── Writing ───────────────────────────────────────────────────────────────
  setStatement: (i, val) => {
    const next = [...get().statements]
    next[i] = val
    set({ statements: next })
  },

  setLieIndex: (i) => set({ lieIndex: i }),

  submitStatements: async () => {
    const { roomCode, statements, lieIndex } = get()
    if (!roomCode || lieIndex === null || isTxBusy(get)) return
    try {
      await callMethod(requireContractAddress(), 'submit_statements', [
        roomCode,
        statements[0] || '',
        statements[1] || '',
        statements[2] || '',
        Number(lieIndex),
      ], 0n, 'File your testimony')
      pushToast('success', 'Testimony filed!')
      refreshState(get)
    } catch (e) {
      pushToast('error', e?.shortMessage || e?.message || 'Could not file testimony')
    }
  },

  // ── Voting ────────────────────────────────────────────────────────────────
  castVote: async (_playerId, idx, conf) => {
    const { roomCode } = get()
    if (!roomCode || isTxBusy(get)) return
    const confPct = Math.max(0, Math.min(100, Math.round(Number(conf) * 100)))
    try {
      await callMethod(requireContractAddress(), 'cast_vote', [roomCode, Number(idx), confPct], 0n, 'Render verdict')
      refreshState(get)
    } catch (e) {
      pushToast('error', e?.shortMessage || e?.message || 'Vote failed')
    }
  },

  proceedToAIJudge: async () => {
    const { roomCode, phase } = get()
    if (!roomCode || isTxBusy(get)) return
    try {
      if (phase === PHASES.VOTING) {
        try { await callMethod(requireContractAddress(), 'force_close_voting', [roomCode], 0n, 'Close jury deliberation') } catch {}
      }
      await callMethod(requireContractAddress(), 'run_ai_judge', [roomCode], 0n, 'Summon the AI Judge')
      refreshState(get)
    } catch (e) {
      console.warn('[genjury] run_ai_judge:', e?.message || e)
      refreshState(get)
    }
  },

  // ── Objection ─────────────────────────────────────────────────────────────
  raiseObjection: async () => {
    const { roomCode } = get()
    if (!roomCode || isTxBusy(get)) return
    try {
      await callMethod(requireContractAddress(), 'raise_objection', [roomCode], 0n, 'Raise objection')
      refreshState(get)
    } catch (e) {
      pushToast('error', e?.shortMessage || e?.message || 'Objection failed')
    }
  },

  castObjectionVote: async (_playerId, stance) => {
    const { roomCode } = get()
    if (!roomCode || isTxBusy(get)) return
    try {
      await callMethod(requireContractAddress(), 'cast_objection_vote', [roomCode, stance], 0n, 'Vote on objection')
      refreshState(get)
    } catch (e) {
      pushToast('error', e?.shortMessage || e?.message || 'Objection vote failed')
    }
  },

  finalizeRound: async () => {
    const { roomCode, phase } = get()
    if (!roomCode || isTxBusy(get)) return
    try {
      if (phase === PHASES.OBJECTION) {
        await callMethod(requireContractAddress(), 'skip_objection', [roomCode], 0n, 'Skip objection window')
      } else if (phase === PHASES.OBJECTION_VOTE) {
        await callMethod(requireContractAddress(), 'close_objection_vote', [roomCode], 0n, 'Close objection vote')
      }
      refreshState(get)
    } catch (e) {
      console.warn('[genjury] finalizeRound:', e?.message || e)
      refreshState(get)
    }
  },

  nextRound: async () => {
    const { roomCode } = get()
    if (!roomCode || isTxBusy(get)) return
    try {
      await callMethod(requireContractAddress(), 'next_round', [roomCode], 0n, 'Advance to next round')
      refreshState(get)
    } catch (e) {
      pushToast('error', e?.shortMessage || e?.message || 'Could not advance round')
    }
  },

  claimPrize: async () => {
    const { roomCode } = get()
    if (!roomCode || isTxBusy(get)) return
    try {
      await callMethod(requireContractAddress(), 'claim_prize', [roomCode], 0n, 'Claim verdict winnings')
      pushToast('success', 'Prize claimed — funds in your wallet')
      refreshState(get)
    } catch (e) {
      pushToast('error', e?.shortMessage || e?.message || 'Could not claim prize')
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
      hostName:        '',
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
      winnerAddress:         null,
      winnerWinningsWei:     0n,
      prizeDistributed:      true,
      houseFeesCollectedWei: 0n,
      activeTab:             'home',
    })
  },
}))

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
