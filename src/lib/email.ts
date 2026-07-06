import { env } from "@/lib/env";

/**
 * Email notifications via Resend's HTTP API. Fire-and-forget by design:
 * a failed or unconfigured email must never break the mutation it announces
 * (same philosophy as lib/activity-log.ts).
 *
 * Without RESEND_API_KEY, sends are skipped (and logged in dev) so the whole
 * feature degrades gracefully until a key is configured.
 */

const RESEND_URL = "https://api.resend.com/emails";

export function isEmailConfigured(): boolean {
  return !!env.RESEND_API_KEY;
}

/** Shared shell so every notification renders with consistent branding. */
export function renderEmailHtml(heading: string, bodyLines: string[], ctaUrl?: string, ctaLabel?: string): string {
  const paragraphs = bodyLines
    .map((line) => `<p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#374151;">${line}</p>`)
    .join("");
  const cta = ctaUrl
    ? `<a href="${ctaUrl}" style="display:inline-block;margin-top:8px;padding:10px 20px;background:#111111;color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">${ctaLabel ?? "Open BuilderBridge"}</a>`
    : "";
  return `<!doctype html><html><body style="margin:0;padding:24px;background:#f8f9fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:32px;">
    <p style="margin:0 0 20px;font-size:16px;font-weight:600;color:#111111;">BuilderBridge</p>
    <h1 style="margin:0 0 16px;font-size:20px;font-weight:600;color:#111111;letter-spacing:-0.02em;">${heading}</h1>
    ${paragraphs}
    ${cta}
    <p style="margin:24px 0 0;font-size:12px;color:#898989;">You can turn these notifications off in Settings.</p>
  </div>
</body></html>`;
}

export async function sendEmail(params: { to: string; subject: string; html: string }): Promise<void> {
  if (!env.RESEND_API_KEY) {
    if (process.env.NODE_ENV === "development") {
      console.log(`[email skipped — RESEND_API_KEY unset] to=${params.to} subject="${params.subject}"`);
    }
    return;
  }

  try {
    const res = await fetch(RESEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: [params.to],
        subject: params.subject,
        html: params.html,
      }),
    });
    if (!res.ok && process.env.NODE_ENV === "development") {
      console.warn(`[email failed] ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
  } catch {
    // Never propagate email failures into the calling mutation.
  }
}
