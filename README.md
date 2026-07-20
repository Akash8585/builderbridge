# BuilderBridge

> **BuilderBridge gives construction teams one AI-assisted control room for schedules, field commitments, project documents, and risk, so the office plan and jobsite reality stay aligned.**

**Live Demo:** [https://builderbridge.vercel.app/](https://builderbridge.vercel.app/)

**Demo Video:** [ADD LINK]

[![CI](https://github.com/Akash8585/builderbridge/actions/workflows/ci.yml/badge.svg)](https://github.com/Akash8585/builderbridge/actions/workflows/ci.yml)
![Next.js 16](https://img.shields.io/badge/Next.js-16-111111?logo=nextdotjs)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)

## Screenshots

### Critical-path Gantt

![Gantt view](./docs/screenshot-gantt.png)

Dependencies, schedule dates, progress, and critical-path work in one operational view.

### Weekly Work Plan

![Weekly Work Plan and project dashboard](./docs/screenshot-weekly-plan.png)

Turn lookahead work into weekly commitments, track completion, and understand PPC variance.

### Project-aware Agent

![BuilderBridge Agent chat panel](./docs/screenshot-agent.png)

Ask questions against live project data and documents, then review proposed changes before anything is written.

## Built By

- **Solo builder:** Akash Kumar Prasad
- **Hackathon:** OpenAI Build Week
- **Recommended category:** Work and Productivity

BuilderBridge was built and meaningfully extended with Codex and GPT-5.6 during the submission period.

## Features

### Foundation

- Email/password and Google sign-in, organizations, invites, and project archiving.
- Project-level roles for managers, schedulers, superintendents, and trades.
- Task ownership, dates, status, actual progress, notes, and field updates.
- Responsive dashboards and an installable PWA.

### Phase 1 - Planning Loop

- Dependencies, cycle detection, Critical Path Method, and critical-path Gantt highlighting.
- Rolling 2, 4, and 6 week lookaheads with collaborative pull planning.
- Weekly commitments, PPC, completion tracking, and protected history.
- Owned, dated, role-aware roadblock resolution.

### Phase 2 - Project Controls and Documents

- Schedule impacts, RFIs, submittals, drawings, and baselines.
- Automatic task blocking from overdue linked RFIs.
- Drawing revision and superseded-file history.
- Private files, PDF preview, exact-page citations, highlighting, and OCR.

### Phase 3 - Portfolio Intelligence

- Executive dashboard and shared portfolio timeline.
- PPC, PRR, S-curves, baseline variance, and project health.
- Cross-project trade performance and project activity history.
- Guided first-project onboarding and useful empty states.

### Phase 4 - BuilderBridge Agent

- Persistent project and portfolio conversations grounded in live data.
- Project, schedule, risk, RFI, submittal, document, and portfolio tools.
- Reviewable proposals for planning and project-control changes.
- Explicit confirmation, permission checks, stale-data protection, and atomic writes.
- OpenRouter routing with ordered fallbacks, bounded retries, and usage limits.

> **Runtime provider note:** The shipped Agent currently calls OpenRouter through its OpenAI-compatible API using `OPENROUTER_API_KEY`. `OPENROUTER_MODEL` may target an OpenAI-hosted model available through OpenRouter, such as `openai/gpt-4o-mini`, but this is not the same as calling `api.openai.com` directly.

## How It Works / Inspiration

BuilderBridge is inspired by [Outbuild](https://www.outbuild.com/)'s connected approach to construction planning. It addresses a real coordination gap: master schedules, weekly promises, field updates, RFIs, submittals, and risk decisions often live in separate systems. BuilderBridge brings them into one operating loop and places a permission-aware Agent inside it, where every proposed write remains under human control.

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
