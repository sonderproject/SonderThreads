"use server";

import { randomUUID } from "crypto";
import { redirect, unstable_rethrow } from "next/navigation";
import { isOwnerAccount, logOwnerAction, requireOwner } from "@/lib/owner";
import { query, queryOne } from "@/lib/db/client";
import { ORG_CARD_TRIALS_FROM, saveSubscription, stripe } from "@/lib/billing";
import { clearAppSettingsCache } from "@/lib/app-settings";
import { isEmail } from "@/lib/email-check";
import { logEvent } from "@/lib/events";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { appUrl } from "@/lib/email";

/** Command center → Needs attention → Resend: sends the sign-up confirmation email again. */
export async function ownerResendConfirmation(formData: FormData): Promise<void> {
  await requireOwner();
  const email = formData.get("email")?.toString().trim().toLowerCase() ?? "";
  if (!email.includes("@")) redirect("/owner");
  // Server-side with the admin key, so it works even with sign-up CAPTCHA on.
  const { error } = await createSupabaseAdmin().auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: `${appUrl()}/auth/confirm?next=%2F` },
  });
  if (error) {
    await logEvent("owner.resend_failed", error.message, { level: "warn", email });
    redirect(`/owner?resend=failed&email=${encodeURIComponent(email)}#attention`);
  }
  await logOwnerAction("resent_confirmation", "Owner resent the confirmation email", { email });
  redirect(`/owner?resend=sent&email=${encodeURIComponent(email)}#attention`);
}

/* ------------------------------------------------------------------ */
/* Controls (docs/command-center-plan.md §1). Every action: requireOwner(), never touches the     */
/* owner's own account, and logOwnerAction() records it and emails the owner a copy.              */
/* ------------------------------------------------------------------ */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function text(formData: FormData, name: string, max: number): string {
  return (formData.get(name)?.toString() ?? "").trim().slice(0, max);
}

/** Where to return to after an account action (the search the owner was on). */
function backTo(formData: FormData, msg: string): never {
  const q = text(formData, "q", 200);
  redirect(`/owner/accounts?${new URLSearchParams({ ...(q ? { q } : {}), msg })}`);
}

/** The target account, refusing the owner's own. */
async function targetUser(id: string): Promise<{ id: string; email: string }> {
  if (!UUID.test(id)) throw new Error("bad id");
  const u = await queryOne<{ id: string; email: string }>(`select id, email from users where id = $1`, [id]);
  if (!u) throw new Error("not found");
  if (isOwnerAccount(u.id, u.email)) throw new Error("owner");
  return u;
}

/** The target organization, refusing any the owner's account belongs to. */
async function targetOrg(id: string): Promise<{ id: string; name: string }> {
  if (!UUID.test(id)) throw new Error("bad id");
  const o = await queryOne<{ id: string; name: string }>(`select id, name from organizations where id = $1`, [id]);
  if (!o) throw new Error("not found");
  const members = await query<{ id: string; email: string }>(
    `select u.id, u.email from memberships m join users u on u.id = m.user_id where m.org_id = $1`,
    [id],
  );
  if (members.some((m) => isOwnerAccount(m.id, m.email))) throw new Error("owner");
  return o;
}

export async function ownerSuspend(formData: FormData): Promise<void> {
  await requireOwner();
  const kind = formData.get("kind") === "org" ? "org" : "user";
  const id = text(formData, "id", 40);
  const reason = text(formData, "reason", 500) || null;
  try {
    if (kind === "user") {
      const u = await targetUser(id);
      await query(`update users set suspended_at = now(), suspended_reason = $2 where id = $1`, [u.id, reason]);
      await logOwnerAction("suspended_user", `Suspended ${u.email}`, { account: u.email, reason: reason ?? "(none)" });
    } else {
      const o = await targetOrg(id);
      await query(`update organizations set suspended_at = now(), suspended_reason = $2 where id = $1`, [o.id, reason]);
      await logOwnerAction("suspended_org", `Suspended organization ${o.name}`, { organization: o.name, reason: reason ?? "(none)" });
    }
  } catch (err) {
    backTo(formData, err instanceof Error && err.message === "owner" ? "owner" : "failed");
  }
  backTo(formData, "suspended");
}

