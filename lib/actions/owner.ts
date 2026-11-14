"use server";

import { redirect } from "next/navigation";
import { logOwnerAction, requireOwner } from "@/lib/owner";
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
