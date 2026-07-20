import * as Sentry from "@sentry/nextjs";
import { sanitizeSentryEvent } from "@/lib/sentry-privacy";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN) && process.env.NODE_ENV !== "test",
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
  release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
  sendDefaultPii: false,
  tracesSampleRate: 0,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
  enableLogs: false,
  beforeSend: sanitizeSentryEvent,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
