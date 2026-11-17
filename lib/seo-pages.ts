/**
 * Public SEO landing pages: /for/<audience>, /compare/<rival>, /templates/<template>.
 * Content lives here; components/marketing/SeoPage.tsx renders it.
 * Keep claims about other products general and dated (see COMPARE_NOTE) — never invent their prices or features.
 */

export type SeoFeature = { title: string; body: string };
export type SeoFaq = { q: string; a: string };

export type SeoPageData = {
  slug: string;
  /** <title>, ≤ 60 characters. */
  title: string;
  /** Meta description, ≤ 160 characters. */
  description: string;
  eyebrow: string;
  h1: string;
  /** Part of the h1 shown in the accent color (must appear at the end of h1). */
  h1Accent?: string;
  lede: string;
  painTitle: string;
  pains: string[];
  featuresTitle: string;
  features: SeoFeature[];
  /** Optional comparison table: [row, surfdesk, other]. */
  table?: { other: string; rows: [string, string, string][] };
  /** Optional downloadable file (in public/downloads). */
  download?: { href: string; label: string; what: string[] };
  faqs: SeoFaq[];
  /** Which signup to send people to. */
  cta: "solo" | "team" | "any";
};

export const COMPARE_NOTE =
  "Details about other products are summarized from their public websites as of November 2026 and may change. Check their sites for current pricing and features.";

const PRICING_FAQ: SeoFaq = {
  q: "How much does Surfdesk cost?",
  a: "Individual is $9 a month with a 7-day free trial and no card needed. Small Team is $19 per user per month for 2–18 people. Organization is $349 a month for 19 or more, with 20 seats included and extra seats at $15. Team plans include a 14-day free trial, and skipping the trial gets you 30% off your first month.",
};

