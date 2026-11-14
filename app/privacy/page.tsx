import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/legal/LegalPage";
import { SUPPORT_EMAIL } from "@/lib/settings-options";
import { LEGAL_UPDATED } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Privacy policy · Surfdesk",
  description: "What Surfdesk collects, how it's used and protected, and your choices.",
  alternates: { canonical: "/privacy" },
};

const mail = <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>;

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy" updated={LEGAL_UPDATED}>
      <p>
        Surfdesk (&quot;the app&quot;, formerly called Strynd) is run by Sonder Project, a sole proprietorship based in California
        (&quot;we&quot;, &quot;us&quot;). This policy explains what we collect when you use the app at thesurfdesk.app
        and in its mobile apps, how we use it, and the choices you have. We don&apos;t sell your data, and we don&apos;t
        use it for advertising.
      </p>

      <LegalSection title="What we collect">
        <ul>
          <li>
            <strong>Your account:</strong> email address, password (stored only as a secure hash by our sign-in
            provider), name and mobile number if you add them, two-factor authentication settings, and your
            settings. If you sign up from one of our ads, we note which campaign the link came from (no cookies or
            third-party trackers are used for this).
          </li>
          <li>
            <strong>What you enter:</strong> people and client profiles (such as name, date of birth, phone, email,
            gender, income level and ethnicity), notes, tasks, lists, check-ins, services and amounts, outcomes (such as
            &quot;got a job&quot;) and reminders.
          </li>
          <li>
            <strong>Billing:</strong> your plan, seat count, trial and payment status, and the Stripe customer and
            subscription IDs. Card details go straight to Stripe; we never see or store full card numbers.
          </li>
          <li>
            <strong>Agreements:</strong> which version of these terms and policy you agreed to, when, and the IP address
            and browser you used, as a record of your consent.
          </li>
          <li>
            <strong>Support messages:</strong> what you send through the contact form, with your plan, app version and
            device type so we can help.
          </li>
          <li>
            <strong>Calendar links:</strong> the private links to any outside calendars you choose to show in Surfdesk
            (see Calendar sync below).
          </li>
          <li>
            <strong>Device and usage data:</strong> time zone, push notification subscriptions, and standard server
            logs (such as IP address, browser type and the time of requests) used for security and troubleshooting. We
            also record key events in your account (such as signing up, finishing each set-up step, starting a trial or
            hitting a usage limit) to fix problems and see where people get stuck.
          </li>
          <li>
            <strong>Approximate location:</strong> the home screen shows local weather using the approximate location
            of your IP address. We don&apos;t ask for or store your precise location.
          </li>
        </ul>
        <p>
          <strong>What we never ask for:</strong> Social Security numbers, government ID numbers, or bank or card
          account details. Please don&apos;t enter them in the app.
        </p>
      </LegalSection>

      <LegalSection title="Information about other people">
        <p>
          If you use the app to keep track of clients or other people, you&apos;re responsible for having their
          permission, or another lawful basis, to record their information. We store and process that information only
          to provide the app to you. We don&apos;t contact the people in your records, and we don&apos;t use their
          information for any other purpose.
        </p>
      </LegalSection>

      <LegalSection title="Organizations">
        <p>
          When you use Surfdesk as part of an organization (such as an agency), the organization decides what client
          information is kept and why, and we process it on the organization&apos;s behalf as its service provider. The
          organization&apos;s admins can see and manage its client records, staff list and activity log. If you&apos;re a
          client of an organization and want to see, correct or delete your information, contact that organization; we
          will help it respond.
        </p>
        <ul>
          <li>
            <strong>Front-desk kiosk:</strong> clients who check themselves in on an organization&apos;s kiosk enter their
            first and last name and a reason for the visit, which go to that organization&apos;s records.
          </li>
          <li>
            <strong>Referral links:</strong> people who send a referral through an organization&apos;s public referral
            link enter the client&apos;s details (such as name, phone, date of birth and needed services) and their own
            name and contact details, which go only to that organization.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Calendar sync">
        <ul>
          <li>
            <strong>Showing other calendars in Surfdesk:</strong> if you paste a private calendar link, we store the link
            and use it only to fetch that calendar&apos;s events while you look at your Surfdesk calendar. Events are kept in
            memory for a few minutes and aren&apos;t saved to our database. Remove the link any time in Settings →
            Calendar.
          </li>
          <li>
            <strong>Seeing Surfdesk in other calendars:</strong> your private Surfdesk calendar link shares the titles and due
            times of your open tasks, never notes or client details. If you subscribe to it in Google, Apple or Outlook,
            that company stores a copy under its own privacy policy. Anyone with the link can see those tasks; you can
            replace it in Settings → Calendar.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="How we use it">
        <ul>
          <li>To run the app: show your records, send the reminders and summaries you turn on, and keep you signed in.</li>
          <li>To keep accounts secure: sign-in, email confirmation, password reset, two-factor authentication and abuse prevention.</li>
          <li>
            To send emails about your account: confirmations, password resets, a welcome, trial reminders (before a
            trial ends and when it has ended) and payment problems.
          </li>
          <li>
            To send occasional tips on using the app. Every tip email has a one-click unsubscribe link; emails about your
            account and billing still arrive.
          </li>
          <li>To answer your support requests and fix problems.</li>
          <li>To bill your subscription, and to keep records of payments and of your agreement to these terms.</li>
        </ul>
        <p>We don&apos;t sell or rent personal information, share it for advertising, or use it to build ad profiles.</p>
      </LegalSection>

      <LegalSection title="Text messages (SMS)">
        <p>
          If you add a mobile number and opt in under Settings, we send text reminders about your tasks. Message
          frequency varies with the reminders you set. Message and data rates may apply. Reply <strong>STOP</strong> to
          opt out at any time, or <strong>HELP</strong> for help. You can also turn texts off in Settings.
        </p>
        <p>
          Your mobile number and text-messaging consent are never sold or shared with third parties or affiliates for
          marketing or promotional purposes. They are shared only with our text-messaging provider to deliver the
          messages you asked for.
        </p>
      </LegalSection>

      <LegalSection title="AI features">
        <p>Some features use AI providers to understand what you type or say:</p>
        <ul>
          <li>
            <strong>Command bar:</strong> the sentence you type or say (for example &quot;Remind me to call Ana Friday at
            3&quot;) can be sent to the AI provider to work out what to create. It may include names you mention.
          </li>
          <li>
            <strong>Voice:</strong> on devices without built-in speech recognition (such as iPhone), your recording is
            sent to OpenAI to turn it into text. Elsewhere your browser&apos;s own speech recognition is used.
          </li>
          <li>
            <strong>Person summaries:</strong> when you add a note, the person&apos;s name, their five most recent notes
            and their open task titles can be sent to the AI provider to write a short summary on their profile.
          </li>
        </ul>
        <p>
          We use OpenAI and Anthropic through their business APIs. Under their terms they don&apos;t use this data to
          train their models; they may keep it for a short time (up to 30 days) to detect abuse, then delete it. We
          send only what the feature needs, never your whole account. If an AI provider isn&apos;t available, the app
          falls back to its own built-in rules, which don&apos;t send anything. Please don&apos;t say or type sensitive
          details (such as medical information) into these features. AI can make mistakes, so check what it creates.
        </p>
      </LegalSection>

      <LegalSection title="Who processes data for us">
        <p>We use these service providers, which process data only on our instructions and only to run the app:</p>
        <ul>
          <li>Supabase: database and sign-in (data stored in the United States).</li>
          <li>Stripe: payments and subscriptions.</li>
          <li>Vercel: hosting.</li>
          <li>Resend: account emails.</li>
          <li>Twilio: text messages, if you opt in.</li>
          <li>Apple, Google and Mozilla push services: delivering push notifications you turn on.</li>
          <li>Cloudflare: bot protection on sign-in forms.</li>
          <li>Open-Meteo: local weather (receives only a rounded, approximate location).</li>
          <li>OpenAI and Anthropic: AI features (see AI features above).</li>
        </ul>
        <p>
          Where voice uses your browser&apos;s built-in speech recognition, the browser maker (such as Google) may
          process that audio under its own privacy policy.
        </p>
        <p>
          We may also disclose information if the law requires it, to protect the safety of any person, or as part of a
          sale or reorganization of the business, in which case this policy continues to apply.
        </p>
      </LegalSection>

      <LegalSection title="Cookies">
        <p>
          We use only the cookies the app needs to work, such as keeping you signed in and signing you out after
          inactivity. We don&apos;t use advertising or third-party tracking cookies.
        </p>
      </LegalSection>

      <LegalSection title="How we protect it">
        <p>
          Data is encrypted in transit and at rest. Access is restricted by account at the database level, and you can
          turn on two-factor authentication and automatic sign-out after inactivity. No system is perfectly secure; if a
          breach affects your information, we&apos;ll notify you as the law requires.
        </p>
      </LegalSection>

      <LegalSection title="Health information">
        <p>
          Surfdesk isn&apos;t designed to hold medical records. Don&apos;t enter protected health information
          (such as diagnoses or treatment details) unless your organization has a written agreement with us that covers
          it.
        </p>
      </LegalSection>

      <LegalSection title="Keeping and deleting your data">
        <p>
          We keep your data while your account is open. You can export it any time (Settings → Data) and delete your
          account and all its data in the app (Settings → Your data → Delete account). See{" "}
          <a href="/account-deletion">how to delete your account</a>. Deleted data is removed right away from the live
          database and may remain in encrypted backups for up to 30 days before it&apos;s overwritten. Payment records
          held by Stripe are kept as long as tax and accounting laws require. Client records that belong to an
          organization stay with the organization when a staff member leaves or deletes their own account.
        </p>
      </LegalSection>

      <LegalSection title="Your rights">
        <p>
          You can access, correct, export or delete your information at any time, in the app or by emailing {mail}. If
          you live in California, you also have the right to know what we collect and how it&apos;s used, to request
          deletion or correction, and not to be discriminated against for exercising these rights. We don&apos;t sell
          or share personal information as those terms are defined under California law. We&apos;ll respond to
          requests within 45 days.
        </p>
      </LegalSection>

      <LegalSection title="Children">
        <p>
          The app isn&apos;t meant for children under 13, and we don&apos;t knowingly collect information from them. If
          you believe a child has given us information, email {mail} and we&apos;ll delete it.
        </p>
      </LegalSection>

      <LegalSection title="Changes to this policy">
        <p>
          If we make significant changes, we&apos;ll update the date above and ask you to agree to the new version in the
          app before you keep using it.
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>
          Sonder Project, California, USA. Email {mail}, or use Settings → About &amp; help → Contact support in the app.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
