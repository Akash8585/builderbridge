import { AsyncLocalStorage } from "node:async_hooks";
import * as Sentry from "@sentry/nextjs";
import { sanitizeMetadata } from "@/lib/telemetry-privacy";

type LogLevel = "debug" | "info" | "warn" | "error";
type LogMetadata = Record<string, unknown>;

const requestStore = new AsyncLocalStorage<{ requestId: string }>();
export function currentRequestId(): string | undefined {
  return requestStore.getStore()?.requestId;
}

export function requestIdFor(request: Request): string {
  const supplied = request.headers.get("x-request-id")?.trim();
  return supplied && /^[A-Za-z0-9._:-]{8,128}$/.test(supplied) ? supplied : crypto.randomUUID();
}

function emit(level: LogLevel, event: string, metadata: LogMetadata = {}) {
  const payload = {
    timestamp: new Date().toISOString(),
    severity: level.toUpperCase(),
    service: "builderbridge-web",
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown",
    release: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.SENTRY_RELEASE,
    event,
    requestId: currentRequestId(),
    ...sanitizeMetadata(metadata),
  };
  const line = JSON.stringify(payload);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else if (level === "debug") console.debug(line);
  else console.info(line);
}

export const logger = {
  debug: (event: string, metadata?: LogMetadata) => emit("debug", event, metadata),
  info: (event: string, metadata?: LogMetadata) => emit("info", event, metadata),
  warn: (event: string, metadata?: LogMetadata) => emit("warn", event, metadata),
  error: (event: string, error: unknown, metadata: LogMetadata = {}) => {
    emit("error", event, {
      ...metadata,
      error: error instanceof Error ? error : new Error("Unknown operational failure"),
    });
  },
};

export function reportException(error: unknown, event: string, metadata: LogMetadata = {}) {
  logger.error(event, error, metadata);
  const exception = error instanceof Error ? error : new Error("Unknown operational failure");
  Sentry.withScope((scope) => {
    scope.setTag("event", event);
    const requestId = currentRequestId();
    if (requestId) scope.setTag("request_id", requestId);
    scope.setContext("builderbridge", sanitizeMetadata(metadata));
    Sentry.captureException(exception);
  });
}

export async function observeApiRequest(
  request: Request,
  event: string,
  handler: () => Promise<Response>
): Promise<Response> {
  const requestId = requestIdFor(request);
  return requestStore.run({ requestId }, async () => {
    const startedAt = performance.now();
    logger.info(`${event}.started`, { method: request.method });
    try {
      const response = await handler();
      response.headers.set("X-Request-ID", requestId);
      const metadata = {
        method: request.method,
        status: response.status,
        durationMs: Math.round(performance.now() - startedAt),
      };
      if (response.status >= 500) logger.error(`${event}.completed`, new Error("Request returned 5xx"), metadata);
      else if (response.status >= 400) logger.warn(`${event}.completed`, metadata);
      else logger.info(`${event}.completed`, metadata);
      return response;
    } catch (error) {
      reportException(error, `${event}.failed`, {
        method: request.method,
        durationMs: Math.round(performance.now() - startedAt),
      });
      throw error;
    }
  });
}
