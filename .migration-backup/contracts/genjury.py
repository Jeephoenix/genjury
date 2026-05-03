# v0.3.0
# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

"""
Genjury — multi-room AI Jury game.

Singleton contract: deployed once by the platform; players never deploy.
Each game lives in a Room, keyed by a 6-char alphanumeric code.
"""

from genlayer import *

import json
import typing


@gl.evm.contract_interface
class _Wallet:
    class View:
        pass

    class Write:
        pass


def _send_gen(recipient: str, amount_wei: int) -> None:
    if amount_wei <= 0:
        return
    _Wallet(Address(_norm_addr(recipient))).emit_transfer(value=u256(amount_wei))


def _norm_addr(addr) -> str:
    return str(addr).strip().lower()


def _sender() -> str:
    return _norm_addr(gl.message.sender_address)


# Phases
PHASE_LOBBY          = "lobby"
PHASE_WRITING        = "writing"
PHASE_VOTING         = "voting"
PHASE_AI_JUDGING     = "ai_judging"
PHASE_OBJECTION      = "objection"
PHASE_OBJECTION_VOTE = "objection_vote"
PHASE_REVEAL         = "reveal"
PHASE_SCOREBOARD     = "scoreboard"

MIN_PLAYERS = 2
MAX_PLAYERS_DEFAULT = 8
MAX_PLAYERS_HARD_CAP = 12
MAX_HOUSE_CUT_BPS = 2000

CATEGORIES = [
    "Personal Facts",
    "Pop Culture",
    "Science & Tech",
    "History",
    "Sports",
    "Food & Travel",
    "Wild Cards",
]

XP_PER_FOOLED_PLAYER = 120
XP_AI_FOOLED_BONUS   = 250
XP_FULL_FOOL_BONUS   = 200
XP_DETECTOR_BASE     = 100
XP_DETECTOR_CONF_MAX = 150
XP_OBJECTION_SUCCESS = 80

AVATARS = ["🦊", "🐉", "🦁", "🐺", "🦅", "🐙", "🦈", "🐆", "🦝", "🐻", "🦄", "🐬"]
COLORS  = ["#7fff6e", "#a259ff", "#38d9f5", "#ff6b35",
           "#f5c842", "#ff4d8d", "#00d4aa", "#ff9500",
           "#5b8cff", "#ff5cd6", "#9aff5c", "#ffd86b"]

ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
ROOM_CODE_LEN = 6


def _gen_room_code(seed: int) -> str:
    h = (int(seed) * 2654435761 + 0x9E3779B9) & 0xFFFFFFFFFFFFFFFF
    out = []
    base = len(ROOM_CODE_ALPHABET)
    for _ in range(ROOM_CODE_LEN):
        out.append(ROOM_CODE_ALPHABET[h % base])
        h //= base
        if h == 0:
            h = (seed * 1103515245 + 12345) & 0xFFFFFFFFFFFFFFFF
    return "".join(out)


def _norm_code(code) -> str:
    return str(code).strip().upper()


def _new_room_dict(host: str, host_name: str, max_rounds: int,
                   max_players: int, entry_fee_wei: int) -> dict:
    return {
        "host":            host,
        "phase":           PHASE_LOBBY,
        "round":           0,
        "maxRounds":       int(max_rounds),
        "maxPlayers":      int(max_players),
        "category":        "",
        "deceiver":        "",
        "deceiverIndex":   0,
        "playerOrder":     [],
        "players":         {},
        "statements":      ["", "", ""],
        "submitted":       False,
        "lieIndex":        0,
        "voters":          [],
        "votes":           {},
        "confidence":      {},
        "aiJudged":        False,
        "aiVerdictIndex":  0,
        "aiConfidence":    0,
        "aiReasoning":     "",
        "objectionRaised": False,
        "objectionBy":     "",
        "objectionVotes":  {},
        "lastReveal":      None,
        "scoreHistory":    [],
        "entryFee":        str(int(entry_fee_wei)),
        "prizePool":       "0",
        "winnerAddress":   "",
        "winnerWinnings":  "0",
        "prizeDistributed": True,
        "createdHostName": host_name,
    }


def _player_count(room: dict) -> int:
    return len(room["playerOrder"])


def _is_player(room: dict, addr: str) -> bool:
    return addr in room["players"]


def _new_player_record(name: str, slot: int) -> dict:
    return {
        "name":   name,
        "avatar": AVATARS[slot % len(AVATARS)],
        "color":  COLORS[slot % len(COLORS)],
        "xp":     0,
        "level":  1,
    }


