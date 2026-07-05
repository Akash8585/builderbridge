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
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n");
  throw new Error(`Invalid environment variables:\n${issues}`);
}

export const env = parsed.data;
