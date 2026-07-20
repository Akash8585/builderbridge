import type { ErrorEvent } from "@sentry/nextjs";
import { redactText, sanitizeMetadata } from "@/lib/telemetry-privacy";

export function sanitizeSentryEvent(event: ErrorEvent): ErrorEvent {
  if (event.request) {
    event.request.data = undefined;
    event.request.cookies = undefined;
    event.request.query_string = undefined;
    if (event.request.headers) {
      const headers = { ...event.request.headers };
      for (const key of Object.keys(headers)) {
        if (/authorization|cookie|token|secret/i.test(key)) delete headers[key];
      }
      event.request.headers = headers;
    }
  }
  if (event.user) event.user = event.user.id ? { id: String(event.user.id) } : undefined;
  if (event.extra) event.extra = sanitizeMetadata(event.extra);
  if (event.contexts) event.contexts = sanitizeMetadata(event.contexts) as ErrorEvent["contexts"];
  for (const value of event.exception?.values ?? []) {
    if (value.value) value.value = redactText(value.value);
  }
  for (const breadcrumb of event.breadcrumbs ?? []) {
    if (breadcrumb.message) breadcrumb.message = redactText(breadcrumb.message);
    if (breadcrumb.data) breadcrumb.data = sanitizeMetadata(breadcrumb.data);
  }
  return event;
}
