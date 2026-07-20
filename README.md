# BuilderBridge

**An AI-assisted construction control room for project managers, schedulers, superintendents, and trade partners who need the office schedule and field plan to stay aligned.**

**Live Demo:** [https://builderbridge.vercel.app/](https://builderbridge.vercel.app/)

**Demo Video:** [ADD LINK]

[![CI](https://github.com/Akash8585/builderbridge/actions/workflows/ci.yml/badge.svg)](https://github.com/Akash8585/builderbridge/actions/workflows/ci.yml)
![Next.js 16](https://img.shields.io/badge/Next.js-16-111111?logo=nextdotjs)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)

## Screenshots

![Gantt view](./docs/screenshot-gantt.png)

![Weekly Work Plan and project dashboard](./docs/screenshot-weekly-plan.png)

![BuilderBridge Agent chat panel](./docs/screenshot-agent.png)

## Built By

**Team:** [ADD NAME OR TEAM]

Built for OpenAI Build Week. Recommended DevPost category: **Work and Productivity**.

## Features

### Foundation

- Email/password and Google sign-in, organizations, project invites, and soft archiving.
- Per-project roles for Project Managers, Schedulers, Superintendents, and Trades.
- Task ownership, dates, status, actual progress, notes, and mobile field updates.
- Responsive dashboard and installable PWA experience.

### Phase 1 - Planning Loop

- Dependencies with cycle detection, Critical Path Method, and critical-path Gantt highlighting.
- Rolling 2, 4, and 6 week lookaheads plus collaborative pull planning.
- Weekly commitments with PPC, completion tracking, and protected historical records.
- Roadblocks with type, owner, due date, status, and role-aware resolution.

### Phase 2 - Project Controls and Documents

- Schedule Impact Requests, RFIs, submittals, drawings, and schedule baselines.
- Overdue RFIs can automatically flag linked tasks as blocked.
- Drawing revisions preserve and supersede earlier versions.
- Private project files, PDF preview, exact-page citations, passage highlighting, and OCR for scans.

### Phase 3 - Portfolio Intelligence

- Organization-wide executive dashboard and shared project timeline.
- PPC trends, PRR by trade, S-curves, baseline variance, and composite project health.
- Cross-project trade performance and project-level activity history.
- First-project onboarding and useful empty states.

### Phase 4 - BuilderBridge Agent

- Persistent project and portfolio conversations grounded in live BuilderBridge data.
- Reads tasks, members, schedule risk, roadblocks, RFIs, submittals, impacts, documents, and portfolio health.
- Prepares reviewable proposals for task, progress, commitment, roadblock, schedule, baseline, RFI, and submittal changes.
- Requires explicit confirmation, rechecks permissions and stale data, applies changes atomically, and records the result.
- Uses the Vercel AI SDK with OpenRouter model routing, ordered fallback, bounded retries, and usage limits.

> **Runtime provider note:** The shipped Agent currently calls OpenRouter through its OpenAI-compatible API using `OPENROUTER_API_KEY`. `OPENROUTER_MODEL` may target an OpenAI-hosted model available through OpenRouter, such as `openai/gpt-4o-mini`, but this is not the same as calling `api.openai.com` directly.

## How It Works / Inspiration

BuilderBridge is inspired by Outbuild-style construction planning: one connected operating loop for the master schedule, field coordination, weekly commitments, and project controls. It addresses a common gap where schedule changes, site updates, RFIs, submittals, and risk decisions are scattered across separate tools and conversations. The Agent sits inside that loop, using project-scoped tools and human-confirmed proposals instead of acting as an unaccountable chatbot.

OpenAI Build Week eligibility is based on how the project was built: BuilderBridge was meaningfully extended with Codex during the submission period, with session history and dated commits as evidence. The current application runtime remains OpenRouter-based; the [official rules](https://openai.devpost.com/rules) allow any runtime tooling while requiring the project itself to be built with Codex and/or GPT-5.6.

### Agent write path

```text
User request
  -> project-scoped read/tool call
  -> proposal card with changes and warnings
  -> explicit user confirmation
  -> permission and stale-data recheck
  -> atomic transaction
  -> activity log and linked result
```

The Agent never silently changes project data. Proposals can expire, be cancelled, be rejected when source data changes, and be safely confirmed only once.

## Tech Stack

| Area | Technology |
| --- | --- |
| Web application | Next.js 16, React 19, TypeScript, Tailwind CSS 4 |
| Agent | Vercel AI SDK, OpenRouter OpenAI-compatible provider, Streamdown |
| Data | Prisma 6, PostgreSQL, Neon |
| Authentication | Better Auth with Google OAuth and organizations |
| Files and documents | Private Supabase S3 storage, PDF.js, unpdf, OCRmyPDF |
| Integrations | Stripe, Resend, Procore sandbox, Autodesk APS/ACC |
| Operations | Vercel, Google Cloud Run, Sentry, structured request logs |
| Testing | Vitest, Playwright, GitHub Actions |

## Getting Started

### Prerequisites

- Node.js 20 or newer.
- A PostgreSQL database; Neon is recommended.
- Optional Docker installation for scanned-PDF and image OCR.

### 1. Install

```bash
git clone https://github.com/Akash8585/builderbridge.git
cd builderbridge
npm install
```

### 2. Configure the environment

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

macOS/Linux:

```bash
cp .env.example .env
```

Minimum configuration:

```dotenv
DATABASE_URL="postgresql://..."
BETTER_AUTH_SECRET="replace-with-at-least-32-random-bytes"
BETTER_AUTH_URL="http://localhost:3000"
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
```

### Environment reference

| Capability | Variables | Notes |
| --- | --- | --- |
| Core | `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` | Required. Use a pooled Neon URL with `sslmode=require`. |
| Google sign-in | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Required by the current environment schema. Local callback: `/api/auth/callback/google`. |
| Agent | `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` | Optional. Model defaults to `openrouter/free`; an OpenAI model routed by OpenRouter can use a model ID such as `openai/gpt-4o-mini`. |
| Agent resilience | `OPENROUTER_FALLBACK_MODELS`, `OPENROUTER_MAX_RETRIES` | Ordered comma-separated fallbacks and 0-5 pre-stream retries. |
| Agent limits | `AI_CHAT_RATE_LIMIT_PER_MINUTE`, `AI_MONTHLY_LIMIT_FREE`, `AI_MONTHLY_LIMIT_CORE`, `AI_MONTHLY_LIMIT_PRO` | Per-user burst and per-organization monthly model limits. |
| Private files | `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET`, `S3_REGION` | Optional locally, required in production. Supports Supabase Storage and other S3-compatible services. |
| Legacy files | `S3_PUBLIC_URL` | Optional compatibility value for older public-bucket records; new files use authenticated routes. |
| OCR | `OCR_SERVICE_URL`, `OCR_SERVICE_TOKEN`, `OCR_SERVICE_TIMEOUT_MS` | Optional private OCRmyPDF worker; timeout defaults to 120 seconds. |
| Sentry | `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` | Optional error-only monitoring and production source maps. |
| Stripe | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_CORE`, `STRIPE_PRICE_PRO` | Optional billing. Leave unset to keep organizations on the Free tier. |
| Procore | `PROCORE_CLIENT_ID`, `PROCORE_CLIENT_SECRET`, `PROCORE_REDIRECT_URI`, `PROCORE_ENV` | Optional sandbox/production OAuth configuration; defaults to sandbox. |
| Autodesk | `AUTODESK_CLIENT_ID`, `AUTODESK_CLIENT_SECRET`, `AUTODESK_REDIRECT_URI` | Optional Autodesk APS/ACC integration. |
| Email | `RESEND_API_KEY`, `EMAIL_FROM` | Optional Resend notifications; delivery is skipped when unset. |
| Integration tests | `TEST_DATABASE_URL` | Set in CI or the shell before running real-database tests. Use an isolated non-production database. |

See [.env.example](./.env.example) for copy-ready placeholders and comments.

### 3. Prepare the database

```bash
npx prisma migrate deploy
npm run db:seed
```

The seed creates Acme Construction Co., the Riverside Apartments project, and local role-specific demo users. It prints the local-only credentials after completion.

### 4. Start the application

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). If port 3000 is occupied, Next.js prints the alternate port.

### Optional OCR worker

Set the same long random `OCR_SERVICE_TOKEN` for the app and worker, then run:

```bash
docker compose -f docker-compose.ocr.yml up --build
```

Ordinary searchable PDFs do not use OCR. The worker runs only for scans or images without extractable text.

## Testing

```bash
npm run lint
npx tsc --noEmit
npx vitest run tests/unit
npx vitest run tests/integration --maxWorkers=1
npm run test:e2e
npm run build
```

BuilderBridge defines 141 unit tests, 94 real PostgreSQL/Supabase integration tests, and 28 Playwright browser flows. Integration tests create isolated organizations and clean them up; use a dedicated test database, never production.

GitHub Actions runs lint, type checking, unit tests, and a production build on pushes and pull requests. Integration tests run when `TEST_DATABASE_URL` is configured. Playwright is available through the manual workflow because it requires a migrated, seeded test database.

## Project Structure

```text
src/app/                       Pages, API routes, and Server Actions
src/components/                Product UI, Agent workspace, and PDF viewer
src/lib/assistant-tools.ts     Project-scoped Agent tools
src/lib/assistant-actions.ts   Proposals, confirmation, stale checks, and audit
src/lib/permissions.ts         Project capability and role enforcement
src/lib/document-extraction.ts PDF extraction, page chunks, and OCR pipeline
src/lib/observability.ts       Structured logs, request IDs, and Sentry capture
prisma/schema.prisma           Auth, project, planning, Agent, and audit models
prisma/seed.ts                 Local demonstration data
ocr-worker/                    Private OCRmyPDF Cloud Run service
tests/unit/                    Pure business-logic tests
tests/integration/             Real database and storage tests
tests/e2e/                     Playwright user journeys
```

## Design System

BuilderBridge uses a restrained operational interface: white and near-black surfaces, Inter typography, compact controls, clear status colors, and layouts designed for repeated scanning rather than marketing decoration. Tailwind CSS 4 tokens live in `src/app/globals.css`; the Agent adds a reversible light/dark glass treatment while preserving the same interaction structure. The application includes responsive layouts, keyboard focus states, reduced-motion handling, and mobile navigation coverage.

## Deployment

Production uses:

- Vercel for the Next.js application.
- Neon PostgreSQL for relational data.
- A private Supabase Storage bucket for documents and photos.
- Google Cloud Run for the private OCR worker.
- Sentry and structured Vercel/Cloud Run logs for diagnostics.

Run production migrations separately:

```bash
npx prisma migrate deploy
```

Do not run `npm run db:seed` against production. See [DEPLOYMENT.md](./DEPLOYMENT.md) for storage setup, OAuth callbacks, monitoring, security headers, and the post-deploy checklist.

---

**License:** MIT