export const AUDIENCE_PAGES: SeoPageData[] = [
  {
    slug: "nonprofits",
    title: "Case Management Software for Small Nonprofits | Surfdesk",
    description:
      "Simple case management software for small nonprofits: shared caseload, check-ins, outcomes and funder-ready Impact reports in one click. Free 14-day trial.",
    eyebrow: "Surfdesk for nonprofits",
    h1: "Case management software small nonprofits actually use.",
    h1Accent: "actually use.",
    lede:
      "Surfdesk gives your team one shared caseload, check-ins that never slip and outcomes counted as you work — so the funder report builds itself instead of eating the last week of every quarter.",
    painTitle: "Sound familiar?",
    pains: [
      "Case notes live in five places: a spreadsheet, a shared drive, sticky notes and someone's head.",
      "Reporting week means hand-counting people served and outcomes from old notes.",
      "Big case management systems cost too much and take months to set up.",
      "When a staff member leaves, their caseload history goes with them.",
    ],
    featuresTitle: "Everything a small program needs, nothing it doesn't",
    features: [
      { title: "Shared caseload", body: "Everyone works from one client list, with roles so managers see what they need and nothing more." },
      { title: "Check-ins that don't slip", body: "Every follow-up on one Today list, with reminders on your phone." },
      { title: "Outcomes as you work", body: "Mark “got a job” or “found housing” in a sentence. Surfdesk counts it." },
      { title: "Impact report in one click", body: "People served, outcomes reached and demographics as a polished PDF with your logo." },
      { title: "Front-desk check-in", body: "A kiosk mode lets clients sign in themselves when they arrive." },
      { title: "Set up in an afternoon", body: "Import your existing list from a spreadsheet and start the same day." },
    ],
    faqs: [
      { q: "Is Surfdesk HIPAA compliant?", a: "Surfdesk encrypts data in transit and at rest and separates every organization with database-level access rules. It is not marketed as a HIPAA-covered system; if you handle protected health information, talk to us about your requirements before you start." },
      { q: "Can we import our current client list?", a: "Yes. Import from Excel or CSV, and Organization plans include onboarding help and data import." },
      { q: "Does it work for small teams with no IT staff?", a: "Yes. Surfdesk runs in the browser on any phone or computer, with nothing to install or maintain." },
      PRICING_FAQ,
    ],
    cta: "team",
  },
  {
    slug: "case-managers",
    title: "Case Management App for Case Managers | Surfdesk",
    description:
      "A case management app built for case managers: quick case notes by voice, follow-up reminders, outcomes and reports from your phone. Try Surfdesk free.",
    eyebrow: "Surfdesk for case managers",
    h1: "Your caseload, on your phone, under control.",
    h1Accent: "under control.",
    lede:
      "Say it once — “met with Ava, housing approved, check in Friday” — and Surfdesk writes the note, sets the reminder and records the outcome. Less documentation, more time with clients.",
    painTitle: "The paperwork problem",
    pains: [
      "You write the same note three times: in the field, in the system and in your follow-up list.",
      "Check-ins get missed when you're juggling dozens of clients.",
      "Your notes app has no idea who your clients are.",
    ],
    featuresTitle: "Built for working in the field",
    features: [
      { title: "Voice case notes", body: "Speak a sentence and it becomes a dated note on the right client." },
      { title: "Today list", body: "Every check-in and follow-up due today, in one place." },
      { title: "Full client history", body: "Notes, check-ins, outcomes and tasks for each person on one page." },
      { title: "Works on any phone", body: "Add it to your home screen like an app. No laptop required." },
    ],
    faqs: [
      { q: "Can I use Surfdesk on my own before my agency adopts it?", a: "Yes. Start on the Individual plan for $9 a month, then move to a team plan later." },
      { q: "Are my personal tasks visible to my manager?", a: "No. Your tasks and personal notes stay private to you. Managers can read client records and leave comments." },
      PRICING_FAQ,
    ],
    cta: "solo",
  },
  {
    slug: "realtors",
    title: "Simple CRM for Realtors & Real Estate Agents | Surfdesk",
    description:
      "A simple real estate CRM for agents: every buyer, seller and follow-up in one app, with voice notes and reminders. $9/mo, 7-day free trial, no card needed.",
    eyebrow: "Surfdesk for realtors",
    h1: "The simple CRM for real estate agents who hate CRMs.",
    h1Accent: "who hate CRMs.",
    lede:
      "Every buyer, seller and past client with their full history, and a reminder for every follow-up. Say “showed 412 Elm to the Parks, follow up Monday” and it's handled.",
    painTitle: "Why agents lose deals",
    pains: [
      "Leads go cold because the follow-up lived on a sticky note.",
      "Big real estate CRMs are built for teams with an assistant to run them.",
      "Past clients never hear from you again — and refer someone else.",
    ],
    featuresTitle: "Follow up like a top producer",
    features: [
      { title: "Every contact, one place", body: "Buyers, sellers, past clients and referral partners with notes and history." },
      { title: "Never miss a follow-up", body: "Reminders for showings, callbacks and closing anniversaries." },
      { title: "Voice notes in the car", body: "Speak your notes between showings. Surfdesk files them." },
      { title: "See what brings in money", body: "Track deals and services to see where your income comes from." },
    ],
    faqs: [
      { q: "Does Surfdesk replace my MLS or transaction software?", a: "No. Surfdesk is where you keep your people and follow-ups. Use it alongside your MLS and transaction tools." },
      { q: "Can my team share it?", a: "Yes. The Small Team plan gives your team a shared client list for $19 per user per month." },
      PRICING_FAQ,
    ],
    cta: "solo",
  },
  {
    slug: "coaches",
    title: "Client Management App for Coaches & Consultants | Surfdesk",
    description:
      "Client management for coaches and consultants: session notes, follow-ups, tasks and revenue per client in one simple app. $9/mo with a 7-day free trial.",
    eyebrow: "Surfdesk for coaches & consultants",
    h1: "Every client, every session, every follow-up.",
    h1Accent: "every follow-up.",
    lede:
      "Keep session notes, next steps and payments for every client in one place. Say what happened after a call and Surfdesk files the note and reminds you what's next.",
    painTitle: "Coaching is personal. Your tools shouldn't be scattered.",
    pains: [
      "Session notes in one app, tasks in another, invoices in a third.",
      "You forget what you promised a client last week.",
      "You can't see which clients and services actually pay the bills.",
    ],
    featuresTitle: "A calm home for your practice",
    features: [
      { title: "Session notes", body: "Type or speak notes after each session, linked to the client." },
      { title: "Next steps", body: "Action items become tasks with reminders automatically." },
      { title: "Revenue by client and service", body: "Log what each session earned and see the totals." },
      { title: "Private by default", body: "Encrypted, never sold, and exportable any time." },
    ],
    faqs: [
      { q: "Is Surfdesk a scheduling tool?", a: "Surfdesk tracks clients, notes, tasks and follow-ups, and syncs tasks to your calendar. Keep your booking tool for scheduling." },
      PRICING_FAQ,
    ],
    cta: "solo",
  },
  {
    slug: "small-business",
    title: "Simple Customer Tracker for Small Businesses | Surfdesk",
    description:
      "A simple customer tracker for small businesses: every regular, service and follow-up in one app, plus revenue by service. Free trial, from $9 a month.",
    eyebrow: "Surfdesk for small businesses",
    h1: "Know every regular. Keep every customer.",
    h1Accent: "Keep every customer.",
    lede:
      "Surfdesk keeps each customer's history, the services they bought and when to reach out next — so regulars stay regulars and you can see what actually makes money.",
    painTitle: "Running on memory doesn't scale",
    pains: [
      "Customer details live in your texts, your notebook and your head.",
      "Regulars drift away and you only notice months later.",
      "You can't tell which services are worth your time.",
    ],
    featuresTitle: "A customer list that works for you",
    features: [
      { title: "Customer history", body: "Visits, notes and purchases for every customer on one page." },
      { title: "Reminders to reach out", body: "Get nudged when a regular hasn't been back." },
      { title: "Revenue by service", body: "See which services bring in the money each month." },
      { title: "Team ready", body: "Add staff on the Small Team plan with one shared list." },
    ],
    faqs: [
      { q: "Is this a point-of-sale system?", a: "No. Surfdesk tracks customers, visits and follow-ups. Keep your POS for payments." },
      PRICING_FAQ,
    ],
    cta: "any",
  },
];

