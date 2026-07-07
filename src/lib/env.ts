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
  // Public base URL files are served from. For Supabase:
  // https://<project-ref>.supabase.co/storage/v1/object/public/<bucket>
  S3_PUBLIC_URL: z.string().optional(),
  // Optional: Stripe billing (test mode is fine). All unset = billing UI
  // shows a "not configured" state and every org stays on the FREE tier.
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_CORE: z.string().optional(),
  STRIPE_PRICE_PRO: z.string().optional(),
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