export async function ownerUnsuspend(formData: FormData): Promise<void> {
  await requireOwner();
  const kind = formData.get("kind") === "org" ? "org" : "user";
  const id = text(formData, "id", 40);
  if (!UUID.test(id)) backTo(formData, "failed");
  if (kind === "user") {
    const u = await queryOne<{ email: string }>(`update users set suspended_at = null, suspended_reason = null where id = $1 returning email`, [id]);
    await logOwnerAction("unsuspended_user", `Lifted the suspension on ${u?.email ?? id}`, { account: u?.email ?? id });
  } else {
    const o = await queryOne<{ name: string }>(`update organizations set suspended_at = null, suspended_reason = null where id = $1 returning name`, [id]);
    await logOwnerAction("unsuspended_org", `Lifted the suspension on organization ${o?.name ?? id}`, { organization: o?.name ?? id });
  }
  backTo(formData, "unsuspended");
}

/** Adds free-trial days: on Stripe for card trials, or extra days for no-card trials. */
export async function ownerExtendTrial(formData: FormData): Promise<void> {
  await requireOwner();
  const kind = formData.get("kind") === "org" ? "org" : "user";
  const id = text(formData, "id", 40);
  const days = Number(formData.get("days"));
  if (!Number.isInteger(days) || days < 1 || days > 60) backTo(formData, "days");
  let label = "";
  try {
    label = kind === "user" ? (await targetUser(id)).email : (await targetOrg(id)).name;
    const row = await queryOne<{ status: string; stripe_subscription_id: string | null; plan: string }>(
      `select status, stripe_subscription_id, plan from billing_accounts where ${kind === "user" ? "user_id" : "org_id"} = $1`,
      [id],
    );
    if (row?.plan === "comp") backTo(formData, "already_free");
    if (row?.stripe_subscription_id && row.status === "trialing") {
      const s = stripe();
      if (!s) throw new Error("no stripe");
      const sub = await s.subscriptions.retrieve(row.stripe_subscription_id);
      const from = Math.max(sub.trial_end ?? 0, Math.floor(Date.now() / 1000));
      const updated = await s.subscriptions.update(sub.id, { trial_end: from + days * 86_400, proration_behavior: "none" });
      await saveSubscription(updated);
    } else if (row?.stripe_subscription_id && row.status !== "canceled") {
      backTo(formData, "not_trial"); // already paying: nothing to extend
    } else if (kind === "org") {
      const org = await queryOne<{ created_at: string }>(`select created_at from organizations where id = $1`, [id]);
      // Card-first organizations haven't started a trial until an admin adds a card.
      if (org && new Date(org.created_at) >= ORG_CARD_TRIALS_FROM) backTo(formData, "no_card_yet");
      await query(`update organizations set trial_extra_days = least(365, trial_extra_days + $2) where id = $1`, [id, days]);
    } else {
      await query(`update users set trial_extra_days = least(365, trial_extra_days + $2) where id = $1`, [id, days]);
    }
  } catch (err) {
    unstable_rethrow(err);
    backTo(formData, err instanceof Error && err.message === "owner" ? "owner" : "failed");
  }
  await logOwnerAction("extended_trial", `Added ${days} trial days for ${label}`, { [kind === "user" ? "account" : "organization"]: label, days });
  backTo(formData, "extended");
}

/** Free for life (comp). Not for accounts with a live Stripe subscription: cancel that in Stripe first. */
export async function ownerMakeFree(formData: FormData): Promise<void> {
  await requireOwner();
  const kind = formData.get("kind") === "org" ? "org" : "user";
  const id = text(formData, "id", 40);
  const on = formData.get("on") === "1";
  let label = "";
  try {
    label = kind === "user" ? (await targetUser(id)).email : (await targetOrg(id)).name;
    const col = kind === "user" ? "user_id" : "org_id";
    const row = await queryOne<{ status: string; stripe_subscription_id: string | null; plan: string }>(
      `select status, stripe_subscription_id, plan from billing_accounts where ${col} = $1`,
      [id],
    );
    const live = row?.stripe_subscription_id && ["active", "trialing", "past_due", "unpaid"].includes(row.status);
    if (on) {
      if (live) backTo(formData, "has_subscription");
      await query(
        `insert into billing_accounts (${col}, plan, status) values ($1, 'comp', 'comp')
         on conflict (${col}) do update set plan = 'comp', status = 'comp', updated_at = now()`,
        [id],
      );
    } else {
      if (row?.plan !== "comp") backTo(formData, "not_free");
      // Back to the normal rules (trial or view-only); a past subscription id stays for the record.
      await query(`update billing_accounts set plan = $2, status = 'canceled', updated_at = now() where ${col} = $1`, [id, kind === "org" ? "org" : "individual"]);
    }
  } catch (err) {
    unstable_rethrow(err);
    backTo(formData, err instanceof Error && err.message === "owner" ? "owner" : "failed");
  }
  await logOwnerAction(on ? "made_free" : "removed_free", `${on ? "Made free for life" : "Removed free for life"}: ${label}`, {
    [kind === "user" ? "account" : "organization"]: label,
  });
  backTo(formData, on ? "made_free" : "removed_free");
}

