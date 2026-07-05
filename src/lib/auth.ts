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
