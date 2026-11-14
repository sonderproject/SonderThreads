import { NextResponse, type NextRequest } from "next/server";
import { safeEqual } from "@/lib/auth";
import { query } from "@/lib/db/client";
import { unsubscribeToken } from "@/lib/lifecycle";

export const dynamic = "force-dynamic";

/**
 * One-click unsubscribe from welcome/tip emails (lib/lifecycle.ts). The link
 * is signed per account, so it works without signing in. Billing emails
 * (trial ending, payment failed) still send.
 */
export async function GET(request: NextRequest) {
  const u = request.nextUrl.searchParams.get("u") ?? "";
  const t = request.nextUrl.searchParams.get("t") ?? "";
  const expected = /^[0-9a-f-]{36}$/i.test(u) ? unsubscribeToken(u) : null;
  const ok = Boolean(expected && t) && safeEqual(t, expected!);
  if (ok) await query(`update users set email_tips_opt_out = true where id = $1`, [u]);
  const msg = ok
    ? "You're unsubscribed from Surfdesk tips. You'll still get emails about your account and billing."
    : "That link didn't work. Reply to any Surfdesk email and we'll take you off the list.";
  return new NextResponse(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Surfdesk</title>
<body style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:480px;margin:80px auto;padding:0 16px;color:#1d1d1b;background:#f6f4ef">
<p style="font-size:16px;line-height:1.5">${msg}</p><p><a href="/" style="color:#1c77b5">Go to Surfdesk</a></p></body>`,
    { status: ok ? 200 : 400, headers: { "content-type": "text/html; charset=utf-8" } },
  );
}
