import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/legal/LegalPage";
import { SUPPORT_EMAIL } from "@/lib/settings-options";

export const metadata: Metadata = {
  title: "Privacy policy · sonderthreads",
  description: "What Sonder Threads collects, how it's used and protected, and your choices.",
  alternates: { canonical: "/privacy" },
};

const mail = <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>;

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy" updated="November 9, 2026">
      <p>
        Sonder Threads (&quot;the app&quot;) is run by Sonder Project, a sole proprietorship based in California
        (&quot;we&quot;, &quot;us&quot;). This policy explains what we collect when you use the app at sonderthreads.com
        and in its mobile apps, how we use it, and the choices you have. We don&apos;t sell your data, and we don&apos;t
        use it for advertising.
      </p>

      <LegalSection title="What we collect">
        <ul>
          <li>
            <strong>Your account:</strong> email address, password (stored only as a secure hash by our sign-in
            provider), name and mobile number if you add them, two-factor authentication settings, and your
            settings.
          </li>
          <li>
            <strong>What you enter:</strong> people and client profiles (such as name, date of birth, phone, email,
            gender, income level and ethnicity), notes, tasks, lists, check-ins and reminders.
          </li>
          <li>
            <strong>Device and usage data:</strong> time zone, push notification subscriptions, and standard server
            logs (such as IP address, browser type and the time of requests) used for security and troubleshooting.
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

      <LegalSection title="How we use it">
        <ul>
          <li>To run the app: show your records, send the reminders and summaries you turn on, and keep you signed in.</li>
          <li>To keep accounts secure: sign-in, email confirmation, password reset, two-factor authentication and abuse prevention.</li>
          <li>To send account emails, such as confirmations and password resets.</li>
          <li>To answer your support requests and fix problems.</li>
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

      <LegalSection title="Who processes data for us">
        <p>We use these service providers, which process data only on our instructions and only to run the app:</p>
        <ul>
          <li>Supabase: database and sign-in (data stored in the United States).</li>
          <li>Vercel: hosting.</li>
          <li>Resend: account emails.</li>
          <li>Twilio: text messages, if you opt in.</li>
          <li>Apple, Google and Mozilla push services: delivering push notifications you turn on.</li>
          <li>Cloudflare: bot protection on sign-in forms.</li>
          <li>Open-Meteo: local weather (receives only a rounded, approximate location).</li>
        </ul>
        <p>
          Voice dictation uses your device&apos;s or browser&apos;s built-in speech recognition. Depending on your
          browser, the browser maker (such as Apple or Google) may process that audio under its own privacy policy.
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
          Sonder Threads isn&apos;t designed to hold medical records. Don&apos;t enter protected health information
          (such as diagnoses or treatment details) unless your organization has a written agreement with us that covers
          it.
        </p>
      </LegalSection>

      <LegalSection title="Keeping and deleting your data">
        <p>
          We keep your data while your account is open. You can export it any time (Settings → Data) and delete your
          account and all its data in the app (Settings → Account → Delete account). See{" "}
          <a href="/account-deletion">how to delete your account</a>. Deleted data is removed right away from the live
          database and may remain in encrypted backups for up to 30 days before it&apos;s overwritten.
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
          If we make significant changes, we&apos;ll update the date above and let you know in the app or by email
          before they take effect.
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>Sonder Project, California, USA. Email {mail}.</p>
      </LegalSection>
    </LegalPage>
  );
}
