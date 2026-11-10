import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/legal/LegalPage";
import { SUPPORT_EMAIL } from "@/lib/settings-options";

export const metadata: Metadata = {
  title: "Terms of service · sonderthreads",
  description: "The terms for using Sonder Threads.",
  alternates: { canonical: "/terms" },
};

const mail = <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>;

export default function TermsPage() {
  return (
    <LegalPage title="Terms of service" updated="November 10, 2026">
      <p>
        These terms are an agreement between you and Sonder Project, a sole proprietorship based in California
        (&quot;we&quot;, &quot;us&quot;), for your use of Sonder Threads at sonderthreads.com and in its mobile apps
        (&quot;the app&quot;). By creating an account or using the app, you agree to these terms and to our{" "}
        <a href="/privacy">privacy policy</a>.
      </p>

      <LegalSection title="Who can use it">
        <p>
          You must be at least 18 years old and able to enter into this agreement. If you use the app for an
          organization, you confirm you&apos;re allowed to accept these terms for it.
        </p>
      </LegalSection>

      <LegalSection title="Your account">
        <ul>
          <li>Give accurate information and keep your sign-in details secret. You&apos;re responsible for activity on your account.</li>
          <li>Turn on two-factor authentication and auto-lock if others could access your device.</li>
          <li>Tell us right away at {mail} if you think your account has been accessed without permission.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Your content">
        <p>
          Everything you enter stays yours. You give us permission to store, process and display it only to run the
          app for you, as described in the privacy policy. You can export or delete it at any time.
        </p>
        <p>When you enter information about other people, such as clients, you agree that:</p>
        <ul>
          <li>you have their permission, or another lawful basis, to record and use it;</li>
          <li>you&apos;ll follow the laws and the rules of any organization or program you work for that apply to it;</li>
          <li>
            you won&apos;t enter Social Security numbers, government ID numbers, bank or card account details, or
            protected health information unless we&apos;ve agreed to it in writing.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Acceptable use">
        <p>Don&apos;t:</p>
        <ul>
          <li>break the law, or harass, harm or spam anyone using the app;</li>
          <li>try to access other people&apos;s accounts or data, or get around security features;</li>
          <li>disrupt, overload, scrape or reverse engineer the app, except where the law allows it;</li>
          <li>resell the app or use it to build a competing product.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Other systems you use">
        <p>
          Sonder Threads is a work and organizing tool. It doesn&apos;t replace any official system of record (such as
          HMIS or an agency case file) that you&apos;re required to use, and you remain responsible for keeping those
          systems accurate.
        </p>
      </LegalSection>

      <LegalSection title="Text messages">
        <p>
          If you opt in to text reminders, you agree to receive them at the number you provide. Message frequency varies.
          Message and data rates may apply. Reply STOP to opt out or HELP for help. Carriers aren&apos;t liable for
          delayed or undelivered messages.
        </p>
      </LegalSection>

      <LegalSection title="Fees">
        <p>
          Individual accounts are $9 a month after a 7-day free trial. Starting the trial needs a payment card; you're charged when the trial ends unless you cancel first. Free trials are limited to one per person, card and mobile number. Organization plans are $15 per staff member a
          month, or $249 a month for up to 20 staff and $10 for each additional staff member, after a 30-day free trial.
          Subscriptions renew monthly until cancelled, and organization charges adjust when staff are added or removed.
          Payments are processed by Stripe. You can cancel any time in Settings → Billing; you keep access until the end
          of the period you paid for. If a trial ends or a payment fails, your account becomes view-only: you can still
          see and export everything. Accounts created before November 10, 2026 are free for life. If prices change,
          we&apos;ll tell you in advance.
        </p>
      </LegalSection>

      <LegalSection title="Changes and availability">
        <p>
          We&apos;re improving the app all the time and may change or remove features. We aim to keep it available
          but can&apos;t promise it will always be uninterrupted or error-free. Keep your own copies of anything you
          can&apos;t afford to lose (Settings → Data lets you export it).
        </p>
      </LegalSection>

      <LegalSection title="Ending your account">
        <p>
          You can delete your account at any time in Settings. We may suspend or close an account that breaks these
          terms or puts others at risk; where reasonable, we&apos;ll warn you first and give you a chance to export your
          data.
        </p>
      </LegalSection>

      <LegalSection title="Disclaimer">
        <p>
          The app is provided &quot;as is&quot; and &quot;as available&quot;. To the extent the law allows, we disclaim
          all warranties, express or implied, including fitness for a particular purpose and non-infringement.
          Reminders and summaries are aids, not guarantees; don&apos;t rely on them alone for anything time-critical.
        </p>
      </LegalSection>

      <LegalSection title="Limitation of liability">
        <p>
          To the extent the law allows, we aren&apos;t liable for indirect, incidental, special, consequential or
          punitive damages, or for lost data, profits or revenue. Our total liability for any claim relating to the app
          is limited to the greater of the amount you paid us in the 12 months before the claim or $100. Some places
          don&apos;t allow these limits, so they may not apply to you.
        </p>
      </LegalSection>

      <LegalSection title="Indemnity">
        <p>
          You agree to cover our reasonable losses and costs from claims by others that arise from content you entered
          without the right to, or from your breaking these terms or the law.
        </p>
      </LegalSection>

      <LegalSection title="Governing law">
        <p>
          These terms are governed by the laws of the State of California, without regard to its conflict-of-law
          rules. Any dispute will be handled in the state or federal courts located in California, unless the law
          where you live requires otherwise.
        </p>
      </LegalSection>

      <LegalSection title="Changes to these terms">
        <p>
          If we make significant changes, we&apos;ll update the date above and let you know in the app or by email
          before they take effect. Continuing to use the app after that means you accept the new terms.
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>Sonder Project, California, USA. Email {mail}.</p>
      </LegalSection>
    </LegalPage>
  );
}
