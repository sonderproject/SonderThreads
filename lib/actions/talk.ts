"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { queryOne } from "@/lib/db/client";
import { escapeHtml, sendEmail } from "@/lib/email";
import { logEvent } from "@/lib/events";
import { SUPPORT_EMAIL } from "@/lib/settings-options";
import { TALK_SIZES } from "@/lib/talk";

const PER_NETWORK_PER_HOUR = 3;
const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

/**
 * "Talk to us" (/talk): an organization asks for a call. Saved to the owner
 * command center Inbox (app_events, kind support.message) and emailed to
 * support with the visitor as Reply-To. Public, so: honeypot, and a few per
 * network an hour.
 */
export async function requestTalk(formData: FormData): Promise<void> {
  const get = (k: string, max: number) => (formData.get(k)?.toString() ?? "").trim().replace(/\s+/g, " ").slice(0, max);
  const from = get("from", 20).replace(/[^a-z-]/g, "") || "talk";
  const back = (error: string) => redirect(`/talk?${new URLSearchParams({ error, from })}`);

  // Bots fill every field; people never see this one.
  if (get("website", 200)) redirect(`/talk?sent=1&from=${from}`);

  const name = get("name", 120);
  const email = get("email", 254).toLowerCase();
  const org = get("org", 200);
  const role = get("role", 120);
  const size = TALK_SIZES.includes(get("size", 20) as (typeof TALK_SIZES)[number]) ? get("size", 20) : "";
  const message = (formData.get("message")?.toString() ?? "").trim().slice(0, 3000);
  if (!name) back("name");
  if (!isEmail(email)) back("email");
  if (!org) back("org");

  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "unknown";
  const recent = await queryOne<{ n: number }>(
    `select count(*)::int as n from app_events
      where kind = 'support.message' and meta->>'topic' = 'Talk to us' and meta->>'ip' = $1 and created_at > now() - interval '1 hour'`,
    [ip],
  );
  if ((recent?.n ?? 0) >= PER_NETWORK_PER_HOUR) back("rate");

  const lines = [
    `Name: ${name}`,
    `Email: ${email}`,
    `Organization: ${org}`,
    `Role: ${role || "(not given)"}`,
    `Team size: ${size || "(not given)"}`,
    `From page: ${from}`,
  ];
  await logEvent("support.message", `Talk to us: ${org} (${name}${role ? `, ${role}` : ""}). ${message || "No message."}`, {
    level: "warn",
    email,
    path: "/talk",
    meta: { topic: "Talk to us", ip, from, size: size || null },
  });
  try {
    await sendEmail({
      to: SUPPORT_EMAIL,
      replyTo: email,
      subject: `Surfdesk: ${org} wants to talk`,
      text: `${lines.join("\n")}\n\n${message || "(no message)"}`,
      html: `<div style="font-family:Inter,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6"><p>${lines
        .map(escapeHtml)
        .join("<br>")}</p><p style="white-space:pre-wrap">${escapeHtml(message || "(no message)")}</p></div>`,
    });
  } catch (err) {
    // Already saved in the owner Inbox above.
    console.error("[talk] email failed", err);
  }
  redirect(`/talk?sent=1&from=${from}`);
}
