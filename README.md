# CallLedger — Social Crypto Trading & Creator Reputation Platform

CallLedger is a social crypto trading platform that allows users to discover crypto traders on X, inspect on-chain verifiable performance records, and execute copy-trading strategies.

## Monorepo Architecture

This repository is organized as a Turborepo monorepo powered by npm workspaces.

```text
call-ledger/
│
├── apps/
│   ├── web/                     # Next.js 16 App Router frontend (Tailwind CSS, discovery & dossier interfaces)
│   ├── api/                     # Express 5 REST backend (PostgreSQL, Drizzle ORM, X API, OAuth 2.0 PKCE)
│   └── worker/                  # PostgreSQL-backed global source polling worker
│
├── packages/
│   ├── database/                # PostgreSQL schema (Drizzle ORM), connection pool, migrations (0000, 0001)
│   ├── shared/                  # Isomorphic TypeScript types, constants, and Zod validation schemas
│   ├── arkiv/                   # Architectural interfaces & documentation for on-chain attestations
│   ├── definitive/              # Architectural interfaces & documentation for Definitive Flash execution
│   ├── strategy-engine/         # Architectural interfaces & validator for copy-trading rules
│   ├── typescript-config/       # Shared tsconfig bases (base, nextjs, node)
│   ├── eslint-config/           # Shared ESLint configuration
│   └── ui/                      # Shared UI components
│
├── .env.example                 # Environment variables specification
├── package.json                 # Monorepo root configuration & scripts
└── turbo.json                   # Turborepo task orchestration pipeline
```

---

## Phase 2: Creator Discovery & X Integration

Phase 2 introduces a 3-stage creator management lifecycle and post ingestion pipeline:

1. **Stage 1 — Discovery & Identity Resolution**: Look up accounts via official X API v2 by handle, verify uniqueness against stable numeric `x_user_id`, and onboard into `DISCOVERED` status without automatic polling.
2. **Stage 2 — Qualification & Account Ownership Verification**:
   - Multi-criteria weighted 0–100 rubric (Signal clarity 25%, Trading activity 15%, Track record 25%, Consistency 15%, Verifiability 20%).
   - OAuth 2.0 Authorization Code Flow with PKCE (`tweet.read`, `users.read`, `offline.access`) to verify creator account ownership. Tokens are encrypted at rest with AES-256-GCM.
3. **Stage 3 — Source Monitoring**:
   - The standalone Phase 2B worker polls global RSS, Bluesky, and authorized website sources with PostgreSQL leases and idempotent normalized post storage.
   - The older X-specific polling services remain for compatibility, but are not scheduled by the current worker. X stays disabled until an authorized provider is implemented.

---

## Phase 2B — Global Creator Source Monitoring

RSS/Atom, Bluesky, and explicitly authorized Firecrawl website sources are
polled globally by the standalone worker. Normalized posts are deduplicated and
stored once; every follower reads those shared rows through the authenticated
activity feed. X ingestion remains disabled without an authorized provider.

See [Phase 2B source monitoring](./docs/phase-2b-source-monitoring.md) for
scheduling, retries, source locks, environment variables, API routes, and run
commands.

---

## Getting Started

### Prerequisites

- Node.js `>=24` (Recommended: v25+)
- npm `>=11.9.0`

### 1. Installation

Install all dependencies across workspaces with a single command:

```bash
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

To enable database connectivity with Neon or a local PostgreSQL instance, configure `DATABASE_URL`:

```env
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require
```

### 3. Database Migrations

Generate and apply Drizzle SQL migrations:

```bash
# Generate SQL migration files from schema
npm run db:generate

# Apply migrations to the configured database
npm run db:migrate

# Push schema directly (development prototyping)
npm run db:push

# Launch Drizzle Studio GUI
npm run db:studio
```

### 4. Running the Complete Monorepo in Development

Start the frontend dashboard, Express 5 API, and background worker concurrently:

```bash
npm run dev
```

- **Web Dashboard**: [http://localhost:3000](http://localhost:3000)
- **API Server**: [http://localhost:8000](http://localhost:8000)
- **API Health Probe**: [http://localhost:8000/api/health](http://localhost:8000/api/health)
- **Background Worker**: Running independently with structured heartbeat logging

---

## Available Scripts

| Command                | Description                                                        |
| ---------------------- | ------------------------------------------------------------------ |
| `npm run dev`          | Starts Next.js web, Express API, and worker concurrently via Turbo |
| `npm run build`        | Compiles all packages and builds the Next.js production bundle     |
| `npm run typecheck`    | Strict TypeScript check across all 8 applications and packages     |
| `npm run lint`         | ESLint static analysis across workspaces                           |
| `npm run format`       | Format repository code with Prettier                               |
| `npm run format:check` | Verify formatting consistency with Prettier                        |
| `npm run db:generate`  | Generates SQL migration files using Drizzle Kit                    |
| `npm run db:migrate`   | Runs migration runner to apply pending SQL migrations              |
| `npm run db:push`      | Pushes schema directly to database                                 |
| `npm run db:studio`    | Launches Drizzle Studio web inspector                              |

---

## Database Architecture

PostgreSQL tables use UUID primary keys, explicit decimal numeric precision,
foreign keys, and indexes. The original trading tables include:

1. `users`: User profiles and authentication records.
2. `wallets`: User-linked EVM and Solana wallet addresses.
3. `creators`: Discovered & qualified trading creators indexed by stable `x_user_id`.
4. `creator_metrics`: Win rates, ROI, signal counts, and cumulative returns.
5. `creator_follows`: User-creator follow relations.
6. `strategies`: Copy-trading allocation, risk limits (SL/TP), and execution modes.
7. `signals`: Captured trading calls with direction (BUY/SELL), entry, TP, and SL.
8. `signal_verifications`: Historical outcome tracking and return calculations.
9. `orders`: Definitive Flash trade records and transaction states.
10. `positions`: Active open and closed positions with realized/unrealized P&L.
11. `arkiv_records`: Entity key references to immutable Arkiv on-chain attestations.

---

## Phase 1 Implementation Status

- **Monorepo Foundation**: Configured npm workspaces and Turborepo 2.11 pipelines.
- **Express 5 API**: Production REST server with probe-backed `/api/health`, `/api/users`, and `/api/creators`.
- **Drizzle Database Package**: Complete schema, client pooling, migration generation (`0000_slim_overlord.sql`).
- **Worker Application**: Standalone process with Zod config, structured logger, and graceful shutdown.
- **Web Dashboard**: Next.js App Router trading dashboard with dark theme, responsive navigation, and 7 complete routes (`/`, `/discover`, `/creators`, `/creators/[id]`, `/signals`, `/strategies`, `/portfolio`, `/activity`).
- **Integration Packages**: Architectural interfaces, typings, and documentation for `@call-ledger/arkiv`, `@call-ledger/definitive`, and `@call-ledger/strategy-engine`.
