import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/legal/LegalPage";
import { SUPPORT_EMAIL } from "@/lib/settings-options";
import { LEGAL_UPDATED, LEGAL_VERSION } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Terms of service · Surfdesk",
  description: "The terms for using Surfdesk.",
  alternates: { canonical: "/terms" },
};

const mail = <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>;

export default function TermsPage() {
  return (
    <LegalPage title="Terms of service" updated={LEGAL_UPDATED}>
      <p>
        These terms are an agreement between you and Sonder Project, a sole proprietorship based in California
        (&quot;we&quot;, &quot;us&quot;), for your use of Surfdesk at thesurfdesk.app and in its mobile apps
        (&quot;the app&quot;; formerly called Strynd, at strynd.com). You agree to these terms and to our <a href="/privacy">privacy policy</a> when you
        tick the box to create an account, set up or join an organization, or keep using the app after we ask you to
        agree to an updated version. We keep a record of which version you agreed to and when (version {LEGAL_VERSION}).
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

      <LegalSection title="Organizations">
        <p>If you set up or run an organization (an agency or team) in the app:</p>
        <ul>
          <li>
            the admin who creates it confirms they&apos;re authorized to accept these terms for the organization, which is
            then bound by them;
          </li>
          <li>
            client records added to the organization belong to the organization, not to the staff member who entered
            them, and stay with it when that person leaves. Each person&apos;s personal tasks, notes and lists stay
            private to them;
          </li>
          <li>
            the organization decides what client information to collect and why, and is responsible for having
            clients&apos; permission or another lawful basis, for giving clients any notices the law requires, and for
            answering their requests. We store and process that information only on the organization&apos;s behalf;
          </li>
          <li>
            admins can add, deactivate and change the roles of staff, see the organization&apos;s client records and
            activity log, and manage billing. Staff who join agree to follow these terms and the organization&apos;s
            rules when handling client information;
          </li>
          <li>
            if the organization uses the front-desk kiosk or a public referral link, it&apos;s responsible for how
            they&apos;re used, including telling clients and referrers how their information will be handled.
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
          Surfdesk is a work and organizing tool. It doesn&apos;t replace any official system of record (such as
          HMIS or an agency case file) that you&apos;re required to use, and you remain responsible for keeping those
          systems accurate.
        </p>
      </LegalSection>

      <LegalSection title="Calendar sync">
        <p>
          You can show events from another calendar (such as Google, Apple or Outlook) in Surfdesk by pasting its private
          link, and subscribe to your Surfdesk tasks from another calendar using your own private link. Only link
          calendars you&apos;re allowed to share. Anyone who has your Surfdesk calendar link can see the task titles and due
          times in it, so keep it private; you can replace it in Settings → Calendar at any time. Once another calendar
          service copies your tasks, its own terms apply to that copy.
        </p>
      </LegalSection>

      <LegalSection title="Text messages">
        <p>
          If you opt in to text reminders, you agree to receive them at the number you provide. Message frequency varies.
          Message and data rates may apply. Reply STOP to opt out or HELP for help. Carriers aren&apos;t liable for
          delayed or undelivered messages.
        </p>
      </LegalSection>

      <LegalSection title="Fees, renewal and cancellation" id="fees">
        <p>
          <strong>Your plan renews automatically every month until you cancel.</strong> We charge the card on file at the
          start of each monthly period. Payments are processed by Stripe.
        </p>
        <ul>
          <li>
            <strong>Individual:</strong> $9 a month after a 7-day free trial. The trial doesn&apos;t need a card; to keep
            using Surfdesk after it, add one. If you add a card during the trial, you&apos;re charged $9 when the trial
            ends, and every month after that, unless you cancel before the trial ends. Until a card is on file, imports
            are limited (up to 25 people, and no backup restores). Free trials are limited to one per person and card.
          </li>
          <li>
            <strong>Teams and organizations:</strong> billed for the number of seats the organization buys (at least 2):
            $19 per seat a month for up to 18 seats, $349 a month for 19 or 20 seats, and $15 a month for each seat over 20,
            after a 14-day free trial. Starting the trial needs a payment card; the organization is charged for its seats
            when the trial ends unless an admin cancels first (organizations created before November 12, 2026 keep the
            30-day trial they started with). Adding or removing seats changes the monthly charge, and the difference for the
            current month is prorated. Enterprise pricing is agreed in writing.
          </li>
        </ul>
        <p>
          <strong>Skipping the trial:</strong> instead of a free trial, you can start paying right away with 30% off
          your first month (one time, on a first subscription). You&apos;re charged when you subscribe.
        </p>
        <p>
          <strong>How to cancel:</strong> any time, online, in Settings → Subscription (organization admins cancel for
          their organization). Cancelling stops the next renewal; you keep access until the end of the month you&apos;ve
          already paid for. When you cancel we may offer you a lower price to stay, which you&apos;re free to decline.
          You can also email {mail} to cancel.
        </p>
        <p>
          <strong>Refunds:</strong> payments aren&apos;t refundable and we don&apos;t give credit for partial months,
          except where the law requires it or we tell you otherwise in writing.
        </p>
        <p>
          If a trial ends without a subscription or a payment fails, your account becomes view-only: you can still see
          and export everything. Accounts created before November 10, 2026 are free for life. If prices change,
          we&apos;ll tell you at least 30 days before the change applies to you, and you can cancel before then.
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
          You can delete your account at any time in Settings → Your data. We may suspend or close an account that breaks these
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
          If we make significant changes, we&apos;ll update the date above and ask you to agree to the new version in the
          app before you keep using it. If you don&apos;t agree, you can export your data and delete your account.
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