/** Resend the confirmation email from the Accounts page (same as Needs attention). */
export async function ownerResendFromAccounts(formData: FormData): Promise<void> {
  await requireOwner();
  const email = text(formData, "email", 254).toLowerCase();
  if (!isEmail(email)) backTo(formData, "failed");
  const { error } = await createSupabaseAdmin().auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: `${appUrl()}/auth/confirm?next=%2F` },
  });
  if (error) backTo(formData, "resend_failed");
  await logOwnerAction("resent_confirmation", `Resent the confirmation email to ${email}`, { account: email });
  backTo(formData, "resent");
}

export async function ownerSetMaintenance(formData: FormData): Promise<void> {
  await requireOwner();
  const on = formData.get("on") === "1";
  const message = text(formData, "message", 300) || null;
  // "until" comes from a datetime-local field in the owner's time zone, sent with its offset in minutes.
  const untilLocal = text(formData, "until", 40);
  const offset = Number(formData.get("tz_offset"));
  let until: Date | null = null;
  if (on && untilLocal) {
    const t = new Date(`${untilLocal}:00Z`).getTime() + (Number.isFinite(offset) ? offset : 0) * 60_000;
    if (Number.isFinite(t) && t > Date.now()) until = new Date(t);
  }
  await query(
    `update app_settings set maintenance_on = $1, maintenance_message = $2, maintenance_until = $3, updated_at = now() where id`,
    [on, on ? message : null, on ? until : null],
  );
  clearAppSettingsCache();
  await logOwnerAction(on ? "maintenance_on" : "maintenance_off", on ? "Turned maintenance mode ON" : "Turned maintenance mode off", {
    ...(on ? { message: message ?? "(default)", until: until?.toISOString() ?? "(not set)" } : {}),
  });
  redirect(`/owner/controls?msg=${on ? "maintenance_on" : "maintenance_off"}`);
}

export async function ownerSetAnnouncement(formData: FormData): Promise<void> {
  await requireOwner();
  const body = text(formData, "text", 300);
  const link = text(formData, "link", 300);
  const clear = formData.get("clear") === "1";
  if (!clear && body.length < 3) redirect("/owner/controls?msg=announcement_short");
  // Links: only our own pages or https.
  const safeLink = link && (/^\/[^/]/.test(link) || /^https:\/\//.test(link)) ? link : null;
  await query(
    `update app_settings set announcement_id = $1, announcement_text = $2, announcement_link = $3, announcement_at = $4, updated_at = now() where id`,
    clear ? [null, null, null, null] : [randomUUID(), body, safeLink, new Date()],
  );
  clearAppSettingsCache();
  await logOwnerAction(clear ? "announcement_cleared" : "announcement_posted", clear ? "Removed the announcement" : `Posted an announcement: ${body}`);
  redirect(`/owner/controls?msg=${clear ? "announcement_cleared" : "announcement_posted"}`);
}

/** Feedback inbox: mark a message done (or not done). */
export async function ownerResolveFeedback(formData: FormData): Promise<void> {
  await requireOwner();
  const id = text(formData, "id", 40);
  const done = formData.get("done") === "1";
  if (UUID.test(id)) {
    await query(`update app_events set resolved_at = ${done ? "now()" : "null"} where id = $1 and kind = 'support.message'`, [id]);
  }
  redirect(`/owner/inbox${formData.get("show") === "all" ? "?show=all" : ""}`);
}
