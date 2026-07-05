# BuildFlow — Construction Scheduling & Collaboration (MVP)

A simplified, Outbuild-style scheduling & collaboration tool for construction projects. Built with Next.js (App Router), TypeScript, Tailwind CSS, Prisma + PostgreSQL (Neon), Better Auth, and Zod.

## Features

### Foundation
- **Auth**: email/password + Google OAuth sign-in (Better Auth)
- **Organizations**: sign up, create/join an org; projects belong to an org
- **Per-project roles**: a user can hold a different role on each project — `PROJECT_MANAGER` (full access), `SCHEDULER` (edit tasks/dates/dependencies), `SUPERINTENDENT` (edit tasks, own/resolve roadblocks), or `TRADE` (own assigned tasks only)
- **Link-based invites**: generate a shareable `/invite/[token]` link with a preset role — no email sending in v1
- **Tasks**: name, assigned trade/person, start/end dates, status (`NOT_STARTED` / `IN_PROGRESS` / `DONE` / `DELAYED`)
- **View split**: all project members can view tasks; only Project Manager/Scheduler/Superintendent or the assigned Trade member can edit them
- **Gantt view**: CSS-based timeline colored by status, with critical-path highlighting
- **Dashboard**: total tasks, % complete, open roadblock count
- **Archiving**: projects are soft-deleted (archived), not hard-deleted

### Planning loop (Phase 1)
- **Task dependencies + Critical Path Method**: link predecessor/successor tasks (with cycle detection); the Gantt view highlights the critical path
- **Lookahead**: rolling 2/4/6-week filtered view of upcoming work
- **Weekly Work Plan**: commit tasks to a week, track completion, auto-calculated Percent Plan Complete (PPC)
- **Roadblocks**: typed (change order, inspection, labor, material, weather, other) with an owner and due date; any member can flag, Project Manager/Superintendent/assigned Trade can resolve; dedicated Roadblock Log page
- **Field Tracking**: post progress notes + photos against any task (mobile-friendly web, no native app)
- **Analytics**: project dashboard adds a PPC trend chart (week over week), Promise Reliability Rate (PRR) per trade/member, and an S-Curve chart comparing planned vs. actual cumulative task completion

### Planning depth & document tracking (Phase 2)
- **Pull Planning**: a sequencing board for the upcoming weeks — any Trade partner can add their own task (self-assigned), and a Project Manager/Scheduler/Superintendent sequences the order of work
- **Schedule Impact Requests (SIR)**: any member can submit a field-condition change request; a Project Manager or Superintendent reviews/approves it (approval can push out the linked task's end date)
- **Submittals**: native tracking log (title, spec section, status, due date), optionally linked to a task, with overdue surfaced on the task detail page
- **RFIs**: native Q&A log linked to a task; an open RFI past its due date automatically flags the linked task as a roadblock, the same way a manual flag does
- **Drawings**: upload PDFs/images per project (optionally linked to a task); re-uploading the same title creates a new revision and marks the prior one superseded
- **Baselines**: snapshot every task's dates/status at a point in time, then compare against the current schedule to see day-by-day variance
- **Activity Log**: an append-only audit trail of schedule-relevant changes (status changes, roadblocks, dependencies, commitments, SIR reviews, submittal/RFI decisions, drawing uploads, archiving) — who, when, what changed

## Tech Stack

- [Next.js](https://nextjs.org/) 16 (App Router, Server Actions)
- TypeScript
- Tailwind CSS v4 — design tokens sourced from `DESIGN.md` (Cal.com-inspired)
- [Prisma](https://www.prisma.io/) 6 ORM + PostgreSQL ([Neon](https://neon.tech/))
- [Better Auth](https://www.better-auth.com/) (email/password, Google OAuth, organization plugin)
- [Zod](https://zod.dev/) for input validation on every Server Action

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy `.env.example` to `.env` and fill in real values:

```bash
cp .env.example .env
```

- `DATABASE_URL` — a [Neon](https://neon.tech/) PostgreSQL connection string. Use the **pooled** connection string if available, and keep `?sslmode=require`.
- `BETTER_AUTH_SECRET` — any random 32-byte string (e.g. `openssl rand -base64 32`).
- `BETTER_AUTH_URL` — `http://localhost:3000` for local dev.
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — create OAuth credentials at the [Google Cloud Console](https://console.cloud.google.com/apis/credentials). Redirect URI for local dev: `http://localhost:3000/api/auth/callback/google`.

### 3. Run database migrations

```bash
npx prisma migrate dev --name init
```

### 4. (Optional) Seed demo data

```bash
npm run db:seed
```

This creates a demo organization ("Acme Construction Co."), a project ("Riverside Apartments — Phase 1"), and five accounts you can sign in with (password: `password123`):

- `jane@buildflow.dev` — Project Manager
- `mike@buildflow.dev` — Scheduler
- `sam@buildflow.dev` — Superintendent
- `tom@buildflow.dev` — Trade (electrical)
- `sara@buildflow.dev` — Trade (plumbing)

### 5. Run the dev server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000).

## Project Structure

```
prisma/schema.prisma        Database schema (Better Auth + app models)
prisma/seed.ts               Demo data seed script
src/proxy.ts                 Route protection (redirects unauthenticated users)
src/app/                     Next.js App Router pages
src/app/actions/             Server Actions (Zod-validated, role-enforced mutations)
src/components/              React components
src/lib/                     Prisma client, Better Auth config, permissions, env validation
DESIGN.md                    Design tokens/reference used for all UI styling
```

## Design System

All UI styling follows [`DESIGN.md`](./DESIGN.md) — a Cal.com-inspired visual language (clean neutral palette, Inter typography, soft-rounded cards). Its tokens are wired into `src/app/globals.css` via Tailwind v4's CSS-first `@theme` configuration.