export const COMPARE_PAGES: SeoPageData[] = [
  {
    slug: "spreadsheets",
    title: "Surfdesk vs Spreadsheets for Tracking Clients",
    description:
      "Still tracking clients in Excel or Google Sheets? Compare spreadsheets with Surfdesk: reminders, case notes, outcomes and reports without the manual work.",
    eyebrow: "Surfdesk vs spreadsheets",
    h1: "Outgrown your client spreadsheet?",
    h1Accent: "client spreadsheet?",
    lede:
      "Spreadsheets are free and flexible — until you need reminders, history, a team and a report. Here's an honest look at when to switch.",
    painTitle: "Where spreadsheets break",
    pains: [
      "No reminders: follow-ups depend on someone remembering to look.",
      "Notes get crammed into one cell with no history.",
      "Two people editing at once overwrite each other.",
      "Every report means filtering, counting and copy-pasting by hand.",
    ],
    featuresTitle: "What you get by switching",
    features: [
      { title: "Reminders built in", body: "Every follow-up has a date and shows up on your Today list." },
      { title: "Real history", body: "Every note and check-in is dated and kept on the client's page." },
      { title: "Reports in one click", body: "People served, outcomes and revenue, counted for you." },
      { title: "Bring your sheet", body: "Import your existing spreadsheet in minutes. Export back any time." },
    ],
    table: {
      other: "Spreadsheet",
      rows: [
        ["Follow-up reminders", "Built in, on your phone", "Manual"],
        ["Notes per client", "Dated history on each client", "One cell, overwritten"],
        ["Team access with roles", "Admin, Manager, Member", "Share link, all-or-nothing"],
        ["Reports", "One-click PDF", "Build by hand"],
        ["Cost", "From $9/month", "Free"],
      ],
    },
    faqs: [
      { q: "Can I import my spreadsheet?", a: "Yes. Upload an Excel or CSV file and map the columns to Surfdesk fields." },
      { q: "When should I stay on a spreadsheet?", a: "If you track a handful of people, rarely follow up and never report, a spreadsheet is fine. Surfdesk pays off once follow-ups and reporting start costing you time." },
      PRICING_FAQ,
    ],
    cta: "any",
  },
  {
    slug: "hubspot",
    title: "Surfdesk vs HubSpot CRM: Simpler Client Tracking",
    description:
      "HubSpot is built for sales and marketing pipelines. Surfdesk is a simple client tracker for nonprofits, agencies and solo pros. Compare which fits your work.",
    eyebrow: "Surfdesk vs HubSpot",
    h1: "HubSpot is built for pipelines. Surfdesk is built for people.",
    h1Accent: "Surfdesk is built for people.",
    lede:
      "HubSpot is a powerful sales and marketing platform. If your work is ongoing relationships — clients, cases, regulars — rather than deals moving through stages, Surfdesk is the simpler fit.",
    painTitle: "When HubSpot feels like too much",
    pains: [
      "You don't run a sales pipeline, but the CRM is organized around one.",
      "Most features are for marketing teams you don't have.",
      "Costs grow with seats and add-ons as your team grows.",
    ],
    featuresTitle: "What Surfdesk does differently",
    features: [
      { title: "Clients, not deals", body: "Built around ongoing relationships: check-ins, notes and outcomes." },
      { title: "Say it once", body: "One sentence becomes a note, a reminder and an outcome." },
      { title: "Impact reports", body: "Outcome reporting for funders and boards, which sales CRMs don't focus on." },
      { title: "Flat, simple pricing", body: "From $9 a month, and an Organization plan that gets cheaper per seat as you grow." },
    ],
    table: {
      other: "HubSpot CRM",
      rows: [
        ["Built for", "Client relationships, cases, regulars", "Sales and marketing pipelines"],
        ["Outcome & impact reporting", "Built in", "Not a core feature"],
        ["Voice notes to tasks", "Built in", "Not a core feature"],
        ["Free plan", "Free trial, then from $9/month", "Free plan with limits; paid seats extra"],
        ["Learning curve", "Minutes", "Larger platform to learn"],
      ],
    },
    faqs: [
      { q: "Should a sales team use Surfdesk instead of HubSpot?", a: "Probably not. If you need deal pipelines, email marketing and sales automation, HubSpot is the stronger choice. Surfdesk is for people who manage ongoing client relationships." },
      PRICING_FAQ,
    ],
    cta: "any",
  },
];

