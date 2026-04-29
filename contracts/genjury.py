# v0.2.16
# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

"""
Genjury — The AI Jury Game
==========================

GenLayer Intelligent Contract that powers a multiplayer "two truths,
one lie" social deduction game with on-chain GEN-token stakes.

Tokenomics
----------
Each player pays an `entry_fee` (in wei of GEN) when they join the room.
A configurable `platform_fee_bps` slice of every entry is routed to a
designated `platform_owner`; the rest pools toward the eventual winner.

When the final round resolves, the player with the highest XP becomes the
winner of record. Funds stay in the contract until the rightful party
calls one of the claim methods:

    * claim_prize()         – the winner withdraws the prize pool
    * claim_platform_fees() – the platform owner withdraws their cut

Demonstrates four core GenLayer concepts:

    * Intelligent Contracts        – the AI Judge calls an LLM on-chain.
    * Optimistic Democracy         – the Objection flow lets players overrule the AI.
    * Non-deterministic Operations – LLM verdicts vary; validators reach
                                     consensus through the Equivalence Principle.
    * Appeal Process               – the Objection -> Sustain / Overrule vote.

Game lifecycle:

    LOBBY -> WRITING -> VOTING -> AI_JUDGING -> OBJECTION
          -> [OBJECTION_VOTE]  -> REVEAL -> (next round) -> SCOREBOARD
"""

from genlayer import *

import json
import typing


# ──────────────────────────────────────────────────────────────────────────────
# EVM-contract interface stub used purely so the IC can transfer GEN to EOA
# wallet addresses (winners, the platform owner, anyone calling `leave`).
#
# `emit_transfer` is auto-injected by `@gl.evm.contract_interface` on the
# `Write` proxy, so leaving the inner classes empty is the documented
# GenLayer pattern. BUT — and this is what to actually test on Studio /
# Bradbury before mainnet — the auto-injected emit_transfer relies on the
# recipient address being valid and the contract holding enough native GEN
# to cover `value`. If a withdrawal silently fails on Bradbury but worked on
# Studio, the most common cause is that Bradbury's consensus rejects native
# transfers from contracts that are still in a non-finalized state. Always
# end-to-end test `claim_prize`, `claim_platform_fees`, and `leave` on
# Bradbury BEFORE the first real game.
# ──────────────────────────────────────────────────────────────────────────────
@gl.evm.contract_interface
class _Wallet:
    class View:
        pass

    class Write:
        pass


def _send_gen(recipient: str, amount_wei: int) -> None:
    """Transfer ``amount_wei`` GEN from this contract to ``recipient``.

    Defensive: skip zero/negative amounts so we never emit a no-op transfer
    and so callers can blindly call this without pre-checking.
    """
    if amount_wei <= 0:
        return
    # Recipient must be lowercased before constructing Address — a mixed-case
    # string can fail Address() validation depending on SDK version.
    _Wallet(Address(_norm_addr(recipient))).emit_transfer(value=u256(amount_wei))


# ──────────────────────────────────────────────────────────────────────────────
# Address normalization
#
# `gl.message.sender_address` may arrive checksummed or all-lowercase
# depending on which RPC / wallet path the caller used. We canonicalize to
# lowercase EVERYWHERE so equality checks against `self.host`, `self.deceiver`,
# `self.platform_owner`, etc. don't randomly fail for a legitimate caller.
# ──────────────────────────────────────────────────────────────────────────────
def _norm_addr(addr) -> str:
    return str(addr).strip().lower()


def _sender() -> str:
    return _norm_addr(gl.message.sender_address)


# ──────────────────────────────────────────────────────────────────────────────
# Constants
# ──────────────────────────────────────────────────────────────────────────────

# Phase strings — kept as plain literals so the JS frontend can compare them
# directly without sharing an enum.
PHASE_LOBBY          = "lobby"
PHASE_WRITING        = "writing"
PHASE_VOTING         = "voting"
PHASE_AI_JUDGING     = "ai_judging"
PHASE_OBJECTION      = "objection"
PHASE_OBJECTION_VOTE = "objection_vote"
PHASE_REVEAL         = "reveal"
PHASE_SCOREBOARD     = "scoreboard"

MIN_PLAYERS = 2
MAX_PLAYERS = 8

# Cap the platform fee at 20% so a malicious deployer can't grief players.
MAX_PLATFORM_FEE_BPS = 2000  # 20.00%

CATEGORIES = [
    "Personal Facts",
    "Pop Culture",
    "Science & Tech",
    "History",
    "Sports",
    "Food & Travel",
    "Wild Cards",
]

# XP rewards — mirror src/lib/store.js's calculateXP so the UI's
# pre-round estimates match what the contract actually awards.
XP_PER_FOOLED_PLAYER = 120
XP_AI_FOOLED_BONUS   = 250
XP_FULL_FOOL_BONUS   = 200
XP_DETECTOR_BASE     = 100
XP_DETECTOR_CONF_MAX = 150   # multiplied by confidence (0–100)
XP_OBJECTION_SUCCESS = 80

AVATARS = ["🦊", "🐉", "🦁", "🐺", "🦅", "🐙", "🦈", "🐆", "🦝", "🐻", "🦄", "🐬"]
# Expanded to 12 colors so it stays collision-free if MAX_PLAYERS is ever
# bumped beyond 8 (it currently equals the old 8-color length, which would
# silently start aliasing avatars to duplicate colors at player 9+).
COLORS  = ["#7fff6e", "#a259ff", "#38d9f5", "#ff6b35",
           "#f5c842", "#ff4d8d", "#00d4aa", "#ff9500",
           "#5b8cff", "#ff5cd6", "#9aff5c", "#ffd86b"]


