import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { organization } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";

// #region agent log
fetch("http://127.0.0.1:7600/ingest/68e6e7cf-5da8-4f72-982e-1527774b51c8", {
  method: "POST",
  headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "ed1ad1" },
  body: JSON.stringify({
    sessionId: "ed1ad1",
    location: "auth.ts:init",
    message: "Better Auth module initialized with baseURL",
    data: { hypothesisId: "H3", baseURL: env.BETTER_AUTH_URL, time: Date.now() },
    timestamp: Date.now(),
  }),
}).catch(() => {});
// #endregion

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
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
