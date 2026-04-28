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
| `cast_vote(statement_index, confidence_pct)`            | detector         | VOTING              |
| `force_close_voting()`                                  | host             | VOTING              |
| `run_ai_judge()`                                        | anyone           | AI_JUDGING          |
| `raise_objection()`                                     | any player       | OBJECTION           |
| `cast_objection_vote("sustain" \| "overrule")`          | any player       | OBJECTION_VOTE      |
| `skip_objection()`                                      | anyone           | OBJECTION (timeout) |
| `close_objection_vote()`                                | anyone           | OBJECTION_VOTE      |
| `next_round()`                                          | anyone           | REVEAL              |
| `reset_to_lobby()`                                      | host             | any                 |

## View methods (free reads)

- `get_state()`          — full UI snapshot, JSON
- `get_players()`        — { address: player record }
- `get_phase()`          — current phase string
- `get_round()`          — current round number
- `get_last_reveal()`    — JSON for the REVEAL screen
- `get_score_history()`  — array of past round reveals
- `get_scoreboard()`     — XP leaderboard for the SCOREBOARD page

## How the AI Judge works

`run_ai_judge()` builds a prompt with the three statements and calls the
LLM through `gl.eq_principle_prompt_comparative`. The Equivalence
Principle requires every validator to agree on which statement is the
lie, so consensus is reached even though the LLM output is
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
