import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { asUser } from "@/lib/db/as-user";

/**
 * The signed-in member's own organization logo (no id in the URL, so there's
 * nothing to guess). Read through the database's access rules.
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return new NextResponse(null, { status: 401 });
  const [row] = await asUser(user.id, (q) =>
    q<{ logo: Buffer | null; logo_type: string | null }>(
      `select o.logo, o.logo_type from organizations o join memberships m on m.org_id = o.id
        where m.user_id = $1 and m.active`,
      [user.id],
    ),
  );
  if (!row?.logo || !row.logo_type) return new NextResponse(null, { status: 404 });
  return new NextResponse(new Uint8Array(row.logo), {
    headers: {
      "Content-Type": row.logo_type,
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
