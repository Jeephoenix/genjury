# Genjury

**An on-chain multiplayer bluffing game powered by GenLayer's Intelligent Contracts.**

Players craft statements — two truths and one lie — then bet their confidence trying to detect each other's lies while a decentralised AI judge delivers the final verdict on-chain.

---

## What is Genjury?

Genjury is a social deduction game that runs entirely on the [GenLayer](https://genlayer.com) blockchain. Every game round is managed by an Intelligent Contract that enforces rules, calls the AI judge, and settles XP rewards without any centralised server — the contract is the referee.

### Game loop

1. **Lobby** — A host creates a case and other players join with an invite code. The host configures round count, jury size, and optional entry fee.
2. **Writing phase** — Each juror writes three statements about a chosen topic: two true, one lie. They tag which statement is the lie before locking in.
3. **Voting phase** — Statements are shuffled and revealed anonymously. Players pick which statement they believe is the lie and stake a confidence level (10 – 100%). Higher confidence = bigger XP reward if right, bigger penalty if wrong.
4. **AI judging** — GenLayer's Optimistic Democracy engine evaluates each set of statements and delivers its verdict on-chain, deciding which statement is most likely the lie.
5. **Objection phase** — Players can challenge the AI verdict by voting to Sustain (AI was wrong) or Overrule (AI was right). A majority overrule stands.
6. **Reveal** — The truth is exposed. XP is distributed based on vote accuracy and confidence.
7. **Scoreboard** — Running XP totals after each round. Final scoreboard at game end with leaderboard sync.

---

## Tech stack

| Layer | Technology |
|---|---|
| Blockchain | [GenLayer](https://genlayer.com) (Studionet / Asimov / Bradbury testnets) |
| Smart contracts | Intelligent Contracts (Python-based, on-chain LLM calls) |
| Frontend | React 18 + Vite |
| Styling | Tailwind CSS v3 |
| Animations | Framer Motion |
| State | Zustand |
| Blockchain client | [genlayer-js](https://github.com/yeagerai/genlayer-js) |
| Icons | Lucide React |

---

## Prerequisites

- [Node.js](https://nodejs.org) v18 or later
- [pnpm](https://pnpm.io) v8 or later
- A browser wallet compatible with GenLayer (e.g. MetaMask configured for Studionet)

---

## Getting started

```bash
# Clone the repo
git clone https://github.com/Jeephoenix/genjury.git
cd genjury

# Install dependencies
pnpm install

# Set environment variables
cp artifacts/genjury/.env.example artifacts/genjury/.env
# Edit .env and set VITE_GENJURY_CONTRACT to your deployed contract address

# Start the dev server
pnpm --filter @workspace/genjury run dev
```

The app will be available at `http://localhost:5173`.

---

## Environment variables

| Variable | Description |
|---|---|
| `VITE_GENJURY_CONTRACT` | Address of the deployed Genjury Intelligent Contract |
| `VITE_GENLAYER_NETWORK` | Target network (`studionet`, `asimov`, `bradbury`). Defaults to `studionet` |

---

## Project structure

```
artifacts/genjury/
├── src/
│   ├── components/     # Shared UI components (TopNav, Footer, WalletButton, …)
│   ├── pages/          # Game phase pages (WritingPhase, VotingPhase, …)
│   ├── lib/            # GenLayer client, Zustand store, profile helpers
│   └── styles/         # Global CSS, Tailwind config
├── index.html
├── tailwind.config.js
└── vite.config.ts
```

---

## Testnet disclaimer

Genjury runs exclusively on GenLayer testnets. All tokens are test tokens with **no monetary value**. Do not send real funds to any contract address associated with this project.

---

## Contributing

Pull requests are welcome. Please open an issue first to discuss major changes. When contributing:

- Keep commits scoped and descriptive.
- Follow the existing code style (Tailwind utility classes, Zustand for global state).
- Test on Studionet before submitting.

---

## License

MIT — see [LICENSE](./LICENSE) for details.

---

Built with [GenLayer](https://genlayer.com) · Optimistic Democracy in action.
