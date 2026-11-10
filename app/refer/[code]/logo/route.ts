import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db/client";

/** The organization's logo on its public referral form (only while the link is on). */
export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const row = await queryOne<{ logo: Buffer | null; logo_type: string | null }>(
    `select logo, logo_type from organizations where referral_code = $1 and referral_enabled`,
    [code],
  );
  if (!row?.logo || !row.logo_type) return new NextResponse(null, { status: 404 });
  return new NextResponse(new Uint8Array(row.logo), {
    headers: { "Content-Type": row.logo_type, "Cache-Control": "public, max-age=300", "X-Content-Type-Options": "nosniff" },
  });
}
