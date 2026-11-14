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
        <p>
          <strong>How we handle an organization&apos;s client data.</strong> For client information an organization
          keeps in the app, the organization is in charge and we act as its service provider. We:
        </p>
        <ul>
          <li>process it only to provide the app, following the organization&apos;s instructions in its use of the app;</li>
          <li>don&apos;t sell it, share it for advertising, or use it for any other purpose;</li>
          <li>
            use only the service providers listed in our <a href="/privacy">privacy policy</a>, who are bound to protect
            it, and list any new ones there before we start using them;
          </li>
          <li>keep it protected with access controls and encryption, and limit our own access to what&apos;s needed to run and support the app;</li>
          <li>tell the organization&apos;s admins without undue delay if we learn of a breach affecting its data;</li>
          <li>
            help the organization answer clients&apos; requests to see, correct or delete their information; and
          </li>
          <li>
            when the organization closes its account, let its admins export the data first, then delete it (backups
            are overwritten within 30 days).
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Our app and brand" id="ip">
        <p>
          Your content is yours. Everything else is ours: the Surfdesk app and website, including its software and code,
          design, look and feel, screens and layouts, workflows and features, text, reports, templates, graphics and
          documentation, and the Surfdesk and Sonder Project names, logos and brand (&quot;our materials&quot;). Our
          materials are protected by copyright, trademark and other laws.
        </p>
        <p>
          While your account is in good standing, we give you a personal, limited, non-exclusive, non-transferable right
          to use the app for your own work or your organization&apos;s work, under these terms. Nothing else is licensed
          to you, and we keep all rights we don&apos;t expressly give.
        </p>
        <p>
          <strong>You agree not to copy us.</strong> You won&apos;t, and won&apos;t help anyone else to:
        </p>
        <ul>
          <li>
            copy, reproduce, imitate or create derivative works from our materials, including recreating the app&apos;s
            design, screens, workflows, features or text in another product;
          </li>
          <li>
            use the app, or what you learn from using it, to design, build, train or market a product or service that
            competes with Surfdesk;
          </li>
          <li>
            access the app to research or benchmark it for a competing product, or sign up on behalf of a competitor,
            without our written permission;
          </li>
          <li>
            decompile, disassemble or reverse engineer the app, or copy its source code, except where the law expressly
            allows it despite this limit;
          </li>
          <li>
            scrape, crawl or extract content or data from the app by automated means, other than exporting your own
            data with the app&apos;s export features;
          </li>
          <li>
            use the Surfdesk or Sonder Project names, logos or brand, or anything confusingly similar, in a product name,
            domain, account name or ad, or suggest we endorse you, without our written permission; or
          </li>
          <li>remove or hide any copyright, trademark or other notices in the app.</li>
        </ul>
        <p>
          If you break this section, we may close your account immediately and seek every remedy the law allows,
          including a court order to stop the copying. Because copying could cause harm money alone can&apos;t fix, you
          agree we may ask a court for that order (see the exceptions in Resolving disputes).
        </p>
        <p>
          <strong>Feedback:</strong> if you send us ideas or suggestions, we may use them freely, without owing you
          anything, and you won&apos;t claim any rights in what we build with them.
        </p>
      </LegalSection>

      <LegalSection title="Acceptable use">
        <p>Don&apos;t:</p>
        <ul>
          <li>break the law, or harass, harm or spam anyone using the app;</li>
          <li>try to access other people&apos;s accounts or data, or get around security features;</li>
          <li>disrupt or overload the app, or test its security without our written permission;</li>
          <li>resell, rent or share access to the app, or let someone outside your account or organization use it;</li>
          <li>break the &quot;Our app and brand&quot; section above.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Other systems you use">
        <p>
          Surfdesk is a work and organizing tool. It doesn&apos;t replace any official system of record (such as
          HMIS or an agency case file) that you&apos;re required to use, and you remain responsible for keeping those
          systems accurate.
        </p>
      </LegalSection>

      <LegalSection title="Reports, outcomes and AI">
        <p>
          Reports, outcomes, summaries and insights are built from what you and your staff enter. They&apos;re only as
          complete and accurate as that information, and you&apos;re responsible for checking them before you rely on
          them or share them (for example with a funder, board or government agency). They aren&apos;t official
          reporting for any government program, and nothing in the app is legal, medical, financial or other
          professional advice.
        </p>
        <p>
          Some features use AI to understand what you type or say and to write summaries (see the{" "}
          <a href="/privacy">privacy policy</a>). AI can make mistakes: check what it creates, and don&apos;t rely on it
          alone for decisions about people.
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

      <LegalSection title="Resolving disputes" id="disputes">
        <p>
          <strong>
            Please read this section carefully. It says disputes are settled by individual arbitration instead of in
            court, and that class actions aren&apos;t allowed. You can opt out within 30 days (see below).
          </strong>
        </p>
        <p>
          <strong>Talk to us first.</strong> If you have a problem with the app or these terms, email {mail} with a
          description and what you&apos;d like us to do. We&apos;ll try to resolve it with you informally within 30
          days, and we&apos;ll do the same before bringing any claim against you.
        </p>
        <p>
          <strong>Arbitration.</strong> If we can&apos;t resolve it, any dispute between you and us relating to the app or
          these terms will be decided by binding individual arbitration administered by the American Arbitration
          Association (AAA) under its Consumer Arbitration Rules (or its Commercial Arbitration Rules if you use the app
          for an organization), instead of in court. The Federal Arbitration Act governs this section. The arbitration
          can take place by video or phone, or in the county where you live. For claims under $10,000 by an individual,
          we&apos;ll pay the AAA filing, administration and arbitrator fees, unless the arbitrator finds the claim was
          frivolous.
        </p>
        <p>
          <strong>Exceptions.</strong> Either of us may instead bring an individual claim in small claims court if it
          qualifies, and either of us may ask a court to stop infringement or misuse of intellectual property or the
          app.
        </p>
        <p>
          <strong>No class actions.</strong> Claims may be brought only individually, not as a plaintiff or class member
          in any class, collective or representative action, and the arbitrator can&apos;t combine claims of more than
          one person. If this class-action waiver is found unenforceable for a claim, that claim must be decided in
          court, not arbitration.
        </p>
        <p>
          <strong>Opting out.</strong> You can opt out of arbitration by emailing {mail} within 30 days of first agreeing
          to these terms, with your name, account email and a statement that you opt out of arbitration. Opting out
          doesn&apos;t affect anything else in these terms.
        </p>
        <p>
          <strong>Governing law and courts.</strong> These terms are governed by the laws of the State of California and
          applicable U.S. federal law, without regard to conflict-of-law rules. Anything not decided in arbitration or
          small claims court will be handled in the state or federal courts located in California, unless the law where
          you live requires otherwise.
        </p>
      </LegalSection>

      <LegalSection title="General">
        <ul>
          <li>
            <strong>Events outside our control:</strong> we aren&apos;t responsible for delays or failures caused by
            things we can&apos;t reasonably control, such as outages at our hosting or service providers, internet or
            power failures, natural disasters or government actions.
          </li>
          <li>
            <strong>Assignment:</strong> you can&apos;t transfer these terms to someone else without our written
            permission. We may transfer them as part of a reorganization, merger or sale of the business (for example
            to a company we form), and they&apos;ll continue to apply.
          </li>
          <li>
            <strong>Severability:</strong> if any part of these terms can&apos;t be enforced, the rest still applies.
          </li>
          <li>
            <strong>No waiver:</strong> if we don&apos;t enforce a part of these terms right away, we can still enforce it
            later.
          </li>
          <li>
            <strong>Entire agreement:</strong> these terms and the privacy policy are the whole agreement between you
            and us about the app, and replace any earlier ones.
          </li>
          <li>
            <strong>What continues after your account ends:</strong> the sections on your content, our app and brand,
            fees owed, disclaimer, limitation of liability, indemnity and resolving disputes.
          </li>
        </ul>
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
