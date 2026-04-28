# v0.2.16
# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

"""
Genjury — The AI Jury Game
==========================

GenLayer Intelligent Contract that powers a multiplayer "two truths,
one lie" social deduction game. It demonstrates four core GenLayer
concepts:

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
COLORS  = ["#7fff6e", "#a259ff", "#38d9f5", "#ff6b35",
           "#f5c842", "#ff4d8d", "#00d4aa", "#ff9500"]


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

    # ──────────────────────────────────────────────────────────────────────
    # Construction
    # ──────────────────────────────────────────────────────────────────────
    def __init__(self, max_rounds: int = 3):
        self.host = str(gl.message.sender_address)
        self.phase = PHASE_LOBBY
        self.round_num = u256(0)
        self.max_rounds = u256(max_rounds)
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
        return CATEGORIES[salt % len(CATEGORIES)]

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

    # ──────────────────────────────────────────────────────────────────────
    # Lobby — join / leave / start
    # ──────────────────────────────────────────────────────────────────────
    @gl.public.write
    def join(self, name: str) -> None:
        """Add the caller to the lobby with a chosen display name."""
        sender = str(gl.message.sender_address)
        if self.phase != PHASE_LOBBY:
            raise gl.vm.UserError("Game already started")
        if self._player_count() >= MAX_PLAYERS:
            raise gl.vm.UserError("Lobby full")
        if self._is_player(sender):
            raise gl.vm.UserError("Already joined")
        if len(name) == 0 or len(name) > 24:
            raise gl.vm.UserError("Name must be 1-24 characters")

        slot = self._player_count()
        self.players[sender] = self._new_player_record(name, slot)
        self.player_order.append(sender)

    @gl.public.write
    def leave(self) -> None:
        """Leave the lobby. Only allowed before the game starts."""
        sender = str(gl.message.sender_address)
        if self.phase != PHASE_LOBBY:
            raise gl.vm.UserError("Cannot leave mid-game")
        if not self._is_player(sender):
            raise gl.vm.UserError("Not in lobby")

        del self.players[sender]
        kept = [a for a in self.player_order if a != sender]
        _clear_arr(self.player_order)
        for a in kept:
            self.player_order.append(a)

    @gl.public.write
    def start_game(self) -> None:
        """Host kicks the game off. Round 1, deceiver = player_order[0]."""
        sender = str(gl.message.sender_address)
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
        sender = str(gl.message.sender_address)
        if self.phase != PHASE_WRITING:
            raise gl.vm.UserError("Not in writing phase")
        if sender != self.deceiver:
            raise gl.vm.UserError("Only the deceiver can submit")
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

    # ──────────────────────────────────────────────────────────────────────
    # Voting phase — every detector picks the statement they think is the lie
    # ──────────────────────────────────────────────────────────────────────
    @gl.public.write
    def cast_vote(self, statement_index: int, confidence_pct: int) -> None:
        sender = str(gl.message.sender_address)
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
        sender = str(gl.message.sender_address)
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
        sender = str(gl.message.sender_address)
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
        sender = str(gl.message.sender_address)
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
        """Called when the objection window expires with nobody objecting."""
        if self.phase != PHASE_OBJECTION:
            raise gl.vm.UserError("Not objection window")
        self._finalize_round()

    @gl.public.write
    def close_objection_vote(self) -> None:
        """Tally the objection vote and finalize the round."""
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
    @gl.public.write
    def next_round(self) -> None:
        if self.phase != PHASE_REVEAL:
            raise gl.vm.UserError("Not in reveal phase")

        if int(self.round_num) >= int(self.max_rounds):
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
        """Host returns the room to lobby for a fresh game (keeps players)."""
        sender = str(gl.message.sender_address)
        if sender != self.host:
            raise gl.vm.UserError("Only host can reset")

        self.phase = PHASE_LOBBY
        self.round_num = u256(0)
        self.deceiver_index = u256(0)
        self.deceiver = ""
        self.category = ""
        self._reset_round_state()
        _clear_arr(self.score_history)

        for addr in self.player_order:
            rec = json.loads(self.players[addr])
            rec["xp"]    = 0
            rec["level"] = 1
            self.players[addr] = json.dumps(rec)

    # ──────────────────────────────────────────────────────────────────────
    # Read-only views (used by the frontend to render state)
    # ──────────────────────────────────────────────────────────────────────
    @gl.public.view
    def get_state(self) -> dict[str, typing.Any]:
        """Single snapshot of everything the UI needs."""
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

        return {
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
        }

    @gl.public.view
    def get_phase(self) -> str:
        return self.phase

    @gl.public.view
    def get_round(self) -> int:
        return int(self.round_num)

    @gl.public.view
    def get_last_reveal(self) -> typing.Any:
        if self.last_reveal:
            return json.loads(self.last_reveal)
        return None

    @gl.public.view
    def get_scoreboard(self) -> list[dict[str, typing.Any]]:
        """Sorted XP leaderboard for the SCOREBOARD page."""
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
        return rows
