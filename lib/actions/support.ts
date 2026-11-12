"use server";

import { headers } from "next/headers";
import { queryOne } from "@/lib/db/client";
import { requireUserId } from "@/lib/current-user";
import { escapeHtml, sendEmail } from "@/lib/email";
import { logEvent } from "@/lib/events";
import { SUPPORT_EMAIL } from "@/lib/settings-options";
import { toActionResult, type ActionResult } from "@/lib/validation";
import packageJson from "@/package.json";

const SUPPORT_TOPICS = ["Something isn't working", "Billing or my plan", "An idea or request", "Something else"] as const;

const MAX_PER_HOUR = 5;

/**
 * Settings → About & help: sends the message to support with the person's
 * email as Reply-To, and records it in the owner command center (/owner)
 * so nothing is lost if email delivery fails.
 */
export async function sendSupportMessage(params: { topic: string; message: string }): Promise<ActionResult<{ email: string }>> {
  return toActionResult(async () => {
    const userId = await requireUserId();
    const topic = (SUPPORT_TOPICS as readonly string[]).includes(params.topic) ? params.topic : "Something else";
    const message = params.message.trim().slice(0, 5000);
    if (message.length < 5) throw new Error("Tell us a little more so we can help.");

    const user = await queryOne<{ email: string; name: string | null }>(`select email, name from users where id = $1`, [userId]);
    if (!user) throw new Error("Couldn't find your account.");

    const recent = await queryOne<{ n: number }>(
      `select count(*)::int as n from app_events where kind = 'support.message' and email = $1 and created_at > now() - interval '1 hour'`,
      [user.email],
    );
    if ((recent?.n ?? 0) >= MAX_PER_HOUR) {
      throw new Error(`You've sent several messages in the last hour. We have them, or email ${SUPPORT_EMAIL}.`);
    }

    const plan = await queryOne<{ plan: string; status: string }>(
      `select plan, status from billing_accounts where user_id = $1`,
      [userId],
    ).catch(() => null);
    const agent = (await headers()).get("user-agent") ?? "unknown";
    const details = [
      `From: ${user.name ?? "(no name)"} <${user.email}>`,
      `Topic: ${topic}`,
      `Plan: ${plan ? `${plan.plan} (${plan.status})` : "none"}`,
      `App version: ${packageJson.version}`,
      `Device: ${agent}`,
      `Account id: ${userId}`,
    ];

    await logEvent("support.message", `${topic}: ${message}`, { level: "warn", email: user.email, meta: { topic } });

    try {
      await sendEmail({
        to: SUPPORT_EMAIL,
        replyTo: user.email,
        subject: `Strynd support: ${topic}`,
        text: `${message}\n\n---\n${details.join("\n")}`,
        html: `<div style="font-family:Inter,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6"><p style="white-space:pre-wrap">${escapeHtml(
          message,
        )}</p><hr><p style="color:#6e5f4d;font-size:13px">${details.map(escapeHtml).join("<br>")}</p></div>`,
      });
    } catch (err) {
      // Already saved in /owner above; the person still gets a "sent" answer.
      console.error("[support] email failed", err);
    }
    return { email: user.email };
  });
}
