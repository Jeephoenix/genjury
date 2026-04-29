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
import { createClient, simulator } from "genlayer-js";

const client = createClient({
  chain: simulator,                       // or testnetAsimov
  endpoint: import.meta.env.VITE_GENLAYER_RPC,
});

// Read
const state = JSON.parse(await client.readContract({
  address: import.meta.env.VITE_CONTRACT_ADDRESS,
  functionName: "get_state",
}));

// Write — e.g. submit statements
await client.writeContract({
  address: import.meta.env.VITE_CONTRACT_ADDRESS,
  functionName: "submit_statements",
  args: [s1, s2, s3, lieIndex],
});
```

Add these to your Vercel project as env vars:

- `VITE_GENLAYER_RPC`        — GenLayer RPC endpoint
- `VITE_CONTRACT_ADDRESS`    — deployed contract address

## Deploying

```bash
# from the GenLayer CLI / Studio
genlayer deploy contracts/genjury.py --constructor-args 3
```

The constructor takes `max_rounds` (default 3).
