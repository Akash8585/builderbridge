import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

const { POST: originalPOST, GET: originalGET } = toNextJsHandler(auth);

function logDebug(location: string, message: string, data: Record<string, unknown>) {
  // #region agent log
  fetch("http://127.0.0.1:7600/ingest/68e6e7cf-5da8-4f72-982e-1527774b51c8", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "ed1ad1" },
    body: JSON.stringify({
      sessionId: "ed1ad1",
      location,
      message,
      data,
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion
}

function extractStateCookie(cookieHeader: string | null) {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/better-auth\.state=([^;]+)/);
  return match ? match[1].slice(0, 24) + "..." : null;
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const isRelevant = url.pathname.includes("sign-in/social") || url.pathname.includes("callback");
  if (isRelevant) {
    logDebug("route.ts:POST:before", "Incoming POST", {
      hypothesisId: "H1",
      pathname: url.pathname,
      hasStateCookie: !!extractStateCookie(request.headers.get("cookie")),
      stateCookiePreview: extractStateCookie(request.headers.get("cookie")),
    });
  }
  const response = await originalPOST(request);
  if (isRelevant) {
    const setCookie = response.headers.get("set-cookie");
    logDebug("route.ts:POST:after", "Outgoing POST response", {
      hypothesisId: "H1",
      pathname: url.pathname,
      status: response.status,
      setCookieHasState: !!setCookie?.includes("better-auth.state"),
      setCookiePreview: setCookie ? setCookie.slice(0, 120) : null,
    });
  }
  return response;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const isRelevant = url.pathname.includes("callback") || url.pathname.includes("error");
  if (isRelevant) {
    logDebug("route.ts:GET:before", "Incoming GET", {
      hypothesisId: "H2_H3",
      pathname: url.pathname,
      search: url.search.slice(0, 200),
      hasStateCookie: !!extractStateCookie(request.headers.get("cookie")),
      stateCookiePreview: extractStateCookie(request.headers.get("cookie")),
      fullCookieHeaderLength: request.headers.get("cookie")?.length ?? 0,
    });
  }
  const response = await originalGET(request);
  if (isRelevant) {
    logDebug("route.ts:GET:after", "Outgoing GET response", {
      hypothesisId: "H2_H3",
      pathname: url.pathname,
      status: response.status,
      location: response.headers.get("location"),
    });
  }
  return response;
}
