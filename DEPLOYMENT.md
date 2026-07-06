# Deploying BuilderBridge

This guide covers deploying to **Vercel** (recommended for Next.js) with **Neon** (PostgreSQL) and **Cloudflare R2** (file storage). Any Node-capable host and any S3-compatible storage work the same way.

## 1. Prerequisites

- A [Neon](https://neon.tech) project — **create it in the same region as your Vercel deployment** (e.g. both in `ap-southeast-1`/Singapore, or both in `us-east-1`). Cross-region app-to-database latency is the single biggest performance mistake to avoid.
- A [Cloudflare R2](https://developers.cloudflare.com/r2/) bucket (or AWS S3 / MinIO) for uploads. Local-disk uploads do **not** survive serverless deploys — S3-compatible storage is required in production.
- Google OAuth credentials (if using Google sign-in).
- Optionally an [OpenRouter](https://openrouter.ai/keys) key for the Schedule Assistant.

## 2. Environment variables

Set these in Vercel → Project → Settings → Environment Variables:

| Variable | Value |
|---|---|
| `DATABASE_URL` | Neon **pooled** connection string (hostname contains `-pooler`), keep `?sslmode=require` |
| `BETTER_AUTH_SECRET` | A fresh random 32-byte secret for production — `openssl rand -base64 32`. Do not reuse the dev secret. |
| `BETTER_AUTH_URL` | Your production URL, e.g. `https://app.example.com` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | From Google Cloud Console. Add the production redirect URI: `https://app.example.com/api/auth/callback/google` |
| `S3_ENDPOINT` | Supabase: `https://<project-ref>.supabase.co/storage/v1/s3` · R2: `https://<account-id>.r2.cloudflarestorage.com` |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | Supabase: S3 access keys from Storage settings · R2: API token with Object Read & Write |
| `S3_BUCKET` | Bucket name, e.g. `builderbridge-uploads` |
| `S3_REGION` | Supabase: the project's region (e.g. `ap-south-1`) · R2: `auto` (default) |
| `S3_PUBLIC_URL` | Supabase: `https://<project-ref>.supabase.co/storage/v1/object/public/<bucket>` · R2: public bucket domain, e.g. `https://pub-xxxx.r2.dev` |
| `OPENROUTER_API_KEY` | Optional — enables the Schedule Assistant |
| `OPENROUTER_MODEL` | Optional — defaults to `openrouter/free` |

All four `S3_*` connection vars must be set together; if any is missing the app falls back to local-disk uploads, which is wrong for production.

### Supabase Storage setup (free tier, no card required)

1. Create a project at [supabase.com](https://supabase.com) (pick a region near your users — e.g. Mumbai `ap-south-1` or Singapore `ap-southeast-1`).
2. **Storage → New bucket** — name it (e.g. `builderbridge-uploads`) and mark it **Public**.
3. **Project Settings → Storage** (S3 connection section) — note the **Endpoint** and **Region**, then create a new **S3 access key** pair.
4. Fill the env vars per the table above. Objects are stored with keys like `tasks/<taskId>/<timestamp>-<name>` and served as `<S3_PUBLIC_URL>/<key>`.

Free tier: 1 GB storage, 2 GB/month egress — fine for testing and light usage; upgrade or switch providers (same env vars) if you outgrow it.

### Cloudflare R2 setup notes (alternative — 10 GB free, needs a card on file)

1. Create the bucket, then enable public access for it (R2 → bucket → Settings → Public access), or attach a custom domain.
2. Create an API token scoped to that bucket with **Object Read & Write**.
3. `S3_PUBLIC_URL` is whatever domain serves the bucket publicly.

## 3. Database migrations

Migrations are **not** run automatically on deploy. Run them against the production database from your machine (or a CI step):

```bash
# Uses DATABASE_URL from the environment — point it at production first
npx prisma migrate deploy
```

Optional demo data: `npm run db:seed` (don't seed a real production database).

## 4. Deploy

```bash
npm i -g vercel
vercel          # first deploy, link the project
vercel --prod
```

Or connect the Git repository in the Vercel dashboard for deploy-on-push.

## 5. Post-deploy checklist

- [ ] Sign-up/sign-in works (email + Google) on the production domain
- [ ] `BETTER_AUTH_URL` exactly matches the deployed origin (scheme included) — OAuth breaks otherwise
- [ ] Upload a Field Tracking photo and a Drawing; confirm the URLs point at `S3_PUBLIC_URL`, not `/uploads/...`
- [ ] `npx prisma migrate status` against production reports "up to date"
- [ ] Security headers present: `curl -sI https://app.example.com | grep -iE "strict-transport|x-frame|nosniff"`

## 6. Security notes

- **Rate limiting**: enabled on all `/api/auth/*` routes (60 req/min/IP, stricter built-in rules on sensitive endpoints). Storage is in-memory — fine for one instance; if you scale to multiple instances, switch Better Auth's rate-limit storage to `database`.
- **Security headers**: HSTS, `X-Frame-Options: DENY`, `nosniff`, referrer and permissions policies are set globally in [next.config.ts](next.config.ts).
- **Content-Security-Policy** is not set by default (Next.js inline hydration scripts require per-request nonces). If your threat model needs CSP, follow the [Next.js CSP guide](https://nextjs.org/docs/app/building-your-application/configuring/content-security-policy).
- **Secrets**: `.env` is gitignored; never commit it. Rotate `BETTER_AUTH_SECRET`, database credentials, and R2 tokens if they ever leak — and use different values for dev and prod.

## 7. Known production considerations

- The AI assistant's free-tier model (`openrouter/free`) has shared rate limits; for reliability under real usage, add OpenRouter credit or pin a paid model.
- Session cookie cache is 5 minutes — a revoked session may remain usable on another device for up to that long.
- There is no automated backup story beyond what Neon provides (point-in-time restore on paid plans).
