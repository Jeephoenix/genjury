# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Artifacts

### Genjury (artifacts/genjury)
- **Kind**: Web app (React + Vite)
- **Preview path**: `/`
- **Description**: On-chain multiplayer bluffing game judged by AI using GenLayer blockchain
- **Stack**: React 19, Vite 7, Tailwind CSS v3, zustand, genlayer-js, socket.io-client, nanoid
- **Key files**:
  - `src/App.tsx` — root component with router setup
  - `src/styles/globals.css` — global styles (Tailwind base + custom)
  - `src/components/` — all UI components (JSX, uses `@ts-nocheck`)
  - `tailwind.config.js` — Tailwind v3 config
  - `vite.config.ts` — Vite config with PostCSS plugin setup

### API Server (artifacts/api-server)
- **Kind**: Express API
- **Port**: 8080 (proxied via `/api/`)
- **Routes**:
  - `GET/POST/PATCH /api/chat` — multiplayer chat messages with reactions
  - `POST /api/faucet` — GenLayer testnet faucet drip
  - `GET /api/healthz` — health check
- **Key files**:
  - `src/routes/chat.ts` — chat endpoints (DB-backed with in-memory fallback)
  - `src/routes/faucet.ts` — faucet drip endpoint

## Database Schema

Located in `lib/db/src/schema/`:
- `chat_messages` — room-scoped chat messages (id, roomCode, authorId, authorName, avatar, color, text, kind, ts)
- `chat_reactions` — emoji reactions on messages (msgId, emoji, userId)

Run `pnpm --filter @workspace/db run push` after schema changes.

## Environment Variables

- `DATABASE_URL` — PostgreSQL connection string (auto-set by Replit DB)
- `VITE_GENJURY_CONTRACT` — GenLayer smart contract address (required for on-chain features)
- `VITE_GENLAYER_RPC_URL` — GenLayer RPC endpoint
