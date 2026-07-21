import { NextRequest, NextResponse } from "next/server";

/**
 * Capture client-side crashes surfaced by the error boundaries
 * (app/error.tsx and app/global-error.tsx) so a white-screen crash
 * lands in the Vercel function logs even when the user can't screenshot it.
 *
 * Deliberately logs no user identifiers — only the error, the URL, and the
 * user-agent (which is what we need to tell "her iPad / old iOS" apart from
 * a real bug). Keep it that way for GDPR.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.error(
      "[client-error]",
      JSON.stringify({
        message: typeof body?.message === "string" ? body.message.slice(0, 500) : null,
        digest: typeof body?.digest === "string" ? body.digest : null,
        url: typeof body?.url === "string" ? body.url : null,
        userAgent: typeof body?.userAgent === "string" ? body.userAgent : null,
        stack: typeof body?.stack === "string" ? body.stack.slice(0, 2000) : null,
      })
    );
  } catch {
    console.error("[client-error] received a report but failed to parse it");
  }
  // Always 200 — reporting must never itself throw or block the client.
  return NextResponse.json({ ok: true });
}
