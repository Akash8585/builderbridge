# BuilderBridge

**BuilderBridge turns construction schedules, weekly commitments, field progress, and project documents into one agent-controlled operating loop where every AI write is cited, reviewable, permission-checked, and auditable.**

Built for project managers, schedulers, superintendents, and trade partners who need the office plan and the jobsite to stay aligned — without letting an AI silently change project records.

[![CI](https://github.com/Akash8585/builderbridge/actions/workflows/ci.yml/badge.svg)](https://github.com/Akash8585/builderbridge/actions/workflows/ci.yml)
![Next.js 16](https://img.shields.io/badge/Next.js-16-111111?logo=nextdotjs)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)

<p align="center">
  <img
    src="./docs/builderbridge-hero.png"
    alt="BuilderBridge turns construction project risks into cited and reviewable actions"
    width="100%"
  />
</p>

<p align="center">
  <a href="https://builderbridge.vercel.app/"><strong>Live Demo</strong></a>
  ·
  <a href="ADD_PUBLIC_YOUTUBE_LINK"><strong>Demo Video</strong></a>
  ·
  <a href="#judge-it-in-five-minutes"><strong>Judge Walkthrough</strong></a>
</p>

> **Quick context:** BuilderBridge is a construction operations platform where an AI agent reads live schedules and project documents, cites its evidence, prepares operational changes, and executes them only after human approval.

**Demo Video:** [ADD PUBLIC YOUTUBE LINK]

## Judge it in five minutes

Use the live demo first. For the full seeded Harborview Residences walkthrough (including the Project Manager account), run the app locally after `npm run db:seed`, or sign in on the live deployment if that account already exists there.

**Seeded demo account** (from [`prisma/seed.ts`](./prisma/seed.ts)):

| Role | Email | Password |
| --- | --- | --- |
| Project Manager | `alex@harborview.demo` | `HarborDemo1!` |

1. Open the [live demo](https://builderbridge.vercel.app/) (or `http://localhost:3000` after local setup).
2. Sign in with the Project Manager account above, or create an account / use Google sign-in if that user is not present on the deployment.
3. Open **Harborview Residences — Building A** (seeded), or create a project and add a few tasks if you are on a fresh account.
4. Review the **Gantt** (critical path, dependencies, progress) and **Weekly Plan** (commitments and completion).
5. Open the **BuilderBridge Agent** from the app chrome.
6. Ask: *What is threatening this project's completion date?* The agent reads live schedule risks, roadblocks, and open items.
7. Ask it to prepare a change, for example:
   - *Create an RFI about the electrical panel inspection clearance.*
   - *Add a weekly commitment for Rough electrical wiring.*
   - *Flag Rough plumbing install as a roadblock waiting on the city permit.*
   - *Slip Electrical panel inspection by two days and show the schedule impact.*
8. Review the proposal card: proposed changes, sources, warnings, and expected impacts. Nothing is written yet.
9. Confirm the proposal. The server rechecks permissions and stale snapshots, then applies the write in a transaction.
10. Open the updated RFI / weekly plan / task record and the project **Activity** log for the confirmed action.

If the Agent panel says it is not configured, the deployment is missing `OPENROUTER_API_KEY`. Core scheduling still works; Agent demos need that key.

## The problem

Construction schedules, weekly promises, field updates, RFIs, submittals, drawings, and risk decisions usually live in separate tools. When something slips, the office plan and the jobsite diverge — and teams lose a single place to ask what changed, why it matters, and what should happen next with an auditable answer.

## The solution

BuilderBridge is an AI-assisted construction control room for the people running the job. It connects:

- Project schedules and task dependencies
- Critical-path planning and lookaheads
- Weekly commitments and field progress
- RFIs, submittals, drawings, and project documents
- Schedule risks and portfolio analytics

The Agent works inside that live system. It answers from current project data, searches uploaded documents with exact-page citations, and prepares operational changes — then stops until a human reviews and confirms.

## Core product workflow

```text
Master schedule + critical path
  -> lookahead / pull planning
  -> weekly commitments (PPC)
  -> field progress, roadblocks, RFIs, submittals
  -> schedule impacts + baselines
  -> portfolio health
  -> Agent Q&A and reviewable actions with activity history
```

## Main features

| Area | What ships today |
| --- | --- |
| Auth and orgs | Email/password + Google sign-in, organizations, invites, project roles (manager, scheduler, superintendent, trade), project archiving |
| Planning | Dependencies with cycle detection, CPM, critical-path Gantt, 2/4/6-week lookaheads, pull planning, weekly commitments, PPC, owned roadblocks |
| Project controls | Schedule impact requests, RFIs (including overdue linked-task blocking), submittals, drawings with revision/supersede history, baselines |
| Documents | Private uploads, project file workspace, PDF text extraction, optional OCR for scans, in-app PDF viewer, page-aware search and citations |
| Portfolio | Executive dashboard, shared timeline, PPC/PRR/S-curves, baseline variance, trade performance, activity history |
| Agent | Persistent project/portfolio chats, read tools, reviewable write proposals, confirmation, permissions, stale-data checks, atomic writes, usage limits |
| Platform | Responsive UI, installable PWA, optional Stripe / Resend / Procore sandbox / Autodesk APS hooks, Sentry + structured logs |

## BuilderBridge Agent

The Agent is implemented with the Vercel AI SDK and project-scoped tools in [`src/lib/assistant-tools.ts`](./src/lib/assistant-tools.ts) and [`src/lib/assistant-actions.ts`](./src/lib/assistant-actions.ts).

**Read tools include:** project overview, schedule risks, open items, portfolio health, task search, member lookup, and page-aware document search.

**Proposal tools include (prepare only — no write until confirm):** roadblocks, RFIs, submittals, task create/update, field progress, weekly commitments, schedule changes, schedule impact requests, and baselines.

**Runtime provider:** the Agent calls **OpenRouter** through its OpenAI-compatible API (`https://openrouter.ai/api/v1`) using `OPENROUTER_API_KEY`. This deployment uses **OpenRouter free models** — default `OPENROUTER_MODEL=openrouter/free`, with `openrouter/free` as the fallback and bounded pre-stream retries. That is not the same as calling `api.openai.com` directly.

## Safe AI action workflow

```text
User request
  -> project-scoped data and document search
  -> agent-generated proposal
  -> changes, sources, warnings, and impacts shown
  -> explicit user confirmation
  -> permission and stale-data recheck
  -> atomic database transaction
  -> activity log and linked result
```

The Agent does **not** silently modify project data.

| Guard | Behavior in code |
| --- | --- |
| Permission checks | Confirm path re-runs the same role/capability checks used by manual server actions |
| Proposal expiry | Pending proposals expire after 30 minutes |
| One-time confirmation | Status moves `PENDING` → `CONFIRMED` with a claim update; repeats are rejected or no-ops |
| Stale-data protection | Snapshot comparison rejects confirm when the underlying record or cited file changed |
| Transactional writes | Confirms run inside Prisma transactions (including serializable isolation where required) |
| Isolation | Conversations and proposals are scoped to organization + creating user; tools resolve the active project |
| Audit logging | Confirmed Agent actions and project mutations write to the activity log |
| Document citations | Proposals can carry file name, page number, and excerpt; PDF viewer can jump to cited pages |

## What makes BuilderBridge different

Most construction tools stop at dashboards, or at chat over static exports. BuilderBridge keeps planning and project controls in one product, then adds a **review-before-write** Agent path:

- Reads **live project data**, not a pasted schedule dump
- Returns **exact-page document citations** when evidence comes from files
- Creates a **reviewable proposal** with changes, sources, warnings, and impacts
- Requires **explicit human confirmation** before any write
- Re-checks **permissions** and **stale snapshots** at confirm time
- Applies the change in an **atomic transaction**
- Records the result in the **activity log**

The Agent does not silently modify project data.

## Built during OpenAI Build Week

- **Hackathon:** [OpenAI Build Week](https://openai.devpost.com/) (submission window Jul 13–21, 2026)
- **Track focus:** Work and Productivity
- **Solo builder:** Akash Kumar Prasad
- **Codex Session ID:** [ADD SESSION ID BEFORE SUBMISSION]

During Build Week the product was extended into a Codex-style agent with document intelligence, reviewable writes, PDF viewing, permission/activity hardening, onboarding, responsive polish, and production monitoring — running Agent inference on OpenRouter free models.

## How Codex and GPT-5.6 were used

BuilderBridge was developed with **Codex** and **GPT-5.6** during OpenAI Build Week. The notes below map to concrete repository work; fill in the Codex Session ID above before Devpost submission.

| Kind of work | What happened |
| --- | --- |
| **AI helped generate** | Agent tool surface and proposal/confirm handlers; page-chunk document extraction and search; PDF viewer wiring; permission and activity-log hardening; TypeScript/build fixes for Vercel + Prisma; responsive Agent/nav layouts; Sentry and structured logging |
| **AI reviewed** | Permission rechecks on confirm; stale snapshot rejection paths; proposal expiry and one-time claim updates; OpenRouter free-model fallback/retry behavior; file access through authenticated routes |
| **Builder manually tested** | Seeded Harborview walkthrough (Gantt, weekly plan, Agent Q&A, propose → confirm → activity); local OCR worker path; production deploy on Vercel/Neon/Supabase; role differences (PM vs trade) |
| **Human product decisions** | Proposal-first writes (never silent mutation); OpenRouter free models as the runtime LLM path; private storage by default; hackathon priority order in [`ROADMAP.md`](./ROADMAP.md); which controls the Agent may propose |

Examples from Build Week work: exploring the Phase 1–3 codebase before extending the Agent; designing tools in `assistant-tools.ts`; implementing proposal confirmation and stale-data protection in `assistant-actions.ts`; improving document extraction/citations; hardening deployment and observability.

## Screenshots

Only screenshots present under [`docs/`](./docs/) are listed below.

### Critical-path Gantt

![Gantt view](./docs/screenshot-gantt.png)

Dependencies, dates, progress, and critical-path highlighting in one operational schedule view.

### Weekly Work Plan

![Weekly Work Plan and project dashboard](./docs/screenshot-weekly-plan.png)

Lookahead work becomes weekly commitments with completion tracking and PPC-oriented project context.

### Project-aware Agent

![BuilderBridge Agent chat panel](./docs/screenshot-agent.png)

Ask questions against live project data and documents, then review a proposal card before any write is applied.

## Technical architecture

```text
Browser (Next.js App Router UI + Agent panel + PDF.js viewer)
  -> Better Auth session
  -> Server Actions / Route Handlers
  -> Prisma (Neon PostgreSQL)
  -> Private object storage (S3-compatible / Supabase) via /api/files
  -> OpenRouter free models (OpenAI-compatible) for Agent streaming
  -> Optional OCRmyPDF worker (Docker / Cloud Run)
  -> Optional Sentry + structured JSON logs
```

| Path | Role |
| --- | --- |
| `src/app/` | Pages, API routes, Server Actions |
| `src/components/` | Product UI, Agent workspace, PDF viewer |
| `src/lib/assistant-tools.ts` | Project-scoped Agent tools |
| `src/lib/assistant-actions.ts` | Proposals, confirmation, stale checks, audit |
| `src/lib/permissions.ts` | Project capability and role enforcement |
| `src/lib/document-extraction.ts` | PDF extraction, page chunks, OCR pipeline |
| `src/lib/openrouter.ts` | OpenRouter OpenAI-compatible client |
| `src/lib/observability.ts` | Structured logs, request IDs, Sentry capture |
| `prisma/schema.prisma` | Auth, planning, Agent, and audit models |
| `prisma/seed.ts` | Local demonstration data |
| `ocr-worker/` | Private OCRmyPDF service |

## Tech stack

| Area | Technology |
| --- | --- |
| Web | Next.js 16, React 19, TypeScript, Tailwind CSS 4 |
| Agent | Vercel AI SDK (`ai`, `@ai-sdk/react`, `@ai-sdk/openai-compatible`), Streamdown |
| Runtime LLM | OpenRouter free models (`openrouter/free`) via OpenAI-compatible API |
| Data | Prisma 6, PostgreSQL (Neon in production) |
| Auth | Better Auth (email/password, Google OAuth, organizations) |
| Files | Private S3-compatible storage (Supabase Storage), PDF.js, unpdf, optional OCRmyPDF |
| Integrations (optional) | Stripe, Resend, Procore sandbox OAuth, Autodesk APS/ACC OAuth |
| Ops | Vercel, Google Cloud Run (OCR), Sentry, structured request logs |

## Local setup

### Prerequisites

- Node.js 20+
- PostgreSQL (Neon recommended)
- Optional Docker for scanned-PDF / image OCR

### 1. Install

```bash
git clone https://github.com/Akash8585/builderbridge.git
cd builderbridge
npm install
```

### 2. Environment

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

macOS/Linux:

```bash
cp .env.example .env
```

Minimum required values (see [Environment variables](#environment-variables)):

```dotenv
DATABASE_URL="postgresql://..."
BETTER_AUTH_SECRET="replace-with-at-least-32-random-bytes"
BETTER_AUTH_URL="http://localhost:3000"
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
```

Add `OPENROUTER_API_KEY` to exercise the Agent locally.

### 3. Database

```bash
npx prisma migrate deploy
npm run db:seed
```

Seed creates **Harborview Construction LLC**, **Harborview Residences — Building A** (plus a garage portfolio project), public construction PDFs under `prisma/seed-assets/`, and the demo users listed in the judge walkthrough.

### 4. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). If port 3000 is busy, Next.js prints the alternate port.

### Optional OCR worker

Set the same long random `OCR_SERVICE_TOKEN` in the app and worker, then:

```bash
docker compose -f docker-compose.ocr.yml up --build
```

Searchable PDFs do not need OCR. The worker runs for scans/images without extractable text.

## Environment variables

Full placeholders live in [`.env.example`](./.env.example). Summary:

| Capability | Variables | Notes |
| --- | --- | --- |
| Core | `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` | Required. Prefer a pooled Neon URL with `sslmode=require`. |
| Google sign-in | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Required by the env schema. Local callback: `/api/auth/callback/google`. |
| Agent | `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` | Optional. Defaults to free model `openrouter/free`. |
| Agent resilience | `OPENROUTER_FALLBACK_MODELS`, `OPENROUTER_MAX_RETRIES` | Defaults to `openrouter/free` fallbacks; retries 0–5. |
| Agent limits | `AI_CHAT_RATE_LIMIT_PER_MINUTE`, `AI_MONTHLY_LIMIT_FREE`, `AI_MONTHLY_LIMIT_CORE`, `AI_MONTHLY_LIMIT_PRO` | Per-user burst and per-org monthly model limits. |
| Private files | `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET`, `S3_REGION` | Optional locally; required in production. |
| Legacy files | `S3_PUBLIC_URL` | Optional compatibility for older public-bucket URLs. |
| OCR | `OCR_SERVICE_URL`, `OCR_SERVICE_TOKEN`, `OCR_SERVICE_TIMEOUT_MS` | Optional; timeout defaults to 120s. |
| Sentry | `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` | Optional error monitoring / source maps. |
| Stripe | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_CORE`, `STRIPE_PRICE_PRO` | Optional; unset keeps orgs on Free. |
| Procore | `PROCORE_CLIENT_ID`, `PROCORE_CLIENT_SECRET`, `PROCORE_REDIRECT_URI`, `PROCORE_ENV` | Optional; defaults to sandbox. |
| Autodesk | `AUTODESK_CLIENT_ID`, `AUTODESK_CLIENT_SECRET`, `AUTODESK_REDIRECT_URI` | Optional APS/ACC OAuth. |
| Email | `RESEND_API_KEY`, `EMAIL_FROM` | Optional; delivery skipped when unset. |

## Deployment

Production shape:

- **Vercel** — Next.js app
- **Neon PostgreSQL** — relational data
- **Private Supabase Storage** — documents and photos
- **Google Cloud Run** — optional OCR worker
- **Sentry** + structured Vercel/Cloud Run logs — diagnostics

```bash
npx prisma migrate deploy
```

Do **not** run `npm run db:seed` against a customer production database. See [`DEPLOYMENT.md`](./DEPLOYMENT.md) for storage, OAuth callbacks, monitoring, security headers, and the post-deploy checklist.

## Security and permissions

- Session auth via Better Auth; app routes require a signed-in user and org/project membership where applicable.
- Project roles gate schedule edits, commitments, roadblocks, and controls; Agent confirm rechecks the same capabilities.
- Uploaded objects are private; browsers load files through authenticated `/api/files/...` streams.
- Agent proposals are user-owned, expire, and are confirmed at most once after snapshot checks.
- Optional file-access auditing and project activity history record sensitive reads/writes.
- S3 keys, OpenRouter keys, Stripe secrets, and OCR tokens stay server-side (never `NEXT_PUBLIC_` for secrets).

## Builder information

- **Name:** Akash Kumar Prasad
- **GitHub:** [Akash8585/builderbridge](https://github.com/Akash8585/builderbridge)
- **Hackathon:** OpenAI Build Week (Devpost)
- **Recommended category:** Work and Productivity

## License

MIT