# ──────────────────────────────────────────────────────────────────────────────
# Storage helpers
# ──────────────────────────────────────────────────────────────────────────────

def _clear_arr(arr) -> None:
    while len(arr) > 0:
        arr.pop()


def _clear_tm(tm) -> None:
    keys = [k for k in tm]
    for k in keys:
        del tm[k]


# ──────────────────────────────────────────────────────────────────────────────
# Contract
# ──────────────────────────────────────────────────────────────────────────────

class Genjury(gl.Contract):
    # ── Game meta ──────────────────────────────────────────────────────────
    host:        str
    phase:       str
    round_num:   u256
    max_rounds:  u256
    max_players: u256   # runtime-tunable cap, defaults to MAX_PLAYERS
    category:    str

    # ── Players ────────────────────────────────────────────────────────────
    # Player record is JSON-encoded for ergonomic frontend reads:
    #   {"name":..., "avatar":..., "color":..., "xp":..., "level":...}
    players:        TreeMap[str, str]
    player_order:   DynArray[str]
    deceiver_index: u256
    deceiver:       str

    # ── Round data ─────────────────────────────────────────────────────────
    statements:  DynArray[str]   # always length 3 once initialized
    lie_index:   u256
    submitted:   bool

    # ── Votes ──────────────────────────────────────────────────────────────
    votes:       TreeMap[str, u256]   # voter -> statement index (0,1,2)
    confidence:  TreeMap[str, u256]   # voter -> 0..100
    voters:      DynArray[str]        # ordered for replayability

    # ── AI verdict ─────────────────────────────────────────────────────────
    ai_judged:        bool
    ai_verdict_index: u256
    ai_confidence:    u256
    ai_reasoning:     str

    # ── Objection ──────────────────────────────────────────────────────────
    objection_raised: bool
    objection_by:     str
    objection_votes:  TreeMap[str, str]   # 'sustain' | 'overrule'

    # ── Reveal & history ───────────────────────────────────────────────────
    last_reveal:   str               # JSON blob the frontend renders
    score_history: DynArray[str]     # JSON per round

    # ── Economics ──────────────────────────────────────────────────────────
    entry_fee:               u256   # wei each player must pay to join
    platform_fee_bps:        u256   # basis points (e.g. 500 = 5%)
    platform_owner:          str    # receives platform_fees_collected
    prize_pool:              u256   # wei accrued for the eventual winner
    platform_fees_collected: u256   # wei accrued for the platform owner

    # ── Settlement (set when game ends) ────────────────────────────────────
    winner_address:      str
    winner_winnings_wei: u256       # wei reserved for the winner's claim
    prize_distributed:   bool

    # ──────────────────────────────────────────────────────────────────────
    # Construction
    # ──────────────────────────────────────────────────────────────────────
    def __init__(self,
                 max_rounds: int = 3,
                 entry_fee_wei: int = 0,
                 platform_fee_bps: int = 0,
                 platform_owner: str = ""):
        self.host = _sender()
        self.phase = PHASE_LOBBY
        self.round_num = u256(0)
        self.max_rounds = u256(max_rounds)
        self.max_players = u256(MAX_PLAYERS)   # host can later resize via set_max_players
        self.category = ""

        self.deceiver_index = u256(0)
        self.deceiver = ""

        # Always keep statements as a length-3 array so client indexing is safe.
        self.statements.append("")
        self.statements.append("")
        self.statements.append("")
        self.lie_index = u256(0)
        self.submitted = False

        self.ai_judged = False
        self.ai_verdict_index = u256(0)
        self.ai_confidence = u256(0)
        self.ai_reasoning = ""

        self.objection_raised = False
        self.objection_by = ""

        self.last_reveal = ""

        # Economics — validated and clamped so the contract stays player-safe
        # regardless of what the deployer passes in.
        fee_wei = max(0, int(entry_fee_wei))
        bps     = max(0, min(MAX_PLATFORM_FEE_BPS, int(platform_fee_bps)))
        owner   = _norm_addr(platform_owner) if platform_owner else ""
        self.entry_fee               = u256(fee_wei)
        self.platform_fee_bps        = u256(bps)
        # Empty owner => fall back to whoever deployed the contract.
        self.platform_owner          = owner if owner else self.host
        self.prize_pool              = u256(0)
        self.platform_fees_collected = u256(0)

        # Settlement
        self.winner_address      = ""
        self.winner_winnings_wei = u256(0)
        # Treated as "already settled" until a game with a non-zero prize pool
        # finishes, at which point this flips to False until the winner claims.
        self.prize_distributed   = True

    # ──────────────────────────────────────────────────────────────────────
    # Internal helpers
    # ──────────────────────────────────────────────────────────────────────
    def _player_count(self) -> int:
        return len(self.player_order)

    def _is_player(self, addr: str) -> bool:
        return addr in self.players

    def _reset_round_state(self) -> None:
        _clear_arr(self.statements)
        self.statements.append("")
        self.statements.append("")
        self.statements.append("")
        self.lie_index = u256(0)
        self.submitted = False

        _clear_tm(self.votes)
        _clear_tm(self.confidence)
        _clear_arr(self.voters)

        self.ai_judged = False
        self.ai_verdict_index = u256(0)
        self.ai_confidence = u256(0)
        self.ai_reasoning = ""

        self.objection_raised = False
        self.objection_by = ""
        _clear_tm(self.objection_votes)

        self.last_reveal = ""

    def _pick_category(self, salt: int) -> str:
        """Deterministic but non-trivial category picker.

        The previous version was just `CATEGORIES[round_num % 7]`, which
        meant round 1 was *always* "Pop Culture", round 2 *always*
        "Science & Tech", etc. — across every Genjury room ever deployed.
        Players could memorize the schedule.

        We now mix in the host address so each deployment has a different
        rotation, while staying fully deterministic (every validator picks
        the same category, so consensus is preserved).
        """
        h = int(salt) * 2654435761  # Knuth multiplicative hash
        for ch in self.host:
            h = (h * 131 + ord(ch)) & 0xFFFFFFFFFFFFFFFF
        return CATEGORIES[h % len(CATEGORIES)]

    def _new_player_record(self, name: str, slot: int) -> str:
        return json.dumps({
            "name":   name,
            "avatar": AVATARS[slot % len(AVATARS)],
            "color":  COLORS[slot % len(COLORS)],
            "xp":     0,
            "level":  1,
        })

    def _update_xp(self, addr: str, gained: int) -> int:
        rec = json.loads(self.players[addr])
        rec["xp"]    = int(rec["xp"]) + int(gained)
        rec["level"] = (rec["xp"] // 500) + 1
        self.players[addr] = json.dumps(rec)
        return int(rec["xp"])

    def _split_entry(self, paid: int) -> tuple[int, int]:
        """Return (platform_fee, prize_share) for a payment of ``paid`` wei."""
        if paid <= 0:
            return 0, 0
        fee = (paid * int(self.platform_fee_bps)) // 10000
        return fee, paid - fee

    # ──────────────────────────────────────────────────────────────────────
    # Lobby — join / leave / start
    # ──────────────────────────────────────────────────────────────────────
    @gl.public.write.payable
    def join(self, name: str) -> None:
        """Add the caller to the lobby with a chosen display name.

        The caller must send exactly ``entry_fee`` wei of GEN with the call.
        """
        sender = _sender()
        if self.phase != PHASE_LOBBY:
            raise gl.vm.UserError("Game already started")
        if self._player_count() >= int(self.max_players):
            raise gl.vm.UserError("Lobby full")
        if self._is_player(sender):
            raise gl.vm.UserError("Already joined")
        if len(name) == 0 or len(name) > 24:
            raise gl.vm.UserError("Name must be 1-24 characters")

        paid     = int(gl.message.value)
        required = int(self.entry_fee)
        if paid != required:
            raise gl.vm.UserError(
                f"Must send exactly {required} wei (entry fee); received {paid}"
            )

        if required > 0:
            fee, share = self._split_entry(required)
            self.platform_fees_collected = u256(int(self.platform_fees_collected) + fee)
            self.prize_pool              = u256(int(self.prize_pool) + share)

        slot = self._player_count()
        self.players[sender] = self._new_player_record(name, slot)
        self.player_order.append(sender)

    @gl.public.write
    def leave(self) -> None:
        """Leave the lobby. Only allowed before the game starts.

        Refunds the full entry fee back to the caller and rolls back the
        platform-fee / prize-pool accounting for that seat.
        """
        sender = _sender()
        if self.phase != PHASE_LOBBY:
            raise gl.vm.UserError("Cannot leave mid-game")
        if not self._is_player(sender):
            raise gl.vm.UserError("Not in lobby")

        required = int(self.entry_fee)
        if required > 0:
            fee, share = self._split_entry(required)
            self.platform_fees_collected = u256(int(self.platform_fees_collected) - fee)
            self.prize_pool              = u256(int(self.prize_pool) - share)

        del self.players[sender]
        kept = [a for a in self.player_order if a != sender]
        _clear_arr(self.player_order)
        for a in kept:
            self.player_order.append(a)

        _send_gen(sender, required)

    @gl.public.write
    def start_game(self) -> None:
        """Host kicks the game off. Round 1, deceiver = player_order[0]."""
        sender = _sender()
        if sender != self.host:
            raise gl.vm.UserError("Only host can start the game")
        if self.phase != PHASE_LOBBY:
            raise gl.vm.UserError("Already running")
        if self._player_count() < MIN_PLAYERS:
            raise gl.vm.UserError("Need at least 2 players")

        self.round_num = u256(1)
        self.deceiver_index = u256(0)
        self.deceiver = self.player_order[0]
        self.category = self._pick_category(int(self.round_num))
        self._reset_round_state()
        self.phase = PHASE_WRITING

    # ──────────────────────────────────────────────────────────────────────
    # Writing phase — deceiver submits 3 statements + which one is the lie
    # ──────────────────────────────────────────────────────────────────────
    @gl.public.write
    def submit_statements(self,
                          s1: str, s2: str, s3: str,
                          lie_index: int) -> None:
        sender = _sender()
        if self.phase != PHASE_WRITING:
            raise gl.vm.UserError("Not in writing phase")
        if sender != self.deceiver:
            raise gl.vm.UserError("Only the deceiver can submit")
        # (writing-phase escape hatch lives in `force_close_writing` below
        # so a disconnected deceiver doesn't permanently brick the room).
        if lie_index not in (0, 1, 2):
            raise gl.vm.UserError("lie_index must be 0, 1 or 2")
        for s in (s1, s2, s3):
            if len(s) == 0 or len(s) > 280:
                raise gl.vm.UserError("Statements must be 1-280 chars")

        _clear_arr(self.statements)
        self.statements.append(s1)
        self.statements.append(s2)
        self.statements.append(s3)
        self.lie_index = u256(lie_index)
        self.submitted = True
        self.phase = PHASE_VOTING

    @gl.public.write
    def force_close_writing(self) -> None:
        """Host's escape hatch when the deceiver disconnects mid-WRITING.

        Mirrors `force_close_voting` so a stalled writer can't brick the room
        forever. Skips this round (the deceiver gets 0 XP for this round) and
        rotates to the next deceiver.
        """
        sender = _sender()
        if sender != self.host:
            raise gl.vm.UserError("Only host can force-close writing")
        if self.phase != PHASE_WRITING:
            raise gl.vm.UserError("Not in writing phase")

        # Treat the round as if it had just been voted unanimously wrong:
        # nothing to reveal, no XP awarded, just move on.
        self.last_reveal = json.dumps({
            "round":            int(self.round_num),
            "lieIndex":         -1,
            "statements":       ["", "", ""],
            "deceiver":         self.deceiver,
            "aiVerdictIndex":   -1,
            "aiConfidence":     0,
            "aiReasoning":      "Round skipped — deceiver did not submit in time.",
            "effectiveVerdict": -1,
            "aiWasFooled":      False,
            "objectionRaised":  False,
            "objectionBy":      "",
            "objectionTally":   {"sustain": 0, "overrule": 0},
            "votes":            {},
            "confidence":       {},
            "objectionVotes":   {},
            "fooledPlayers":    [],
            "xpGained":         {},
            "skipped":          True,
        })
        self.score_history.append(self.last_reveal)
        self.phase = PHASE_REVEAL

    # ──────────────────────────────────────────────────────────────────────
    # Voting phase — every detector picks the statement they think is the lie
    # ──────────────────────────────────────────────────────────────────────
    @gl.public.write
    def cast_vote(self, statement_index: int, confidence_pct: int) -> None:
        sender = _sender()
        if self.phase != PHASE_VOTING:
            raise gl.vm.UserError("Not in voting phase")
        if not self._is_player(sender):
            raise gl.vm.UserError("Not a player")
        if sender == self.deceiver:
            raise gl.vm.UserError("Deceiver cannot vote")
        if statement_index not in (0, 1, 2):
            raise gl.vm.UserError("Vote must be 0, 1 or 2")
        if confidence_pct < 0 or confidence_pct > 100:
            raise gl.vm.UserError("Confidence must be 0-100")
        if sender in self.votes:
            raise gl.vm.UserError("Already voted")

        self.votes[sender] = u256(statement_index)
        self.confidence[sender] = u256(confidence_pct)
        self.voters.append(sender)

        # Auto-advance once every detector has voted.
        detectors = self._player_count() - 1
        if len(self.voters) >= detectors:
            self.phase = PHASE_AI_JUDGING

    @gl.public.write
    def force_close_voting(self) -> None:
        """Host can close voting if the timer expires before everyone voted."""
        sender = _sender()
        if sender != self.host:
            raise gl.vm.UserError("Only host can force-close voting")
        if self.phase != PHASE_VOTING:
            raise gl.vm.UserError("Not in voting phase")
        self.phase = PHASE_AI_JUDGING

    # ──────────────────────────────────────────────────────────────────────
    # AI judging — the Intelligent Contract part.
    #
    # The LLM is asked to return ONLY a single digit (1, 2 or 3). That keeps
    # the output strict-equality friendly so validators reach consensus via
    # gl.eq_principle.strict_eq even though the underlying LLM call is
    # non-deterministic.
    # ──────────────────────────────────────────────────────────────────────
    @gl.public.write
    def run_ai_judge(self) -> int:
        if self.phase != PHASE_AI_JUDGING:
            raise gl.vm.UserError("Not in judging phase")
        if self.ai_judged:
            raise gl.vm.UserError("Already judged")

        s1 = self.statements[0]
        s2 = self.statements[1]
        s3 = self.statements[2]

        def llm_pick_lie() -> int:
            prompt = f"""You are the AI Judge in Genjury, a social deduction game.
A player has submitted three statements about themselves —
two are true, exactly one is a lie. Your job is to identify the lie.

Statement 1: "{s1}"
Statement 2: "{s2}"
Statement 3: "{s3}"

Respond with ONLY a single digit: 1, 2, or 3 (the number of the statement
you believe is the lie). No commentary, no JSON, no formatting prefix or
suffix. Just the digit. It is mandatory that you respond with exactly one
character.
"""
            raw = gl.nondet.exec_prompt(prompt).strip()
            for ch in raw:
                if ch in ("1", "2", "3"):
                    return int(ch)
            return 1

        verdict_1based = gl.eq_principle.strict_eq(llm_pick_lie)
        verdict_idx = max(0, min(2, int(verdict_1based) - 1))

        self.ai_verdict_index = u256(verdict_idx)
        self.ai_confidence    = u256(70)
        self.ai_reasoning     = (
            "After analyzing the plausibility of all three statements, "
            f"the AI Judge ruled that Statement {verdict_idx + 1} is the most likely lie."
        )
        self.ai_judged = True
        self.phase = PHASE_OBJECTION
        return verdict_idx

    # ──────────────────────────────────────────────────────────────────────
    # Objection — Optimistic Democracy
    # ──────────────────────────────────────────────────────────────────────
    @gl.public.write
    def raise_objection(self) -> None:
        sender = _sender()
        if self.phase != PHASE_OBJECTION:
            raise gl.vm.UserError("Not objection window")
        if not self._is_player(sender):
            raise gl.vm.UserError("Not a player")
        if self.objection_raised:
            raise gl.vm.UserError("Already raised")

        self.objection_raised = True
        self.objection_by = sender
        self.phase = PHASE_OBJECTION_VOTE

    @gl.public.write
    def cast_objection_vote(self, stance: str) -> None:
        sender = _sender()
        if self.phase != PHASE_OBJECTION_VOTE:
            raise gl.vm.UserError("Not objection-vote phase")
        if not self._is_player(sender):
            raise gl.vm.UserError("Not a player")
        if stance != "sustain" and stance != "overrule":
            raise gl.vm.UserError("stance must be 'sustain' or 'overrule'")
        if sender in self.objection_votes:
            raise gl.vm.UserError("Already voted on objection")

        self.objection_votes[sender] = stance

    @gl.public.write
    def skip_objection(self) -> None:
        """Called when the objection window expires with nobody objecting.

        Host-only to prevent any player from race-finalizing the round before
        someone else has had time to object (the previous open-to-anyone
        version was a denial-of-objection vector).
        """
        sender = _sender()
        if sender != self.host:
            raise gl.vm.UserError("Only host can skip the objection window")
        if self.phase != PHASE_OBJECTION:
            raise gl.vm.UserError("Not objection window")
        self._finalize_round()

    @gl.public.write
    def close_objection_vote(self) -> None:
        """Tally the objection vote and finalize the round.

        Host-only for the same reason as `skip_objection` — keeps a losing
        player from closing the vote before their opponents have voted.
        """
        sender = _sender()
        if sender != self.host:
            raise gl.vm.UserError("Only host can close the objection vote")
        if self.phase != PHASE_OBJECTION_VOTE:
            raise gl.vm.UserError("Not objection-vote phase")
        self._finalize_round()

    # ──────────────────────────────────────────────────────────────────────
    # Reveal & XP — finalize the round
    # ──────────────────────────────────────────────────────────────────────
    def _finalize_round(self) -> None:
        # 1. Tally objection votes.
        sustain = 0
        overrule = 0
        for k in self.objection_votes:
            if self.objection_votes[k] == "sustain":
                sustain += 1
            else:
                overrule += 1

        # 2. Effective verdict (AI verdict, possibly overruled).
        effective_verdict = int(self.ai_verdict_index)
        if self.objection_raised and overrule > sustain:
            effective_verdict = int(self.lie_index)

        ai_was_fooled = effective_verdict != int(self.lie_index)

        # 3. Detectors / fooled.
        detectors = []
        for a in self.player_order:
            if a != self.deceiver:
                detectors.append(a)
        fooled_addrs = []
        for d in detectors:
            voted = -1
            if d in self.votes:
                voted = int(self.votes[d])
            if voted != int(self.lie_index):
                fooled_addrs.append(d)

        # 4. XP awards.
        xp_gained = {}

        d_xp = len(fooled_addrs) * XP_PER_FOOLED_PLAYER
        if ai_was_fooled:
            d_xp += XP_AI_FOOLED_BONUS
        if len(detectors) > 0 and len(fooled_addrs) == len(detectors):
            d_xp += XP_FULL_FOOL_BONUS
        self._update_xp(self.deceiver, d_xp)
        xp_gained[self.deceiver] = d_xp

        for d in detectors:
            voted = -1
            if d in self.votes:
                voted = int(self.votes[d])
            conf = 50
            if d in self.confidence:
                conf = int(self.confidence[d])
            gained = 0
            if voted == int(self.lie_index):
                gained += XP_DETECTOR_BASE
                gained += int((conf * XP_DETECTOR_CONF_MAX) // 100)
            if (self.objection_raised
                    and d in self.objection_votes
                    and self.objection_votes[d] == "sustain"
                    and ai_was_fooled):
                gained += XP_OBJECTION_SUCCESS
            self._update_xp(d, gained)
            xp_gained[d] = gained

        # 5. Build a reveal blob the frontend can render directly.
        votes_map = {}
        conf_map = {}
        for v in self.voters:
            votes_map[v] = int(self.votes[v])
            conf_map[v] = int(self.confidence[v])

        obj_votes_map = {}
        for k in self.objection_votes:
            obj_votes_map[k] = self.objection_votes[k]

        statements_list = [self.statements[0], self.statements[1], self.statements[2]]

        reveal = {
            "round":            int(self.round_num),
            "lieIndex":         int(self.lie_index),
            "statements":       statements_list,
            "deceiver":         self.deceiver,
            "aiVerdictIndex":   int(self.ai_verdict_index),
            "aiConfidence":     int(self.ai_confidence),
            "aiReasoning":      self.ai_reasoning,
            "effectiveVerdict": effective_verdict,
            "aiWasFooled":      ai_was_fooled,
            "objectionRaised":  self.objection_raised,
            "objectionBy":      self.objection_by if self.objection_raised else "",
            "objectionTally":   {"sustain": sustain, "overrule": overrule},
            "votes":            votes_map,
            "confidence":       conf_map,
            "objectionVotes":   obj_votes_map,
            "fooledPlayers":    fooled_addrs,
            "xpGained":         xp_gained,
        }
        self.last_reveal = json.dumps(reveal)
        self.score_history.append(self.last_reveal)
        self.phase = PHASE_REVEAL

    # ──────────────────────────────────────────────────────────────────────
    # Round progression
    # ──────────────────────────────────────────────────────────────────────
    def _settle_winner(self) -> None:
        """Pick the highest-XP player and reserve the prize pool for them.

        Called when the last round finishes and we transition to scoreboard.
        Ties resolve in favour of whichever player joined first (player_order
        scan keeps the first of equal XP).
        """
        best_addr = ""
        best_xp = -1
        for a in self.player_order:
            rec = json.loads(self.players[a])
            xp = int(rec.get("xp", 0))
            if xp > best_xp:
                best_xp = xp
                best_addr = a
        self.winner_address      = best_addr
        self.winner_winnings_wei = u256(int(self.prize_pool))
        # The pool is now reserved for the winner; clear the bookkeeping so
        # leave/refund logic can't double-spend it (lobby is locked anyway).
        self.prize_pool          = u256(0)
        # If there's nothing to claim we mark the game settled immediately.
        self.prize_distributed   = int(self.winner_winnings_wei) == 0

    @gl.public.write
    def next_round(self) -> None:
        if self.phase != PHASE_REVEAL:
            raise gl.vm.UserError("Not in reveal phase")

        if int(self.round_num) >= int(self.max_rounds):
            self._settle_winner()
            self.phase = PHASE_SCOREBOARD
            return

        self.round_num = u256(int(self.round_num) + 1)
        next_idx = (int(self.deceiver_index) + 1) % self._player_count()
        self.deceiver_index = u256(next_idx)
        self.deceiver = self.player_order[next_idx]
        self.category = self._pick_category(int(self.round_num))
        self._reset_round_state()
        self.phase = PHASE_WRITING

    @gl.public.write
    def reset_to_lobby(self) -> None:
        """Host returns the room to lobby for a fresh game.

        We require the winner to have already claimed their prize so we
        don't wipe their entitlement. Outstanding platform fees, however,
        used to *block* reset entirely — meaning an unresponsive platform
        owner could permanently brick the room. Now we auto-sweep those
        fees to the platform owner as part of the reset, so the host always
        has a clean exit path.

        Players are wiped because everyone needs to re-pay the entry fee
        for the next round.
        """
        sender = _sender()
        if sender != self.host:
            raise gl.vm.UserError("Only host can reset")
        if not self.prize_distributed:
            raise gl.vm.UserError("Winner must claim their prize before resetting")

        # Auto-sweep any unclaimed platform fees so the platform owner
        # doesn't have to be online for the host to start a new game.
        outstanding_fees = int(self.platform_fees_collected)
        if outstanding_fees > 0:
            self.platform_fees_collected = u256(0)
            _send_gen(self.platform_owner, outstanding_fees)

        self.phase = PHASE_LOBBY
        self.round_num = u256(0)
        self.deceiver_index = u256(0)
        self.deceiver = ""
        self.category = ""
        self._reset_round_state()
        _clear_arr(self.score_history)

        # Wipe player roster — they must rejoin (and re-pay) for a fresh game.
        _clear_tm(self.players)
        _clear_arr(self.player_order)

        # Reset settlement state.
        self.winner_address      = ""
        self.winner_winnings_wei = u256(0)
        self.prize_distributed   = True

    @gl.public.write
    def set_entry_fee(self, new_fee_wei: int) -> None:
        """Host changes the entry fee for the *next* game.

        Only callable in LOBBY and only while no players have joined yet,
        so we never silently change the price under someone who already
        paid the old rate. If players have already joined, the host should
        either start the game with the existing fee, or call
        `reset_to_lobby()` first (which wipes the roster) and then change
        the fee before reopening signups.

        Negative values are clamped to 0; there is no upper bound (the
        host is trusted to set a sensible price for their own room).
        """
        sender = _sender()
        if sender != self.host:
            raise gl.vm.UserError("Only host can change the entry fee")
        if self.phase != PHASE_LOBBY:
            raise gl.vm.UserError("Entry fee can only be changed in LOBBY")
        if self._player_count() > 0:
            raise gl.vm.UserError(
                "Players have already paid the current fee; "
                "reset_to_lobby() first to change it"
            )
        self.entry_fee = u256(max(0, int(new_fee_wei)))

    @gl.public.write
    def set_max_rounds(self, n: int) -> None:
        """Host changes how many rounds the next game will run.

        LOBBY-only and only while no players have joined yet — same
        reasoning as `set_entry_fee`. Clamped to 1..50 so a typo can't
        brick the room (`max_rounds=0` would settle the game on
        `start_game`, and absurdly large values would just waste time).
        """
        sender = _sender()
        if sender != self.host:
            raise gl.vm.UserError("Only host can change max_rounds")
        if self.phase != PHASE_LOBBY:
            raise gl.vm.UserError("max_rounds can only be changed in LOBBY")
        if self._player_count() > 0:
            raise gl.vm.UserError(
                "Players have already joined; reset_to_lobby() first"
            )
        n = int(n)
        if n < 1 or n > 50:
            raise gl.vm.UserError("max_rounds must be between 1 and 50")
        self.max_rounds = u256(n)

    @gl.public.write
    def set_platform_fee_bps(self, new_bps: int) -> None:
        """Platform owner adjusts their own cut between games.

        Callable only by the **current platform_owner** — never the
        host — so a host can't dial the dev's cut down to 0% on their
        own room. Same LOBBY + no-players-joined-yet guard as
        `set_entry_fee` so we don't change the rate under players who
        already paid in. Silently clamped to [0, MAX_PLATFORM_FEE_BPS]
        so the platform can never exceed the documented 20% cap, even
        with a fat-fingered call.
        """
        sender = _sender()
        if sender != self.platform_owner:
            raise gl.vm.UserError(
                "Only the platform owner can change platform_fee_bps"
            )
        if self.phase != PHASE_LOBBY:
            raise gl.vm.UserError("platform_fee_bps can only be changed in LOBBY")
        if self._player_count() > 0:
            raise gl.vm.UserError(
                "Players have already paid the current fee; "
                "reset_to_lobby() first"
            )
        bps = max(0, min(MAX_PLATFORM_FEE_BPS, int(new_bps)))
        self.platform_fee_bps = u256(bps)

    @gl.public.write
    def set_platform_owner(self, new_owner: str) -> None:
        """Hand off the platform-fee recipient role to a new address.

        Only callable by the **current** platform_owner — never the
        host — so the host can't silently redirect fees to themselves
        on an active room. Any unclaimed fees are auto-swept to the
        *outgoing* owner first so the handoff doesn't accidentally
        transfer pending balances to the new recipient.
        """
        sender = _sender()
        if sender != self.platform_owner:
            raise gl.vm.UserError(
                "Only the current platform owner can transfer this role"
            )
        new_owner_norm = _norm_addr(new_owner)
        if not new_owner_norm:
            raise gl.vm.UserError("New platform owner must be a valid address")

        # Pay out anything pending to the *current* owner before swapping.
        outstanding = int(self.platform_fees_collected)
        if outstanding > 0:
            self.platform_fees_collected = u256(0)
            _send_gen(self.platform_owner, outstanding)

        self.platform_owner = new_owner_norm

    @gl.public.write
    def transfer_host(self, new_host: str) -> None:
        """Hand the host (room admin) role to another address.

        LOBBY-only — handing it off mid-game would let a fresh host
        disrupt an ongoing round via `force_close_voting` etc.
        """
        sender = _sender()
        if sender != self.host:
            raise gl.vm.UserError("Only host can transfer the host role")
        if self.phase != PHASE_LOBBY:
            raise gl.vm.UserError("Host can only be transferred in LOBBY")
        new_host_norm = _norm_addr(new_host)
        if not new_host_norm:
            raise gl.vm.UserError("New host must be a valid address")
        self.host = new_host_norm

    @gl.public.write
    def kick_player(self, addr: str) -> None:
        """Host removes a player from the lobby and refunds their entry fee.

        For dealing with AFK or troll joiners that won't `leave()` on
        their own. Mirrors the refund accounting in `leave()` exactly:
        rolls back the platform-fee / prize-pool slices, deletes the
        player record, compacts `player_order`, and sends the entry
        fee back to the kicked address.
        """
        sender = _sender()
        if sender != self.host:
            raise gl.vm.UserError("Only host can kick players")
        if self.phase != PHASE_LOBBY:
            raise gl.vm.UserError("Players can only be kicked in LOBBY")
        target = _norm_addr(addr)
        if not target:
            raise gl.vm.UserError("Invalid player address")
        if target == sender:
            raise gl.vm.UserError(
                "Host cannot kick themselves; use transfer_host or leave"
            )
        if not self._is_player(target):
            raise gl.vm.UserError("Address is not in the lobby")

        required = int(self.entry_fee)
        if required > 0:
            fee, share = self._split_entry(required)
            self.platform_fees_collected = u256(int(self.platform_fees_collected) - fee)
            self.prize_pool              = u256(int(self.prize_pool) - share)

        del self.players[target]
        kept = [a for a in self.player_order if a != target]
        _clear_arr(self.player_order)
        for a in kept:
            self.player_order.append(a)

        if required > 0:
            _send_gen(target, required)

    @gl.public.write
    def set_max_players(self, n: int) -> None:
        """Host raises or lowers the per-room player cap.

        Bounded by `MIN_PLAYERS` on the low end and the avatar/color
        list length (12) on the high end so we never hand out duplicate
        avatars or colors. Allowed any time during LOBBY, as long as
        the new cap is at least the current player count — we never
        want more players seated than the cap allows.
        """
        sender = _sender()
        if sender != self.host:
            raise gl.vm.UserError("Only host can change max_players")
        if self.phase != PHASE_LOBBY:
            raise gl.vm.UserError("max_players can only be changed in LOBBY")
        n = int(n)
        cap = min(len(AVATARS), len(COLORS))
        if n < MIN_PLAYERS or n > cap:
            raise gl.vm.UserError(
                f"max_players must be between {MIN_PLAYERS} and {cap}"
            )
        if n < self._player_count():
            raise gl.vm.UserError(
                "max_players cannot be set below the current player count"
            )
        self.max_players = u256(n)

    # ──────────────────────────────────────────────────────────────────────
    # Settlement — claims for prize and platform fees
    # ──────────────────────────────────────────────────────────────────────
    @gl.public.write
    def claim_prize(self) -> None:
        """Winner withdraws the prize pool to their wallet."""
        sender = _sender()
        if self.phase != PHASE_SCOREBOARD:
            raise gl.vm.UserError("Game has not finished yet")
        if self.prize_distributed:
            raise gl.vm.UserError("Prize already claimed")
        if sender != self.winner_address:
            raise gl.vm.UserError("Only the winner can claim the prize")

        amount = int(self.winner_winnings_wei)
        # Update bookkeeping BEFORE the external send so a re-entry attempt
        # would find the prize already marked claimed.
        self.winner_winnings_wei = u256(0)
        self.prize_distributed   = True
        _send_gen(sender, amount)

    @gl.public.write
    def claim_platform_fees(self) -> None:
        """Platform owner sweeps accumulated fees to their wallet."""
        sender = _sender()
        if sender != self.platform_owner:
            raise gl.vm.UserError("Only the platform owner can claim fees")

        amount = int(self.platform_fees_collected)
        if amount == 0:
            raise gl.vm.UserError("No platform fees to claim")
        self.platform_fees_collected = u256(0)
        _send_gen(sender, amount)

    # ──────────────────────────────────────────────────────────────────────
    # Read-only views (used by the frontend to render state)
    #
    # IMPORTANT: every view returns a JSON-encoded string instead of a
    # Python dict / list. The previous `dict[str, typing.Any]` signatures
    # tripped GenLayer's calldata encoder on values like nested dicts,
    # `None`, and bigint-as-string mixed alongside ints — producing the
    # "ACCEPTED [ERROR] / no return value" you saw on Bradbury when the
    # frontend tried to verify the contract. Returning a `str` is
    # unambiguous to the encoder; the frontend does `JSON.parse(raw)`.
    # ──────────────────────────────────────────────────────────────────────
    @gl.public.view
    def get_state(self) -> str:
        """Single snapshot of everything the UI needs (JSON-encoded)."""
        votes_map: dict[str, int] = {}
        conf_map:  dict[str, int] = {}
        for v in self.voters:
            votes_map[v] = int(self.votes[v])
            conf_map[v]  = int(self.confidence[v])

        obj_votes_map: dict[str, str] = {}
        for k in self.objection_votes:
            obj_votes_map[k] = self.objection_votes[k]

        players_map: dict[str, typing.Any] = {}
        for a in self.player_order:
            players_map[a] = json.loads(self.players[a])

        statements_list = [self.statements[i] for i in range(len(self.statements))]
        player_order_list = [a for a in self.player_order]
        voters_list = [v for v in self.voters]

        last_reveal_obj: typing.Any = None
        if self.last_reveal:
            last_reveal_obj = json.loads(self.last_reveal)

        return json.dumps({
            "host":            self.host,
            "phase":           self.phase,
            "round":           int(self.round_num),
            "maxRounds":       int(self.max_rounds),
            "category":        self.category,
            "deceiver":        self.deceiver,
            "deceiverIndex":   int(self.deceiver_index),
            "playerOrder":     player_order_list,
            "players":         players_map,
            "statements":      statements_list,
            "submitted":       self.submitted,
            "lieIndex":        int(self.lie_index) if self.submitted else -1,
            "voters":          voters_list,
            "votes":           votes_map,
            "confidence":      conf_map,
            "aiJudged":        self.ai_judged,
            "aiVerdictIndex":  int(self.ai_verdict_index),
            "aiConfidence":    int(self.ai_confidence),
            "aiReasoning":     self.ai_reasoning,
            "objectionRaised": self.objection_raised,
            "objectionBy":     self.objection_by if self.objection_raised else "",
            "objectionVotes":  obj_votes_map,
            "lastReveal":      last_reveal_obj,
            # ── Economics (wei values are encoded as strings so JS can
            #    safely turn them into BigInts without precision loss) ──
            "entryFee":              str(int(self.entry_fee)),
            "prizePool":             str(int(self.prize_pool)),
            "platformFeeBps":        int(self.platform_fee_bps),
            "platformOwner":         self.platform_owner,
            "platformFeesCollected": str(int(self.platform_fees_collected)),
            "winnerAddress":         self.winner_address,
            "winnerWinningsWei":     str(int(self.winner_winnings_wei)),
            "prizeDistributed":      self.prize_distributed,
        })

    @gl.public.view
    def get_phase(self) -> str:
        return self.phase

    @gl.public.view
    def get_round(self) -> int:
        return int(self.round_num)

    @gl.public.view
    def get_last_reveal(self) -> str:
        """JSON-encoded reveal blob, or `""` when no round has finished yet."""
        return self.last_reveal or ""

    @gl.public.view
    def get_economics(self) -> str:
        """Standalone view used by the lobby/landing UI to preview a room.

        Returns a JSON string. The frontend does `JSON.parse(raw)` on it.
        """
        return json.dumps({
            "entryFee":              str(int(self.entry_fee)),
            "prizePool":             str(int(self.prize_pool)),
            "platformFeeBps":        int(self.platform_fee_bps),
            "platformOwner":         self.platform_owner,
            "platformFeesCollected": str(int(self.platform_fees_collected)),
            "winnerAddress":         self.winner_address,
            "winnerWinningsWei":     str(int(self.winner_winnings_wei)),
            "prizeDistributed":      self.prize_distributed,
            "playerCount":           self._player_count(),
            "maxPlayers":            int(self.max_players),
            "phase":                 self.phase,
            "host":                  self.host,
        })

    @gl.public.view
    def get_xp_config(self) -> str:
        """Authoritative XP constants used by `_finalize_round`.

        Exposed so the frontend can show pre-round XP estimates that always
        match what the contract actually awards — no more silent drift
        between the contract and `src/lib/store.js`. JSON-encoded for the
        same reason as the other views.
        """
        return json.dumps({
            "perFooledPlayer":  XP_PER_FOOLED_PLAYER,
            "aiFooledBonus":    XP_AI_FOOLED_BONUS,
            "fullFoolBonus":    XP_FULL_FOOL_BONUS,
            "detectorBase":     XP_DETECTOR_BASE,
            "detectorConfMax":  XP_DETECTOR_CONF_MAX,
            "objectionSuccess": XP_OBJECTION_SUCCESS,
            "levelXp":          500,    # rec["level"] = (xp // 500) + 1
        })

    @gl.public.view
    def get_scoreboard(self) -> str:
        """Sorted XP leaderboard for the SCOREBOARD page (JSON-encoded list)."""
        rows: list[dict[str, typing.Any]] = []
        for addr in self.player_order:
            rec = json.loads(self.players[addr])
            rows.append({
                "address": addr,
                "name":    rec["name"],
                "avatar":  rec["avatar"],
                "color":   rec["color"],
                "xp":      int(rec["xp"]),
                "level":   int(rec["level"]),
            })
        rows.sort(key=lambda r: r["xp"], reverse=True)
        return json.dumps(rows)
