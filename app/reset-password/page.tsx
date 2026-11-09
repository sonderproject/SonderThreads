import { redirect } from "next/navigation";

// Rebuilt on Supabase Auth in the password-reset step.
export default function ResetPasswordPage() {
  redirect("/login");
}
