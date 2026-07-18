import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  BETTER_AUTH_SECRET: z.string().min(1, "BETTER_AUTH_SECRET is required"),
  BETTER_AUTH_URL: z.string().min(1, "BETTER_AUTH_URL is required"),
  GOOGLE_CLIENT_ID: z.string().min(1, "GOOGLE_CLIENT_ID is required"),
  GOOGLE_CLIENT_SECRET: z.string().min(1, "GOOGLE_CLIENT_SECRET is required"),
  // Optional: powers the Schedule Q&A Assistant. Left unset, the app still
  // runs fine — the assistant just shows a "not configured" message.
  OPENROUTER_API_KEY: z.string().optional(),
  // "openrouter/free" auto-selects an available free model with failover,
  // which sidesteps rate limits on any single popular free model.
  OPENROUTER_MODEL: z.string().default("openrouter/free"),
  // Comma-separated model IDs tried by OpenRouter after OPENROUTER_MODEL.
  // Keeping openrouter/free as the final fallback preserves free-tier support
  // when a specific primary model is configured.
  OPENROUTER_FALLBACK_MODELS: z.string().default("openrouter/free"),
  // The AI SDK retries retryable pre-stream failures with exponential backoff.
  OPENROUTER_MAX_RETRIES: z.coerce.number().int().min(0).max(5).default(2),
  // Agent abuse protection and monthly model-request allowances. Local,
  // deterministic proposal handlers do not consume the monthly allowance.
  AI_CHAT_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(1).max(300).default(30),
  AI_MONTHLY_LIMIT_FREE: z.coerce.number().int().min(1).default(250),
  AI_MONTHLY_LIMIT_CORE: z.coerce.number().int().min(1).default(2500),
  AI_MONTHLY_LIMIT_PRO: z.coerce.number().int().min(1).default(10000),
  // Optional: S3-compatible object storage (Supabase Storage / Cloudflare R2 /
  // AWS S3 / MinIO) for Field Tracking photos and Drawings. Endpoint, keys,
  // and bucket must be set together to enable it — otherwise uploads fall
  // back to local disk (dev only).
  S3_ENDPOINT: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  // Region: Supabase requires the project's region (e.g. "ap-south-1");
  // R2 uses "auto" (the default).
  S3_REGION: z.string().default("auto"),
  // Deprecated compatibility setting. New uploads are served through the
  // authenticated /api/files route and do not require a public bucket URL.
  S3_PUBLIC_URL: z.string().optional(),
  // Optional: Stripe billing (test mode is fine). All unset = billing UI
  // shows a "not configured" state and every org stays on the FREE tier.
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_CORE: z.string().optional(),
  STRIPE_PRICE_PRO: z.string().optional(),
  // Optional: Procore integration (sandbox credentials from developers.procore.com).
  // Leave unset to disable — the Integrations page shows a "not configured" notice.
  PROCORE_CLIENT_ID: z.string().optional(),
  PROCORE_CLIENT_SECRET: z.string().optional(),
  // Defaults to {BETTER_AUTH_URL}/api/integrations/procore/callback when unset.
  PROCORE_REDIRECT_URI: z.string().optional(),
  // "sandbox" (default) or "production" — controls OAuth + API base URLs.
  PROCORE_ENV: z.enum(["sandbox", "production"]).default("sandbox"),
  // Optional: Autodesk ACC integration (https://aps.autodesk.com — free tier).
  AUTODESK_CLIENT_ID: z.string().optional(),
  AUTODESK_CLIENT_SECRET: z.string().optional(),
  AUTODESK_REDIRECT_URI: z.string().optional(),
  // Optional: email notifications via Resend. Unset = emails are skipped
  // (logged in dev) and the app works normally.
  RESEND_API_KEY: z.string().optional(),
  // Resend's free tier can send from onboarding@resend.dev without domain
  // verification (only to your own account's email). Set a verified-domain
  // sender for production.
  EMAIL_FROM: z.string().default("BuilderBridge <onboarding@resend.dev>"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n");
  throw new Error(`Invalid environment variables:\n${issues}`);
}

export const env = parsed.data;
