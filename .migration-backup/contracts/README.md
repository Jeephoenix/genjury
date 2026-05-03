# Genjury — GenLayer Contract

`genjury.py` is the **Intelligent Contract** that powers the Genjury game.
It owns the full game lifecycle (lobby → writing → voting → AI judging →
objection → reveal → scoreboard), executes the AI Judge on-chain via the
Equivalence Principle, and runs the Optimistic Democracy objection flow.

## Phases

```
LOBBY  →  WRITING  →  VOTING  →  AI_JUDGING  →  OBJECTION
                                               ↘ OBJECTION_VOTE  ↘
                                                        REVEAL  →  next round / SCOREBOARD
```

## Public methods

| Method                                                  | Who calls it     | Phase required      |
| ------------------------------------------------------- | ---------------- | ------------------- |
| `join(name)`                                            | any address      | LOBBY               |
| `leave()`                                               | player           | LOBBY               |
| `start_game()`                                          | host             | LOBBY               |
| `submit_statements(s1, s2, s3, lie_index)`              | deceiver         | WRITING             |
| `force_close_writing()`                                 | host             | WRITING             |
| `cast_vote(statement_index, confidence_pct)`            | detector         | VOTING              |
| `force_close_voting()`                                  | host             | VOTING              |
| `run_ai_judge()`                                        | anyone           | AI_JUDGING          |
| `raise_objection()`                                     | any player       | OBJECTION           |
| `cast_objection_vote("sustain" \| "overrule")`          | any player       | OBJECTION_VOTE      |
| `skip_objection()`                                      | host             | OBJECTION (timeout) |
| `close_objection_vote()`                                | host             | OBJECTION_VOTE      |
| `next_round()`                                          | anyone           | REVEAL              |
| `reset_to_lobby()`                                      | host             | any (auto-sweeps platform fees) |
| `set_entry_fee(new_fee_wei)`                            | host             | LOBBY (no players joined yet) |
| `set_max_rounds(n)`                                     | host             | LOBBY (no players joined yet); 1 ≤ n ≤ 50 |
| `set_platform_fee_bps(new_bps)`                         | **current platform_owner** | LOBBY (no players joined yet); clamped to [0, 2000] |
| `set_platform_owner(new_owner)`                         | **current platform_owner** | any (auto-sweeps pending fees to outgoing owner) |
| `transfer_host(new_host)`                               | host             | LOBBY |
| `kick_player(addr)`                                     | host             | LOBBY (refunds the kicked player's entry fee) |
| `set_max_players(n)`                                    | host             | LOBBY; MIN_PLAYERS ≤ n ≤ 12 and ≥ current player count |

## View methods (free reads)

All views return JSON-encoded **strings** — call `JSON.parse(raw)` on the
client. (Returning typed dicts confused the calldata encoder on
Bradbury and produced "ACCEPTED [ERROR] / no return value" on join.)

- `get_state()`          — full UI snapshot (JSON string)
- `get_phase()`          — current phase string (plain string)
- `get_round()`          — current round number (int)
- `get_last_reveal()`    — JSON string for the REVEAL screen (or `""` when none)
- `get_economics()`      — lobby/landing room preview (JSON string)
- `get_scoreboard()`     — XP leaderboard for the SCOREBOARD page (JSON string of list)
- `get_xp_config()`      — authoritative XP constants for pre-round estimates (JSON string)

## How the AI Judge works

`run_ai_judge()` builds a prompt with the three statements and calls the
LLM through `gl.eq_principle.strict_eq`. The Equivalence Principle
requires every validator to agree on which single digit (1, 2, or 3) the
LLM returned, so consensus is reached even though the LLM output is
non-deterministic. The verdict, confidence, and a short reasoning
sentence are stored on-chain, then the contract advances to the
`OBJECTION` phase to give players a window to challenge it.

## Wiring it up to the React frontend

Replace the mocked `callAIJudge` and the in-memory zustand store in
`src/lib/store.js` with calls to the contract via the GenLayer JS SDK
(`genlayer-js`):

```js
import { createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";

const client = createClient({ chain: testnetBradbury });
const CONTRACT = import.meta.env.VITE_GENJURY_CONTRACT;   // singleton

// Read — every gameplay view takes the room code as the first arg.
const state = JSON.parse(await client.readContract({
  address: CONTRACT,
  functionName: "get_room_state",
  args: ["TRIAL9"],
}));

// Create a room (returns the new code; deployer collects fees globally).
await client.writeContract({
  address: CONTRACT,
  functionName: "create_room",
  args: ["Alice", 3 /* maxRounds */, 0n /* entryFeeWei */, 8 /* maxPlayers */],
});

// Submit statements — every gameplay write takes the room code first.
await client.writeContract({
  address: CONTRACT,
  functionName: "submit_statements",
  args: ["TRIAL9", s1, s2, s3, lieIndex],
});
```

Add these env vars to the Replit project (see `artifacts/genjury/.env.example`):

- `VITE_GENJURY_CONTRACT`    — REQUIRED — deployed singleton contract address
- `VITE_GENLAYER_NETWORK`    — `bradbury` (default) | `asimov` | `studionet` | `localnet`
- `VITE_GENLAYER_RPC`        — optional read-side RPC override

## Deploying

The contract is a **singleton**: the platform owner deploys it ONCE and pastes
the resulting address into `VITE_GENJURY_CONTRACT`. End users never deploy
contracts; they create rooms inside the singleton via `create_room`.

```bash
# from the GenLayer CLI / Studio
genlayer deploy contracts/genjury.py
```

The constructor takes `max_rounds` (default 3).