export const TEMPLATE_PAGES: SeoPageData[] = [
  {
    slug: "funder-impact-report",
    title: "Free Funder Impact Report Template (CSV) | Surfdesk",
    description:
      "Free impact report template for nonprofits: track people served, services and outcomes by month, ready for funders and boards. Download the CSV free.",
    eyebrow: "Free template",
    h1: "Free funder impact report template.",
    h1Accent: "impact report template.",
    lede:
      "A ready-made spreadsheet for tracking people served, services delivered and outcomes reached each month — the numbers funders and boards ask for. Download it free, no sign-up.",
    painTitle: "What funders usually want to see",
    pains: [
      "Unduplicated people served in the period",
      "Services or sessions delivered",
      "Outcomes reached (e.g. employment, housing, program completion)",
      "Progress against the targets in your grant",
    ],
    featuresTitle: "How to use the template",
    features: [
      { title: "1. Log each month", body: "Fill one row per month with people served, services and each outcome." },
      { title: "2. Set your targets", body: "Add your grant targets in the Target row to see progress." },
      { title: "3. Share", body: "Paste the totals into your report or attach the sheet." },
      { title: "Or skip the spreadsheet", body: "Surfdesk counts all of this as your team works and builds the PDF in one click." },
    ],
    download: {
      href: "/downloads/funder-impact-report-template.csv",
      label: "Download the template (CSV)",
      what: ["Monthly rows for a full year", "People served, new clients and services delivered", "Four outcome columns you can rename", "Target and total rows"],
    },
    faqs: [
      { q: "What's the difference between outputs and outcomes?", a: "Outputs are what you did (sessions held, people served). Outcomes are the change that resulted (someone got a job or stable housing). Funders increasingly ask for both." },
      { q: "Does it open in Excel and Google Sheets?", a: "Yes. It's a standard CSV file that opens in Excel, Google Sheets and Numbers." },
    ],
    cta: "team",
  },
  {
    slug: "client-follow-up-tracker",
    title: "Free Client Follow-Up Tracker Template (CSV) | Surfdesk",
    description:
      "Free client follow-up tracker template: every client, last contact, next follow-up date and notes in one sheet. Download the CSV for Excel or Google Sheets.",
    eyebrow: "Free template",
    h1: "Free client follow-up tracker template.",
    h1Accent: "follow-up tracker template.",
    lede:
      "A simple sheet to track every client, when you last spoke and when to follow up next. Works in Excel and Google Sheets. Download it free, no sign-up.",
    painTitle: "Why follow-ups slip",
    pains: [
      "The next step isn't written down anywhere.",
      "Nobody owns the follow-up on a shared list.",
      "There's no single view of who's overdue.",
    ],
    featuresTitle: "How to use the tracker",
    features: [
      { title: "1. One row per client", body: "Name, contact, owner and status." },
      { title: "2. Always set a next date", body: "Every row gets a next follow-up date and the next step." },
      { title: "3. Sort by date each morning", body: "Sort by Next follow-up to see who's due today." },
      { title: "Or let it remind you", body: "Surfdesk puts every follow-up on your Today list and reminds you on your phone." },
    ],
    download: {
      href: "/downloads/client-follow-up-tracker-template.csv",
      label: "Download the tracker (CSV)",
      what: ["Client, contact and owner columns", "Last contact and next follow-up dates", "Status and next step", "Example rows to copy"],
    },
    faqs: [
      { q: "How often should I follow up with clients?", a: "It depends on the relationship, but the key is that every client always has a next date. Weekly for active cases or deals, monthly or quarterly for past clients is a common starting point." },
    ],
    cta: "solo",
  },
];

export const ALL_SEO_PAGES = [
  ...AUDIENCE_PAGES.map((p) => ({ ...p, path: `/for/${p.slug}` })),
  ...COMPARE_PAGES.map((p) => ({ ...p, path: `/compare/${p.slug}` })),
  ...TEMPLATE_PAGES.map((p) => ({ ...p, path: `/templates/${p.slug}` })),
];
