import { NextResponse } from "next/server";
import { completeAutodeskOAuth } from "@/app/actions/autodesk";
import { env } from "@/lib/env";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  const base = env.BETTER_AUTH_URL.replace(/\/$/, "");

  if (error) {
    return NextResponse.redirect(`${base}/integrations?autodesk_error=${encodeURIComponent(error)}`);
  }
  if (!code || !state) {
    return NextResponse.redirect(`${base}/integrations?autodesk_error=missing_code`);
  }

  try {
    await completeAutodeskOAuth(code, state);
    return NextResponse.redirect(`${base}/integrations?autodesk_connected=1`);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Autodesk connection failed";
    return NextResponse.redirect(`${base}/integrations?autodesk_error=${encodeURIComponent(message)}`);
  }
}
