# Clone OS

> **Open, multi-tenant operating system for creating, training, evaluating, deploying, transporting, and monetizing portable digital clones of people's professional selves.**

This is a working MVP vertical on the **Sales/Revenue Operations** domain (the "Sarah" RevOps clone), demonstrating the entire frozen architecture end-to-end. See `docs/ARCHITECTURE.md` and `docs/adr/README.md` for the constitution.

## Stack

- **Framework**: Next.js 16 (App Router, Turbopack)
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS 4 + shadcn/ui (New York)
- **Database**: Prisma ORM + PostgreSQL (Neon)
- **Auth**: NextAuth.js v4 (credentials provider, waitlist + admin approval flow)
- **Realtime**: socket.io mini-service for live clone chat
- **AI**: z-ai-web-dev-sdk (LLM) — used server-side by the clone-chat mini-service
- **Charts**: recharts
- **State**: TanStack Query + Zustand

## Quick start

```bash
bun install
cp .env.example .env   # fill in DATABASE_URL, NEXTAUTH_SECRET, etc.
bun run db:push        # push schema to PostgreSQL
bun run scripts/seed.ts # seed Sarah's clone + admin + demo accounts + waitlist
bun run dev            # http://localhost:3000
```

The clone-chat mini-service (port 3003) is the LLM-backed real-time conversation backend:

```bash
cd mini-services/clone-chat-service
bun install
bun run dev   # port 3003
```

## Accounts (seeded)

| Email | Password | Type |
| --- | --- | --- |
| `sarah-admin@clone.os` | `demo` | Demo Admin |
| `sarah@clone.os` | `demo` | Demo User (Sarah RevOps clone owner) |
| `candidate@clone.os` | `demo` | Demo Candidate |
| `dev@clone.os` | `demo` | Demo Developer |

The **real admin** credentials are sourced from `ADMIN_EMAIL` and `ADMIN_PASSWORD` environment variables during seeding — they are never committed to the repository. Set them in your `.env` (local) or in your Vercel project's environment variables (production).

New signups land on a waitlist. Admin approves from the **Admin** section (visible only to admins) — approval creates a real user with a temporary password.

## Architecture

- `prisma/schema.prisma` — 30+ models implementing the frozen core object model
- `src/lib/clone-os/` — frozen design surface (autonomy, model abstraction, clone score, packages, events, expertise graph, fidelity engine)
- `src/app/api/clone-os/` — domain-concept API (GET consolidated state, POST train, POST marketplace match, POST extension install)
- `src/app/api/auth/` — NextAuth + waitlist + admin approval
- `src/components/clone-os/` — dashboard sections + shared UI + auth UI
- `mini-services/clone-chat-service/` — socket.io + LLM mini-service
- `docs/ARCHITECTURE.md` — frozen constitution
- `docs/adr/README.md` — 14 ADRs

## Vercel deployment

The Next.js app deploys to Vercel. The clone-chat mini-service (which needs a long-running WebSocket connection) must be deployed separately — set `NEXT_PUBLIC_SOCKET_URL` on Vercel to point to it. When `NEXT_PUBLIC_SOCKET_URL` is unset, the frontend falls back to the Space-z.ai Caddy gateway (`?XTransformPort=3003`).

Required Vercel env vars:
- `DATABASE_URL` (Neon pooled)
- `DIRECT_DATABASE_URL` (Neon direct)
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL` (your Vercel URL)
- `NEXT_PUBLIC_SOCKET_URL` (your deployed mini-service URL)
