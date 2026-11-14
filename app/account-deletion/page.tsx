import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/legal/LegalPage";
import { SUPPORT_EMAIL } from "@/lib/settings-options";

export const metadata: Metadata = {
  title: "Delete your account · Surfdesk",
  description: "How to delete your Surfdesk account and all of its data.",
  alternates: { canonical: "/account-deletion" },
};

/** Public page (no sign-in needed) explaining account deletion. Google Play requires one. */
export default function AccountDeletionPage() {
  return (
    <LegalPage title="Delete your account" updated="November 9, 2026">
      <p>You can delete your Surfdesk account and everything in it at any time.</p>

      <LegalSection title="In the app (fastest)">
        <ul>
          <li>Sign in on the web or in the app.</li>
          <li>
            Go to <strong>Settings → Account → Delete account</strong>.
          </li>
          <li>
            Type <strong>DELETE</strong> to confirm.
          </li>
        </ul>
        <p>Your account and data are deleted right away, and you&apos;re signed out.</p>
      </LegalSection>

      <LegalSection title="By email">
        <p>
          Can&apos;t sign in? Email <a href={`mailto:${SUPPORT_EMAIL}?subject=Delete%20my%20account`}>{SUPPORT_EMAIL}</a>{" "}
          from the address on your account with the subject &quot;Delete my account&quot;. We&apos;ll confirm it&apos;s
          you, then delete the account within 7 days and reply when it&apos;s done.
        </p>
      </LegalSection>

      <LegalSection title="What's deleted">
        <ul>
          <li>Your sign-in, profile, phone number and settings.</li>
          <li>All people and client profiles, notes, tasks, lists, check-ins, reminders and activity history.</li>
          <li>Push notification subscriptions on all your devices.</li>
        </ul>
        <p>
          Nothing is kept in the live database. Encrypted backups are overwritten within 30 days. Want a copy first? Use{" "}
          <strong>Settings → Data</strong> to export your data before deleting.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
