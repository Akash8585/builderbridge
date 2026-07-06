import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { organization } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  // Every page load calls getSession() — without this, that's a DB round trip
  // on every single navigation just to confirm who's logged in. Caching the
  // session in a signed cookie for 5 minutes skips that DB hit almost always.
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
    },
  },
  // Rate limiting on /api/auth/* — Better Auth enables this by default only in
  // production; making it explicit (and always on) protects sign-in/sign-up
  // from brute force even in staging environments. In-memory storage is fine
  // for a single instance; swap to database storage if scaled horizontally.
  // Dev relaxes the strict built-in sign-in rule (3/10s) so E2E suites and
  // manual account-switching don't trip it; production keeps the default.
  rateLimit: {
    enabled: true,
    window: 60,
    max: 60,
    ...(process.env.NODE_ENV === "development"
      ? { customRules: { "/sign-in/email": { window: 10, max: 30 } } }
      : {}),
  },
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    },
  },
  // Organization plugin is used only for org creation/switching (activeOrganizationId).
  // Its own role/invitation system is not used — see ProjectMember/ProjectInvite instead,
  // which implement per-project roles and link-based invites.
  plugins: [organization(), nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
