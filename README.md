# BuilderBridge — Construction Scheduling & Collaboration (MVP)

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

### Portfolio / executive layer (Phase 3)
- **Executive Dashboard** (`/dashboard`): cross-project view for the whole organization — total tasks, open roadblocks, and average health score at a glance, plus a per-project table of % complete, PPC, PRR, schedule variance, roadblocks, and health score
- **Project Timeline** (`/timeline`): every active project's schedule shown together on one shared timeline, color-coded by health score, with a "today" marker
- **Composite health score**: a weighted blend of PPC (35%), PRR (30%), schedule variance vs. baseline (20%), and open roadblocks (15%) — components with no data yet (e.g. no commitments recorded) are excluded and the rest are renormalized rather than penalizing new projects
- **Trade/Partner performance** (`/trade-performance`): commitment reliability (PRR) per person, aggregated across every active project they're on — not just one project at a time

### Outbuild AI (Phase 4, scoped)
- **Schedule Q&A Assistant**: a chat-style panel per project — ask natural-language questions ("what's blocking the schedule?", "which trades are behind on commitments?") and get answers grounded in that project's own tasks, roadblocks, PPC, submittals, and RFIs. Powered by [OpenRouter](https://openrouter.ai/) (`OPENROUTER_API_KEY` + `OPENROUTER_MODEL` env vars); gracefully shows a "not configured" message if no key is set. Chat history is session-only (not persisted).

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
- `OPENROUTER_API_KEY` — optional. Get one at [openrouter.ai/keys](https://openrouter.ai/keys) to enable the Schedule Q&A Assistant. Leave blank to skip — the rest of the app works fine without it.
- `OPENROUTER_MODEL` — optional, defaults to `openrouter/free` (OpenRouter's auto-router — picks whichever free model is currently available, with automatic failover if one is rate-limited). Set to a specific model ID like `openai/gpt-oss-20b:free` if you'd rather pin one.
- `S3_ENDPOINT` / `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` / `S3_BUCKET` / `S3_REGION` — optional in development (uploads fall back to local disk), **required in production** for private Field Tracking photos, drawings, and AI documents. The recommended backend is a private Supabase Storage bucket; see [DEPLOYMENT.md](./DEPLOYMENT.md).
- `RESEND_API_KEY` / `EMAIL_FROM` — optional. Enables email notifications (task assignments, roadblock ownership, RFI answers, SIR decisions) via [Resend](https://resend.com). Unset = notifications are skipped; users can also opt out individually in Settings.
- `PROCORE_CLIENT_ID` / `PROCORE_CLIENT_SECRET` — optional. Enables the Procore integration on the **Pro** plan (RFI/Submittal sync). Get sandbox credentials at [developers.procore.com](https://developers.procore.com). Set the app's Redirect URI to `http://localhost:3000/api/integrations/procore/callback` for local dev.
- `AUTODESK_CLIENT_ID` / `AUTODESK_CLIENT_SECRET` — optional. Enables the Autodesk ACC integration on the **Pro** plan (PDF drawing sync). Create a free app at [aps.autodesk.com](https://aps.autodesk.com). Callback URL: `http://localhost:3000/api/integrations/autodesk/callback`.

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

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for the full production guide (Vercel + Neon + Cloudflare R2, env checklist, migrations, and security notes).

## Testing

```bash
npm test          # Vitest: unit + integration, run once
npm run test:watch # Vitest watch mode
npm run test:e2e   # Playwright browser tests (needs a seeded database)
```

The suite has three layers:

- **`tests/unit/`** (Vitest) — pure business logic with no I/O: permission rules, Critical Path Method + cycle detection, PPC/PRR/S-Curve math, portfolio health-score math.
- **`tests/integration/`** (Vitest) — real round trips against the database (tasks, dependencies, roadblocks, weekly commitments, Schedule Impact Requests, Submittals, RFIs incl. the overdue auto-flag behavior, Drawing revision handling, Baselines, Activity Log). Every test creates its own isolated organization/project/users with a random suffix and tears them down afterward — your demo seed data is never touched.
- **`tests/e2e/`** (Playwright) — real browser flows against the seeded demo data: sign-in (valid + rejected), public landing page, full task lifecycle (create → status change → roadblock flag/resolve → delete), Weekly Work Plan commit → complete → PPC, and role-gated Gantt (PM can drag, Trade is read-only). Tests create disposable `E2E ...`-prefixed records and clean up after themselves; a global-setup sweeper removes leftovers from aborted runs. Locally it reuses your running dev server.

CI (`.github/workflows/ci.yml`): lint + typecheck + unit tests + build run on every push/PR. Integration tests run when a `TEST_DATABASE_URL` repo secret is configured (use a dedicated test database, not production). E2E runs on manual dispatch with the same secret.

## Project Structure

```
prisma/schema.prisma        Database schema (Better Auth + app models)
prisma/seed.ts               Demo data seed script
tests/unit/                  Pure-logic unit tests (Vitest)
tests/integration/           Real-DB integration tests with isolated fixtures (Vitest)
src/proxy.ts                 Route protection (redirects unauthenticated users)
src/app/                     Next.js App Router pages
src/app/actions/             Server Actions (Zod-validated, role-enforced mutations)
src/components/              React components
src/lib/                     Prisma client, Better Auth config, permissions, env validation
DESIGN.md                    Design tokens/reference used for all UI styling
```

## Design System

All UI styling follows [`DESIGN.md`](./DESIGN.md) — a Cal.com-inspired visual language (clean neutral palette, Inter typography, soft-rounded cards). Its tokens are wired into `src/app/globals.css` via Tailwind v4's CSS-first `@theme` configuration.