def _split_entry(paid: int, house_cut_bps: int) -> tuple[int, int]:
    if paid <= 0:
        return 0, 0
    fee = (paid * int(house_cut_bps)) // 10000
    return fee, paid - fee


def _pick_category(room_code: str, round_num: int) -> str:
    h = int(round_num) * 2654435761
    for ch in room_code:
        h = (h * 131 + ord(ch)) & 0xFFFFFFFFFFFFFFFF
    return CATEGORIES[h % len(CATEGORIES)]


def _reset_round_state(room: dict) -> None:
    room["statements"] = ["", "", ""]
    room["lieIndex"] = 0
    room["submitted"] = False
    room["voters"] = []
    room["votes"] = {}
    room["confidence"] = {}
    room["aiJudged"] = False
    room["aiVerdictIndex"] = 0
    room["aiConfidence"] = 0
    room["aiReasoning"] = ""
    room["objectionRaised"] = False
    room["objectionBy"] = ""
    room["objectionVotes"] = {}
    room["lastReveal"] = None


def _public_room_view(code: str, room: dict) -> dict:
    return {
        "roomCode":        code,
        "host":            room["host"],
        "hostName":        room.get("createdHostName", ""),
        "phase":           room["phase"],
        "round":           int(room["round"]),
        "maxRounds":       int(room["maxRounds"]),
        "maxPlayers":      int(room["maxPlayers"]),
        "category":        room["category"],
        "deceiver":        room["deceiver"],
        "deceiverIndex":   int(room["deceiverIndex"]),
        "playerOrder":     room["playerOrder"],
        "players":         room["players"],
        "statements":      room["statements"],
        "submitted":       bool(room["submitted"]),
        "lieIndex":        int(room["lieIndex"]) if room["submitted"] else -1,
        "voters":          room["voters"],
        "votes":           room["votes"],
        "confidence":      room["confidence"],
        "aiJudged":        bool(room["aiJudged"]),
        "aiVerdictIndex":  int(room["aiVerdictIndex"]),
        "aiConfidence":    int(room["aiConfidence"]),
        "aiReasoning":     room["aiReasoning"],
        "objectionRaised": bool(room["objectionRaised"]),
        "objectionBy":     room["objectionBy"] if room["objectionRaised"] else "",
        "objectionVotes":  room["objectionVotes"],
        "lastReveal":      room["lastReveal"],
        "entryFee":        str(room["entryFee"]),
        "prizePool":       str(room["prizePool"]),
        "winnerAddress":   room["winnerAddress"],
        "winnerWinnings":  str(room["winnerWinnings"]),
        "prizeDistributed": bool(room["prizeDistributed"]),
        "playerCount":     _player_count(room),
    }


