import { notFound } from "next/navigation";
import { queryOne } from "@/lib/db/client";
import { requireUserId } from "@/lib/current-user";

/**
 * The owner of Strynd (Sonder Project), who alone can open /owner.
 * OWNER_EMAILS in Vercel overrides the default (comma-separated).
 */
export function ownerEmails(): string[] {
  return (process.env.OWNER_EMAILS || "sonderproject.co@gmail.com")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export async function isOwner(): Promise<boolean> {
  const userId = await requireUserId();
  const me = await queryOne<{ email: string }>(`select email from users where id = $1`, [userId]);
  return Boolean(me && ownerEmails().includes(me.email.toLowerCase()));
}

/** Everyone else gets an ordinary 404, so the page's existence isn't revealed. */
export async function requireOwner(): Promise<void> {
  if (!(await isOwner())) notFound();
}
