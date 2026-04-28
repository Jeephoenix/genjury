# ⚖️ Genjury — The AI Jury Game

> Two truths, one lie. Fool the players. Fool the AI Judge. Built on GenLayer.

Genjury is a multiplayer social-deduction mini-game that showcases GenLayer's **Intelligent Contracts** and **Optimistic Democracy** in a fun, addictive format. Sessions last 5–15 minutes.

## 🎮 How to Play

1. **Deceiver writes** — 2 true statements and 1 lie about themselves (or a chosen category)
2. **Detectors vote** — Players pick which statement they think is the lie, with a confidence multiplier
3. **AI Judge rules** — An Intelligent Contract on GenLayer calls an LLM on-chain and delivers its verdict
4. **Object!** — Any player can raise an Objection, triggering **Optimistic Democracy**: all players vote to Sustain or Overrule the AI
5. **XP awarded** — Based on fooling players, fooling the AI, confidence accuracy, and successful objections

## 🧠 GenLayer Concepts Showcased

| Concept | In-Game Mechanic |
|---|---|
| **Intelligent Contracts** | AI Judge that calls an LLM directly from the contract |
| **Optimistic Democracy** | The Objection system — player vote overrides AI verdict |
| **Non-deterministic Ops** | LLM verdicts vary; validators reach consensus via the Equivalence Principle |
| **Validators** | Run the contract and agree on the AI Judge's verdict digit |
| **Appeal Process** | The Objection → Sustain/Overrule vote flow |

## 🚀 Getting Started

### Prerequisites

- **Node.js 18+** and `npm` (or `pnpm` / `yarn`)
- A **GenLayer endpoint** — pick one:
  - **GenLayer Studio** (easiest, runs locally) — see [docs.genlayer.com](https://docs.genlayer.com) for the one-line install
  - **Asimov Testnet** — public testnet, requires a funded wallet
- Each player's browser auto-generates and stores its own GenLayer wallet in `localStorage`. On testnet you'll need to fund that address with a faucet before creating a room.

### Local development

```bash
# Clone
git clone https://github.com/YOUR_USERNAME/genjury
cd genjury

# Install dependencies
npm install

# Configure your network
cp .env.example .env
# then edit .env — see "Environment variables" below

# Run the dev server
npm run dev
```

Open the printed URL (defaults to `http://localhost:5173`). Click **Deploy & Enter** on the landing page — your browser will deploy a fresh `Genjury` contract and drop you into the lobby. Share the contract address (shown truncated in the lobby) with the other players so they can join the same room.

### Environment variables

Set these in `.env` for local dev and in your Vercel project settings for production:

| Variable | Required? | Description |
|---|---|---|
| `VITE_GENLAYER_NETWORK` | yes | One of `studionet` (default), `localnet`, `testnet` |
| `VITE_GENLAYER_RPC` | optional | Override the chain's default RPC URL (e.g. `http://localhost:4000/api` for Studio) |

### Deploy to Vercel

1. Push the repo to GitHub.
2. Go to [vercel.com](https://vercel.com) → **New Project** → import your repo.
3. Under **Environment Variables**, add `VITE_GENLAYER_NETWORK` (and `VITE_GENLAYER_RPC` if needed).
4. Click **Deploy** — Vercel auto-detects Vite and uses the included `vercel.json`.

> **Note:** All AI Judge calls happen on-chain inside the contract — there's no API key to keep secret in the frontend.

## 🏗️ Tech Stack

- **React 18** + **Vite** — Frontend
- **Zustand** — State management (polls the contract every 1.5s)
- **Tailwind CSS** — Styling
- **GenLayer JS SDK** (`genlayer-js`) — Browser-side contract calls
- **GenLayer Intelligent Contract** (Python) — On-chain game logic + AI Judge

## 📁 Project Structure

```
genjury/
├── contracts/
│   ├── genjury.py            # GenLayer Intelligent Contract — full game logic
│   └── README.md
├── src/
│   ├── lib/
│   │   ├── genlayer.js       # SDK wrapper: account, deploy, read, write
│   │   └── store.js          # Zustand store + 1.5s contract polling
│   ├── components/
│   │   ├── GameHeader.jsx
│   │   ├── TimerRing.jsx
│   │   ├── PlayerCard.jsx
│   │   ├── StatementCard.jsx
│   │   └── ToastContainer.jsx
│   ├── pages/
│   │   ├── LandingPage.jsx       # Deploy or join a room
│   │   ├── LobbyPage.jsx
│   │   ├── WritingPhase.jsx      # Deceiver writes
│   │   ├── VotingPhase.jsx       # Detectors vote
│   │   ├── AIJudgingPhase.jsx
│   │   ├── ObjectionPhase.jsx    # Optimistic Democracy
│   │   ├── RevealPhase.jsx       # Results + XP
│   │   └── ScoreboardPage.jsx
│   ├── styles/
│   │   └── globals.css
│   ├── App.jsx
│   └── main.jsx
├── public/
│   └── favicon.svg
├── .env.example
├── .gitignore
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
└── vercel.json
```

## 🎨 Design System

The game uses a dark cyberpunk aesthetic:
- **Void** (`#050508`) — Background
- **Neon** (`#7fff6e`) — Success, correct answers
- **Plasma** (`#a259ff`) — AI, primary actions
- **Signal** (`#ff6b35`) — Lies, danger
- **Ice** (`#38d9f5`) — Info
- **Gold** (`#f5c842`) — XP, objections

---

Built for GenLayer's Builder Missions · Community Mini-games Track
