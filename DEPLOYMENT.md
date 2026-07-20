# Deploying BuilderBridge

This guide covers Vercel, Neon PostgreSQL, a private Supabase Storage bucket, and production monitoring.

## 1. Prerequisites

- A Neon project in the same region as the Vercel deployment.
- A Supabase project with a private Storage bucket for project files.
- Google OAuth credentials if Google sign-in is enabled.
- An OpenRouter key if BuilderBridge AI is enabled.

Local-disk uploads do not survive serverless deployments. Supabase Storage is required in production.

## 2. Environment variables

Set these in Vercel -> Project -> Settings -> Environment Variables:

| Variable | Value |
|---|---|
| `DATABASE_URL` | Neon pooled connection string with `sslmode=require` |
| `BETTER_AUTH_SECRET` | A fresh random production secret of at least 32 bytes |
| `BETTER_AUTH_URL` | Production origin, for example `https://app.example.com` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google Cloud OAuth credentials |
| `S3_ENDPOINT` | `https://<project-ref>.storage.supabase.co/storage/v1/s3` |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | Server-only keys generated in Supabase Storage S3 settings |
| `S3_BUCKET` | Private bucket name, for example `builderbridge-uploads` |
| `S3_REGION` | Supabase project region, for example `ap-south-1` |
| `OPENROUTER_API_KEY` | Optional; enables BuilderBridge AI |
| `OPENROUTER_MODEL` | Optional; defaults to `openrouter/free` |

The endpoint, access key, secret, and bucket must be configured together. If any is missing, the app uses local storage, which is only suitable for development.

### Supabase Storage setup

1. Create a project at [supabase.com](https://supabase.com) in a region close to the app and database.
2. Open **Storage**, create a bucket named `builderbridge-uploads`, and leave it **Private**.
3. Open **Storage -> Configuration -> S3**, enable the S3 protocol, and copy the direct endpoint and region.
4. Generate an S3 access-key pair and save it immediately.
5. Add the five `S3_*` variables to Vercel and redeploy.

S3 access keys bypass Supabase Storage RLS. Keep them server-only and never use a `NEXT_PUBLIC_` prefix.

Objects use scoped keys such as:

```text
drawings/<projectId>/<timestamp>-<filename>
tasks/<taskId>/<timestamp>-<filename>
documents/<projectId>/<timestamp>-<filename>
```

BuilderBridge checks project membership and streams private objects through `/api/files/...`. The bucket does not need a public URL or browser-side Supabase client.

### Existing public-bucket deployments

If the database already contains Supabase public URLs, keep the existing `S3_PUBLIC_URL` environment variable during the transition. BuilderBridge uses it only to recognize legacy URLs and translate them to `/api/files/...`; new uploads never receive a public URL. Deploy this code first, verify old drawings still open through `/api/files/`, and only then change the Supabase bucket to Private.

## 3. Database migrations

Migrations are not run automatically on deploy:

```bash
npx prisma migrate deploy
```

Do not run `npm run db:seed` against a real production database.

## 4. Deploy

Connect the Git repository to Vercel for deploy-on-push, or deploy from the CLI:

```bash
npm i -g vercel
vercel
vercel --prod
```

## 5. Production monitoring

BuilderBridge writes one-line JSON operational logs to Vercel and propagates an
`X-Request-ID` from the browser-facing request into the OCR worker. Search that
ID in both Vercel logs and Google Cloud Logging to follow one failed workflow.
Logs contain IDs, status codes, durations, and byte counts; they intentionally
exclude prompts, message contents, file names, document text, credentials, and
cookies.

Sentry is configured for errors only. Add these variables to Vercel Production:

```text
NEXT_PUBLIC_SENTRY_DSN=https://...
SENTRY_ORG=your-sentry-organization
SENTRY_PROJECT=builderbridge
SENTRY_AUTH_TOKEN=sntrys_...
```

The auth token needs source-map/release permissions and must never be committed.
The application disables tracing, session replay, default PII, and Sentry log
forwarding. The `BuilderBridge OCR 5xx errors` policy in Google Cloud Monitoring
alerts on any Cloud Run server error; application errors alert from Sentry.

## 6. Post-deploy checklist

- [ ] Email and Google sign-in work on the production origin.
- [ ] `BETTER_AUTH_URL` exactly matches the deployed origin.
- [ ] Upload a Field Tracking photo and a drawing; their stored URLs begin with `/api/files/`.
- [ ] Open each file while signed in.
- [ ] Verify the same file URL is unavailable in an incognito session.
- [ ] Verify PDF preview supports seeking between pages.
- [ ] `npx prisma migrate status` reports that production is up to date.

## 7. Security notes

- The Supabase bucket must remain private.
- BuilderBridge performs authorization in the file route using project membership.
- Storage credentials and service keys must never be sent to the browser or committed to Git.
- Rotate any secret immediately if it is exposed.
- Global security headers are configured in `next.config.ts`.

## 8. Production considerations

- OpenRouter free models have shared rate limits. Add credit or pin a paid model when reliability matters.
- Session cookie cache is five minutes, so a revoked session may briefly remain usable on another device.
- Configure database and object-storage backups appropriate to the project data retention policy.
