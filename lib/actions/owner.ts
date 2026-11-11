"use server";

import { redirect } from "next/navigation";
import { requireOwner } from "@/lib/owner";
import { logEvent } from "@/lib/events";
import { createSupabaseServer } from "@/lib/supabase/server";
import { appUrl } from "@/lib/email";

/** Command center → Needs attention → Resend: sends the sign-up confirmation email again. */
export async function ownerResendConfirmation(formData: FormData): Promise<void> {
  await requireOwner();
  const email = formData.get("email")?.toString().trim().toLowerCase() ?? "";
  if (!email.includes("@")) redirect("/owner");
  const supabase = await createSupabaseServer();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: `${appUrl()}/auth/confirm?next=%2F` },
  });
  if (error) {
    await logEvent("owner.resend_failed", error.message, { level: "warn", email });
    redirect(`/owner?resend=failed&email=${encodeURIComponent(email)}#attention`);
  }
  await logEvent("owner.resent_confirmation", "Owner resent the confirmation email", { email });
  redirect(`/owner?resend=sent&email=${encodeURIComponent(email)}#attention`);
}
