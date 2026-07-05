# BuildFlow — Construction Scheduling & Collaboration (MVP)

A simplified, Outbuild-style scheduling & collaboration tool for construction projects. Built with Next.js (App Router), TypeScript, Tailwind CSS, Prisma + PostgreSQL (Neon), Better Auth, and Zod.

## Features

- **Auth**: email/password + Google OAuth sign-in (Better Auth)
- **Organizations**: sign up, create/join an org; projects belong to an org
- **Per-project roles**: a user can be `GC_OWNER` on one project and `TRADE` on another
- **Link-based invites**: generate a shareable `/invite/[token]` link with a preset role — no email sending in v1
- **Tasks**: name, assigned trade/person, start/end dates, status (`NOT_STARTED` / `IN_PROGRESS` / `DONE` / `DELAYED`)
- **View split**: all project members can view tasks; only the `GC_OWNER` or assigned `TRADE` member can edit them
- **Roadblocks**: any member can flag a task as blocked with a note; `GC_OWNER` or the assigned trade can resolve it
- **Gantt view**: simple CSS-based timeline colored by status
- **Dashboard**: total tasks, % complete, open roadblock count
- **Archiving**: projects are soft-deleted (archived), not hard-deleted

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

This creates a demo organization ("Acme Construction Co."), a project ("Riverside Apartments — Phase 1"), and three accounts you can sign in with (password: `password123`):

- `jane@buildflow.dev` — GC/Owner
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