class Genjury(gl.Contract):
    house: str
    house_cut_bps: u256
    house_fees_collected: u256

    rooms: TreeMap[str, str]
    all_room_codes: DynArray[str]
    room_seq: u256

    global_xp: TreeMap[str, str]
    leaderboard_addrs: DynArray[str]

    def __init__(self, house_cut_bps: int = 300):
        self.house = _sender()
        self.house_cut_bps = u256(min(MAX_HOUSE_CUT_BPS, max(0, int(house_cut_bps))))
        self.house_fees_collected = u256(0)
        self.room_seq = u256(0)

    def _load(self, code: str) -> dict:
        c = _norm_code(code)
        if c not in self.rooms:
            raise gl.vm.UserError(f"Room {c} does not exist")
        return json.loads(self.rooms[c])

    def _save(self, code: str, room: dict) -> None:
        self.rooms[_norm_code(code)] = json.dumps(room)

    def _bump_global_xp(self, addr: str, name: str, avatar: str,
                        color: str, gained: int) -> None:
        if addr in self.global_xp:
            rec = json.loads(self.global_xp[addr])
            rec["xp"] = int(rec.get("xp", 0)) + int(gained)
            rec["name"] = name or rec.get("name", "")
            rec["avatar"] = avatar or rec.get("avatar", "")
            rec["color"] = color or rec.get("color", "")
            rec["level"] = (int(rec["xp"]) // 500) + 1
        else:
            rec = {
                "name":   name,
                "avatar": avatar,
                "color":  color,
                "xp":     int(gained),
                "level":  (int(gained) // 500) + 1,
                "wins":   0,
            }
            self.leaderboard_addrs.append(addr)
        self.global_xp[addr] = json.dumps(rec)

    def _bump_global_win(self, addr: str) -> None:
        if addr not in self.global_xp:
            return
        rec = json.loads(self.global_xp[addr])
        rec["wins"] = int(rec.get("wins", 0)) + 1
        self.global_xp[addr] = json.dumps(rec)

    @gl.public.write.payable
    def create_room(self, host_name: str, max_rounds: int = 3,
                    entry_fee_wei: int = 0,
                    max_players: int = MAX_PLAYERS_DEFAULT) -> str:
        sender = _sender()
        name = host_name.strip()
        if len(name) == 0 or len(name) > 24:
            raise gl.vm.UserError("Host name must be 1-24 characters")
        rounds = max(1, min(50, int(max_rounds)))
        cap = min(MAX_PLAYERS_HARD_CAP, max(MIN_PLAYERS, int(max_players)))
        fee_wei = max(0, int(entry_fee_wei))

        paid = int(gl.message.value)
        if paid != fee_wei:
            raise gl.vm.UserError(
                f"Must send exactly {fee_wei} wei (entry fee); received {paid}"
            )

        seq = int(self.room_seq)
        code = _gen_room_code(seq)
        attempts = 0
        while code in self.rooms and attempts < 32:
            seq += 1
            code = _gen_room_code(seq)
            attempts += 1
        if code in self.rooms:
            raise gl.vm.UserError("Could not allocate a room code; try again")
        self.room_seq = u256(seq + 1)

        room = _new_room_dict(sender, name, rounds, cap, fee_wei)
        room["players"][sender] = _new_player_record(name, 0)
        room["playerOrder"].append(sender)

        if fee_wei > 0:
            fee, share = _split_entry(fee_wei, int(self.house_cut_bps))
            self.house_fees_collected = u256(int(self.house_fees_collected) + fee)
            room["prizePool"] = str(int(room["prizePool"]) + share)
            room["prizeDistributed"] = False

        self._save(code, room)
        self.all_room_codes.append(code)
        return code

    @gl.public.write.payable
    def join(self, room_code: str, name: str) -> None:
        sender = _sender()
        room = self._load(room_code)
        if room["phase"] != PHASE_LOBBY:
            raise gl.vm.UserError("Game already started")
        if _player_count(room) >= int(room["maxPlayers"]):
            raise gl.vm.UserError("Room full")
        if _is_player(room, sender):
            raise gl.vm.UserError("Already joined")
        clean = name.strip()
        if len(clean) == 0 or len(clean) > 24:
            raise gl.vm.UserError("Name must be 1-24 characters")

        paid = int(gl.message.value)
        required = int(room["entryFee"])
        if paid != required:
            raise gl.vm.UserError(
                f"Must send exactly {required} wei (entry fee); received {paid}"
            )

        if required > 0:
            fee, share = _split_entry(required, int(self.house_cut_bps))
            self.house_fees_collected = u256(int(self.house_fees_collected) + fee)
            room["prizePool"] = str(int(room["prizePool"]) + share)
            room["prizeDistributed"] = False

        slot = _player_count(room)
        room["players"][sender] = _new_player_record(clean, slot)
        room["playerOrder"].append(sender)
        self._save(room_code, room)

    @gl.public.write
    def leave(self, room_code: str) -> None:
        sender = _sender()
        room = self._load(room_code)
        if room["phase"] != PHASE_LOBBY:
            raise gl.vm.UserError("Cannot leave mid-game")
        if not _is_player(room, sender):
            raise gl.vm.UserError("Not in room")

        required = int(room["entryFee"])
        if required > 0:
            fee, share = _split_entry(required, int(self.house_cut_bps))
            self.house_fees_collected = u256(int(self.house_fees_collected) - fee)
            room["prizePool"] = str(int(room["prizePool"]) - share)

        del room["players"][sender]
        room["playerOrder"] = [a for a in room["playerOrder"] if a != sender]
        self._save(room_code, room)
        _send_gen(sender, required)

    @gl.public.write
    def start_game(self, room_code: str) -> None:
        sender = _sender()
        room = self._load(room_code)
        if sender != room["host"]:
            raise gl.vm.UserError("Only host can start the game")
        if room["phase"] != PHASE_LOBBY:
            raise gl.vm.UserError("Already running")
        if _player_count(room) < MIN_PLAYERS:
            raise gl.vm.UserError(f"Need at least {MIN_PLAYERS} players")

        room["round"] = 1
        room["deceiverIndex"] = 0
        room["deceiver"] = room["playerOrder"][0]
        room["category"] = _pick_category(_norm_code(room_code), 1)
        _reset_round_state(room)
        room["phase"] = PHASE_WRITING
        self._save(room_code, room)

    @gl.public.write
    def submit_statements(self, room_code: str, s1: str, s2: str, s3: str,
                          lie_index: int) -> None:
        sender = _sender()
        room = self._load(room_code)
        if room["phase"] != PHASE_WRITING:
            raise gl.vm.UserError("Not in writing phase")
        if sender != room["deceiver"]:
            raise gl.vm.UserError("Only the deceiver can submit")
        if int(lie_index) not in (0, 1, 2):
            raise gl.vm.UserError("lie_index must be 0, 1 or 2")
        for s in (s1, s2, s3):
            if len(s) == 0 or len(s) > 280:
                raise gl.vm.UserError("Statements must be 1-280 chars")

        room["statements"] = [s1, s2, s3]
        room["lieIndex"] = int(lie_index)
        room["submitted"] = True
        room["phase"] = PHASE_VOTING
        self._save(room_code, room)

    @gl.public.write
    def force_close_writing(self, room_code: str) -> None:
        sender = _sender()
        room = self._load(room_code)
        if sender != room["host"]:
            raise gl.vm.UserError("Only host can force-close writing")
        if room["phase"] != PHASE_WRITING:
            raise gl.vm.UserError("Not in writing phase")

        skipped_reveal = {
            "round":            int(room["round"]),
            "lieIndex":         -1,
            "statements":       ["", "", ""],
            "deceiver":         room["deceiver"],
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
        }
        room["lastReveal"] = skipped_reveal
        room["scoreHistory"].append(skipped_reveal)
        room["phase"] = PHASE_REVEAL
        self._save(room_code, room)

    @gl.public.write
    def cast_vote(self, room_code: str, statement_index: int,
                  confidence_pct: int) -> None:
        sender = _sender()
        room = self._load(room_code)
        if room["phase"] != PHASE_VOTING:
            raise gl.vm.UserError("Not in voting phase")
        if not _is_player(room, sender):
            raise gl.vm.UserError("Not a player")
        if sender == room["deceiver"]:
            raise gl.vm.UserError("Deceiver cannot vote")
        if int(statement_index) not in (0, 1, 2):
            raise gl.vm.UserError("Vote must be 0, 1 or 2")
        cp = int(confidence_pct)
        if cp < 0 or cp > 100:
            raise gl.vm.UserError("Confidence must be 0-100")
        if sender in room["votes"]:
            raise gl.vm.UserError("Already voted")

        room["votes"][sender] = int(statement_index)
        room["confidence"][sender] = cp
        room["voters"].append(sender)

        detectors = _player_count(room) - 1
        if len(room["voters"]) >= detectors:
            room["phase"] = PHASE_AI_JUDGING

        self._save(room_code, room)

    @gl.public.write
    def force_close_voting(self, room_code: str) -> None:
        sender = _sender()
        room = self._load(room_code)
        if sender != room["host"]:
            raise gl.vm.UserError("Only host can force-close voting")
        if room["phase"] != PHASE_VOTING:
            raise gl.vm.UserError("Not in voting phase")
        room["phase"] = PHASE_AI_JUDGING
        self._save(room_code, room)

    @gl.public.write
    def run_ai_judge(self, room_code: str) -> int:
        room = self._load(room_code)
        if room["phase"] != PHASE_AI_JUDGING:
            raise gl.vm.UserError("Not in judging phase")
        if room["aiJudged"]:
            raise gl.vm.UserError("Already judged")

        s1 = room["statements"][0]
        s2 = room["statements"][1]
        s3 = room["statements"][2]

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

        room["aiVerdictIndex"] = verdict_idx
        room["aiConfidence"] = 70
        room["aiReasoning"] = (
            "After analyzing the plausibility of all three statements, "
            f"the AI Judge ruled that Statement {verdict_idx + 1} is the most likely lie."
        )
        room["aiJudged"] = True
        room["phase"] = PHASE_OBJECTION
        self._save(room_code, room)
        return verdict_idx

    @gl.public.write
    def raise_objection(self, room_code: str) -> None:
        sender = _sender()
        room = self._load(room_code)
        if room["phase"] != PHASE_OBJECTION:
            raise gl.vm.UserError("Not objection window")
        if not _is_player(room, sender):
            raise gl.vm.UserError("Not a player")
        if room["objectionRaised"]:
            raise gl.vm.UserError("Already raised")

        room["objectionRaised"] = True
        room["objectionBy"] = sender
        room["phase"] = PHASE_OBJECTION_VOTE
        self._save(room_code, room)

    @gl.public.write
    def cast_objection_vote(self, room_code: str, stance: str) -> None:
        sender = _sender()
        room = self._load(room_code)
        if room["phase"] != PHASE_OBJECTION_VOTE:
            raise gl.vm.UserError("Not objection-vote phase")
        if not _is_player(room, sender):
            raise gl.vm.UserError("Not a player")
        if stance != "sustain" and stance != "overrule":
            raise gl.vm.UserError("stance must be 'sustain' or 'overrule'")
        if sender in room["objectionVotes"]:
            raise gl.vm.UserError("Already voted on objection")

        room["objectionVotes"][sender] = stance
        self._save(room_code, room)

    @gl.public.write
    def skip_objection(self, room_code: str) -> None:
        sender = _sender()
        room = self._load(room_code)
        if sender != room["host"]:
            raise gl.vm.UserError("Only host can skip the objection window")
        if room["phase"] != PHASE_OBJECTION:
            raise gl.vm.UserError("Not objection window")
        self._finalize_round(room_code, room)

    @gl.public.write
    def close_objection_vote(self, room_code: str) -> None:
        sender = _sender()
        room = self._load(room_code)
        if sender != room["host"]:
            raise gl.vm.UserError("Only host can close the objection vote")
        if room["phase"] != PHASE_OBJECTION_VOTE:
            raise gl.vm.UserError("Not objection-vote phase")
        self._finalize_round(room_code, room)

    def _finalize_round(self, room_code: str, room: dict) -> None:
        sustain = 0
        overrule = 0
        for k in room["objectionVotes"]:
            if room["objectionVotes"][k] == "sustain":
                sustain += 1
            else:
                overrule += 1

        effective_verdict = int(room["aiVerdictIndex"])
        if room["objectionRaised"] and overrule > sustain:
            effective_verdict = int(room["lieIndex"])

        ai_was_fooled = effective_verdict != int(room["lieIndex"])

        detectors = [a for a in room["playerOrder"] if a != room["deceiver"]]
        fooled_addrs = []
        for d in detectors:
            voted = -1
            if d in room["votes"]:
                voted = int(room["votes"][d])
            if voted != int(room["lieIndex"]):
                fooled_addrs.append(d)

        xp_gained = {}

        d_xp = len(fooled_addrs) * XP_PER_FOOLED_PLAYER
        if ai_was_fooled:
            d_xp += XP_AI_FOOLED_BONUS
        if len(detectors) > 0 and len(fooled_addrs) == len(detectors):
            d_xp += XP_FULL_FOOL_BONUS

        deceiver = room["deceiver"]
        deceiver_rec = room["players"][deceiver]
        deceiver_rec["xp"] = int(deceiver_rec["xp"]) + d_xp
        deceiver_rec["level"] = (int(deceiver_rec["xp"]) // 500) + 1
        room["players"][deceiver] = deceiver_rec
        xp_gained[deceiver] = d_xp
        self._bump_global_xp(deceiver, deceiver_rec["name"],
                             deceiver_rec["avatar"], deceiver_rec["color"], d_xp)

        for d in detectors:
            voted = -1
            if d in room["votes"]:
                voted = int(room["votes"][d])
            conf = 50
            if d in room["confidence"]:
                conf = int(room["confidence"][d])
            gained = 0
            if voted == int(room["lieIndex"]):
                gained += XP_DETECTOR_BASE
                gained += int((conf * XP_DETECTOR_CONF_MAX) // 100)
            if (room["objectionRaised"]
                    and d in room["objectionVotes"]
                    and room["objectionVotes"][d] == "sustain"
                    and ai_was_fooled):
                gained += XP_OBJECTION_SUCCESS
            d_rec = room["players"][d]
            d_rec["xp"] = int(d_rec["xp"]) + gained
            d_rec["level"] = (int(d_rec["xp"]) // 500) + 1
            room["players"][d] = d_rec
            xp_gained[d] = gained
            self._bump_global_xp(d, d_rec["name"], d_rec["avatar"],
                                 d_rec["color"], gained)

        reveal = {
            "round":            int(room["round"]),
            "lieIndex":         int(room["lieIndex"]),
            "statements":       room["statements"],
            "deceiver":         deceiver,
            "aiVerdictIndex":   int(room["aiVerdictIndex"]),
            "aiConfidence":     int(room["aiConfidence"]),
            "aiReasoning":      room["aiReasoning"],
            "effectiveVerdict": effective_verdict,
            "aiWasFooled":      ai_was_fooled,
            "objectionRaised":  bool(room["objectionRaised"]),
            "objectionBy":      room["objectionBy"] if room["objectionRaised"] else "",
            "objectionTally":   {"sustain": sustain, "overrule": overrule},
            "votes":            dict(room["votes"]),
            "confidence":       dict(room["confidence"]),
            "objectionVotes":   dict(room["objectionVotes"]),
            "fooledPlayers":    fooled_addrs,
            "xpGained":         xp_gained,
        }
        room["lastReveal"] = reveal
        room["scoreHistory"].append(reveal)
        room["phase"] = PHASE_REVEAL
        self._save(room_code, room)

    def _settle_winner(self, room: dict) -> None:
        best_addr = ""
        best_xp = -1
        for a in room["playerOrder"]:
            xp = int(room["players"][a].get("xp", 0))
            if xp > best_xp:
                best_xp = xp
                best_addr = a
        room["winnerAddress"] = best_addr
        room["winnerWinnings"] = str(int(room["prizePool"]))
        room["prizePool"] = "0"
        room["prizeDistributed"] = int(room["winnerWinnings"]) == 0
        if best_addr:
            self._bump_global_win(best_addr)

    @gl.public.write
    def next_round(self, room_code: str) -> None:
        room = self._load(room_code)
        if room["phase"] != PHASE_REVEAL:
            raise gl.vm.UserError("Not in reveal phase")

        if int(room["round"]) >= int(room["maxRounds"]):
            self._settle_winner(room)
            room["phase"] = PHASE_SCOREBOARD
            self._save(room_code, room)
            return

        room["round"] = int(room["round"]) + 1
        next_idx = (int(room["deceiverIndex"]) + 1) % _player_count(room)
        room["deceiverIndex"] = next_idx
        room["deceiver"] = room["playerOrder"][next_idx]
        room["category"] = _pick_category(_norm_code(room_code), int(room["round"]))
        _reset_round_state(room)
        room["phase"] = PHASE_WRITING
        self._save(room_code, room)

    @gl.public.write
    def claim_prize(self, room_code: str) -> None:
        sender = _sender()
        room = self._load(room_code)
        if room["phase"] != PHASE_SCOREBOARD:
            raise gl.vm.UserError("Game has not finished yet")
        if room["prizeDistributed"]:
            raise gl.vm.UserError("Prize already claimed")
        if sender != room["winnerAddress"]:
            raise gl.vm.UserError("Only the winner can claim the prize")

        amount = int(room["winnerWinnings"])
        room["winnerWinnings"] = "0"
        room["prizeDistributed"] = True
        self._save(room_code, room)
        _send_gen(sender, amount)

    @gl.public.write
    def reset_to_lobby(self, room_code: str) -> None:
        sender = _sender()
        room = self._load(room_code)
        if sender != room["host"]:
            raise gl.vm.UserError("Only host can reset")
        if not room["prizeDistributed"]:
            raise gl.vm.UserError("Winner must claim their prize before resetting")

        room["phase"] = PHASE_LOBBY
        room["round"] = 0
        room["deceiverIndex"] = 0
        room["deceiver"] = ""
        room["category"] = ""
        _reset_round_state(room)
        room["scoreHistory"] = []
        room["players"] = {}
        room["playerOrder"] = []
        room["winnerAddress"] = ""
        room["winnerWinnings"] = "0"
        room["prizeDistributed"] = True
        self._save(room_code, room)

    @gl.public.write
    def set_entry_fee(self, room_code: str, new_fee_wei: int) -> None:
        sender = _sender()
        room = self._load(room_code)
        if sender != room["host"]:
            raise gl.vm.UserError("Only host can change the entry fee")
        if room["phase"] != PHASE_LOBBY:
            raise gl.vm.UserError("Entry fee can only be changed in LOBBY")
        if _player_count(room) > 0:
            raise gl.vm.UserError(
                "Players have already paid the current fee; reset_to_lobby() first"
            )
        room["entryFee"] = str(max(0, int(new_fee_wei)))
        self._save(room_code, room)

    @gl.public.write
    def set_max_rounds(self, room_code: str, n: int) -> None:
        sender = _sender()
        room = self._load(room_code)
        if sender != room["host"]:
            raise gl.vm.UserError("Only host can change max_rounds")
        if room["phase"] != PHASE_LOBBY:
            raise gl.vm.UserError("max_rounds can only be changed in LOBBY")
        if _player_count(room) > 0:
            raise gl.vm.UserError("Players have already joined; reset_to_lobby() first")
        nv = int(n)
        if nv < 1 or nv > 50:
            raise gl.vm.UserError("max_rounds must be between 1 and 50")
        room["maxRounds"] = nv
        self._save(room_code, room)

    @gl.public.write
    def set_max_players(self, room_code: str, n: int) -> None:
        sender = _sender()
        room = self._load(room_code)
        if sender != room["host"]:
            raise gl.vm.UserError("Only host can change max_players")
        if room["phase"] != PHASE_LOBBY:
            raise gl.vm.UserError("max_players can only be changed in LOBBY")
        nv = int(n)
        if nv < MIN_PLAYERS or nv > MAX_PLAYERS_HARD_CAP:
            raise gl.vm.UserError(
                f"max_players must be between {MIN_PLAYERS} and {MAX_PLAYERS_HARD_CAP}"
            )
        if nv < _player_count(room):
            raise gl.vm.UserError("max_players cannot be set below the current player count")
        room["maxPlayers"] = nv
        self._save(room_code, room)

    @gl.public.write
    def kick_player(self, room_code: str, addr: str) -> None:
        sender = _sender()
        room = self._load(room_code)
        if sender != room["host"]:
            raise gl.vm.UserError("Only host can kick players")
        if room["phase"] != PHASE_LOBBY:
            raise gl.vm.UserError("Players can only be kicked in LOBBY")
        target = _norm_addr(addr)
        if not target:
            raise gl.vm.UserError("Invalid player address")
        if target == sender:
            raise gl.vm.UserError("Host cannot kick themselves")
        if not _is_player(room, target):
            raise gl.vm.UserError("Address is not in the lobby")

        required = int(room["entryFee"])
        if required > 0:
            fee, share = _split_entry(required, int(self.house_cut_bps))
            self.house_fees_collected = u256(int(self.house_fees_collected) - fee)
            room["prizePool"] = str(int(room["prizePool"]) - share)

        del room["players"][target]
        room["playerOrder"] = [a for a in room["playerOrder"] if a != target]
        self._save(room_code, room)
        if required > 0:
            _send_gen(target, required)

    @gl.public.write
    def transfer_host(self, room_code: str, new_host: str) -> None:
        sender = _sender()
        room = self._load(room_code)
        if sender != room["host"]:
            raise gl.vm.UserError("Only host can transfer the host role")
        if room["phase"] != PHASE_LOBBY:
            raise gl.vm.UserError("Host can only be transferred in LOBBY")
        new_host_norm = _norm_addr(new_host)
        if not new_host_norm:
            raise gl.vm.UserError("New host must be a valid address")
        room["host"] = new_host_norm
        self._save(room_code, room)

    @gl.public.write
    def claim_house_fees(self) -> None:
        sender = _sender()
        if sender != self.house:
            raise gl.vm.UserError("Only the house can claim house fees")
        amount = int(self.house_fees_collected)
        if amount == 0:
            raise gl.vm.UserError("No house fees to claim")
        self.house_fees_collected = u256(0)
        _send_gen(sender, amount)

    @gl.public.write
    def transfer_house(self, new_house: str) -> None:
        sender = _sender()
        if sender != self.house:
            raise gl.vm.UserError("Only the current house can transfer this role")
        new_house_norm = _norm_addr(new_house)
        if not new_house_norm:
            raise gl.vm.UserError("New house must be a valid address")
        outstanding = int(self.house_fees_collected)
        if outstanding > 0:
            self.house_fees_collected = u256(0)
            _send_gen(self.house, outstanding)
        self.house = new_house_norm

    @gl.public.write
    def set_house_cut_bps(self, new_bps: int) -> None:
        sender = _sender()
        if sender != self.house:
            raise gl.vm.UserError("Only the house can change house_cut_bps")
        bps = max(0, min(MAX_HOUSE_CUT_BPS, int(new_bps)))
        self.house_cut_bps = u256(bps)

    @gl.public.view
    def get_room_state(self, room_code: str) -> str:
        c = _norm_code(room_code)
        if c not in self.rooms:
            return ""
        room = json.loads(self.rooms[c])
        view = _public_room_view(c, room)
        view["house"] = self.house
        view["houseCutBps"] = int(self.house_cut_bps)
        return json.dumps(view)

    @gl.public.view
    def get_room_economics(self, room_code: str) -> str:
        c = _norm_code(room_code)
        if c not in self.rooms:
            return ""
        room = json.loads(self.rooms[c])
        return json.dumps({
            "roomCode":         c,
            "phase":            room["phase"],
            "entryFee":         str(room["entryFee"]),
            "prizePool":        str(room["prizePool"]),
            "playerCount":      _player_count(room),
            "maxPlayers":       int(room["maxPlayers"]),
            "maxRounds":        int(room["maxRounds"]),
            "host":             room["host"],
            "hostName":         room.get("createdHostName", ""),
            "winnerAddress":    room["winnerAddress"],
            "winnerWinnings":   str(room["winnerWinnings"]),
            "prizeDistributed": bool(room["prizeDistributed"]),
            "houseCutBps":      int(self.house_cut_bps),
        })

    @gl.public.view
    def list_open_rooms(self, limit: int = 20) -> str:
        out = []
        n = len(self.all_room_codes)
        cap = min(int(limit), 100)
        for i in range(n - 1, -1, -1):
            if len(out) >= cap:
                break
            code = self.all_room_codes[i]
            if code not in self.rooms:
                continue
            room = json.loads(self.rooms[code])
            if room["phase"] != PHASE_LOBBY:
                continue
            out.append({
                "roomCode":    code,
                "hostName":    room.get("createdHostName", ""),
                "host":        room["host"],
                "phase":       room["phase"],
                "playerCount": _player_count(room),
                "maxPlayers":  int(room["maxPlayers"]),
                "maxRounds":   int(room["maxRounds"]),
                "entryFee":    str(room["entryFee"]),
                "prizePool":   str(room["prizePool"]),
            })
        return json.dumps(out)

    @gl.public.view
    def list_live_rooms(self, limit: int = 20) -> str:
        out = []
        n = len(self.all_room_codes)
        cap = min(int(limit), 100)
        for i in range(n - 1, -1, -1):
            if len(out) >= cap:
                break
            code = self.all_room_codes[i]
            if code not in self.rooms:
                continue
            room = json.loads(self.rooms[code])
            ph = room["phase"]
            if ph in (PHASE_LOBBY, PHASE_SCOREBOARD):
                continue
            out.append({
                "roomCode":    code,
                "hostName":    room.get("createdHostName", ""),
                "phase":       ph,
                "round":       int(room["round"]),
                "maxRounds":   int(room["maxRounds"]),
                "playerCount": _player_count(room),
                "maxPlayers":  int(room["maxPlayers"]),
                "prizePool":   str(room["prizePool"]),
            })
        return json.dumps(out)

    @gl.public.view
    def get_global_leaderboard(self, limit: int = 50) -> str:
        rows = []
        for addr in self.leaderboard_addrs:
            if addr not in self.global_xp:
                continue
            rec = json.loads(self.global_xp[addr])
            rows.append({
                "address": addr,
                "name":    rec.get("name", ""),
                "avatar":  rec.get("avatar", ""),
                "color":   rec.get("color", ""),
                "xp":      int(rec.get("xp", 0)),
                "level":   int(rec.get("level", 1)),
                "wins":    int(rec.get("wins", 0)),
            })
        rows.sort(key=lambda r: r["xp"], reverse=True)
        cap = min(int(limit), 200)
        return json.dumps(rows[:cap])

    @gl.public.view
    def get_room_scoreboard(self, room_code: str) -> str:
        c = _norm_code(room_code)
        if c not in self.rooms:
            return "[]"
        room = json.loads(self.rooms[c])
        rows = []
        for addr in room["playerOrder"]:
            rec = room["players"][addr]
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

    @gl.public.view
    def get_xp_config(self) -> str:
        return json.dumps({
            "perFooledPlayer":  XP_PER_FOOLED_PLAYER,
            "aiFooledBonus":    XP_AI_FOOLED_BONUS,
            "fullFoolBonus":    XP_FULL_FOOL_BONUS,
            "detectorBase":     XP_DETECTOR_BASE,
            "detectorConfMax":  XP_DETECTOR_CONF_MAX,
            "objectionSuccess": XP_OBJECTION_SUCCESS,
            "levelXp":          500,
        })

    @gl.public.view
    def get_house_info(self) -> str:
        return json.dumps({
            "house":              self.house,
            "houseCutBps":        int(self.house_cut_bps),
            "houseFeesCollected": str(int(self.house_fees_collected)),
            "totalRooms":         len(self.all_room_codes),
        })
