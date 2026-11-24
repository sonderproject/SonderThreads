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
  {
    slug: "todoist",
    title: "Surfdesk vs Todoist: Tasks Plus Your Clients",
    description:
      "Todoist is a great task manager. Surfdesk keeps tasks, notes, reminders and your clients together, with visits, follow-ups and reports. Compare them.",
    eyebrow: "Surfdesk vs Todoist",
    h1: "Todoist manages tasks. Surfdesk manages your whole day.",
    h1Accent: "Surfdesk manages your whole day.",
    lede:
      "Todoist is one of the best to-do apps around. If your tasks are tied to people (clients, customers, the folks you follow up with), Surfdesk keeps the tasks, notes and the people in one place.",
    painTitle: "When a to-do app isn't enough",
    pains: [
      "Your tasks mention clients, but their notes and history live somewhere else.",
      "You keep a separate spreadsheet or CRM just to remember who's who.",
      "Reporting on visits or revenue means exporting and counting by hand.",
    ],
    featuresTitle: "What Surfdesk adds",
    features: [
      { title: "People, not just tasks", body: "Every client or customer gets a profile with notes, visits and follow-ups on one timeline." },
      { title: "Say it once", body: "“Follow up with Ana next Tuesday” becomes a task linked to Ana." },
      { title: "Reports built in", body: "Visits, revenue by service, people served and busiest times, counted for you." },
      { title: "Team chat", body: "Channels and direct chats on team plans, with clients tagged right in the message." },
    ],
    table: {
      other: "Todoist",
      rows: [
        ["Built for", "Tasks, notes and the people they're about", "Tasks and projects"],
        ["Client profiles with history", "Built in", "Not a core feature"],
        ["Visits, revenue and impact reports", "Built in", "Not a core feature"],
        ["Team chat", "Channels and direct chats (team plans)", "Comments on tasks"],
        ["Price", "Individual $9/month", "Pro $7/month billed monthly"],
      ],
    },
    faqs: [
      { q: "Should I switch if I only manage my own to-dos?", a: "If your list has nothing to do with clients or customers, Todoist is an excellent choice. Surfdesk pays off when your tasks, notes and the people they're about need to live together." },
      { q: "Can I bring my client list?", a: "Yes. Import your clients from Excel or CSV in minutes." },
      PRICING_FAQ,
    ],
    cta: "solo",
  },
  {
    slug: "notion",
    title: "Surfdesk vs Notion: Ready-Made, No Setup",
    description:
      "Notion lets you build almost anything. Surfdesk gives you tasks, notes, reminders, clients and reports ready to use, with no setup. Compare the two.",
    eyebrow: "Surfdesk vs Notion",
    h1: "Notion is a blank canvas. Surfdesk is ready on day one.",
    h1Accent: "Surfdesk is ready on day one.",
    lede:
      "Notion is incredibly flexible: you design your own pages and databases. If you'd rather not build and maintain your own system, Surfdesk comes with tasks, notes, clients, reminders and reports already working together.",
    painTitle: "When building your own system gets old",
    pains: [
      "You spent a weekend setting up databases and still tweak them every week.",
      "Reminders, follow-ups and reports need templates, formulas or workarounds.",
      "Your team uses the setup differently than you meant it to.",
    ],
    featuresTitle: "What you get without building it",
    features: [
      { title: "Works in minutes", body: "Tasks, notes, lists, calendar and clients are ready the moment you sign up." },
      { title: "Type it or say it", body: "One sentence becomes a task, a note or a visit, filed in the right place." },
      { title: "Reports in one click", body: "Insights or Impact reports as a polished PDF, no formulas." },
      { title: "Built for phones", body: "Capture on the go with voice and the command box." },
    ],
    table: {
      other: "Notion",
      rows: [
        ["Built for", "Your day, your clients and your team, ready to use", "Docs and databases you design"],
        ["Client tracking", "Ready to use", "Build it yourself with databases or templates"],
        ["Visit and revenue reports", "One-click PDF", "Build with views and formulas"],
        ["Setup time", "Minutes", "Depends on what you build"],
        ["Price", "Individual $9/month", "Plus $12/member/month billed monthly"],
      ],
    },
    faqs: [
      { q: "Is Surfdesk a replacement for Notion's docs and wikis?", a: "No. If you write long documents and team wikis, keep Notion for that. Surfdesk is for the daily work: tasks, notes, reminders, clients and reports." },
      { q: "Can I import my clients from Notion?", a: "Export your Notion database as CSV, then import it into Surfdesk in minutes." },
      PRICING_FAQ,
    ],
    cta: "any",
  },
  {
    slug: "trello",
    title: "Surfdesk vs Trello: Boards vs Your Clients",
    description:
      "Trello is great for moving cards across boards. Surfdesk is built around people: clients, visits, follow-ups, notes and reports in one app. Compare them.",
    eyebrow: "Surfdesk vs Trello",
    h1: "Trello moves cards. Surfdesk keeps track of people.",
    h1Accent: "Surfdesk keeps track of people.",
    lede:
      "Trello is a simple, visual way to run projects on boards. If your work is ongoing relationships with clients or customers rather than projects with stages, Surfdesk is the better fit.",
    painTitle: "When boards stop fitting the work",
    pains: [
      "A client isn't a card that moves to “done”. You see them again and again.",
      "Notes, visits and follow-ups end up scattered across cards and boards.",
      "You can't see how many people you served or what you earned this month.",
    ],
    featuresTitle: "What Surfdesk does differently",
    features: [
      { title: "A page for every person", body: "Notes, visits, tasks and follow-ups on one timeline per client." },
      { title: "Follow-ups that come back", body: "Reminders land on your Today list on the right day." },
      { title: "Numbers you can use", body: "Visits, revenue by service and busiest times, counted automatically." },
      { title: "Team chat built in", body: "Channels and direct chats on team plans, linked to your clients." },
    ],
    table: {
      other: "Trello",
      rows: [
        ["Built for", "Clients, customers and your daily work", "Projects on boards and cards"],
        ["Client history over time", "Built in", "Not a core feature"],
        ["Visit, revenue and impact reports", "Built in", "Not a core feature"],
        ["Team chat", "Channels and direct chats (team plans)", "Comments on cards"],
        ["Price", "Individual $9/month; teams $19/person", "Free plan; Standard $6/user/month billed monthly"],
      ],
    },
    faqs: [
      { q: "Can I still use boards for projects?", a: "Yes. Many people keep Trello for project boards and use Surfdesk for clients, follow-ups and their daily list." },
      PRICING_FAQ,
    ],
    cta: "any",
  },
  {
    slug: "apple-reminders",
    title: "Surfdesk vs Apple Reminders: Beyond Reminders",
    description:
      "Apple Reminders is free and simple. Surfdesk adds notes, clients, visits, follow-ups and reports, on any phone or computer. See when it's worth switching.",
    eyebrow: "Surfdesk vs Apple Reminders",
    h1: "Apple Reminders reminds you. Surfdesk remembers everything else.",
    h1Accent: "Surfdesk remembers everything else.",
    lede:
      "Apple Reminders is free, built into your iPhone and great for simple lists. When your reminders are about clients, customers or work you need to report on, Surfdesk keeps the whole story together.",
    painTitle: "When reminders alone aren't enough",
    pains: [
      "The reminder says “call Ana”, but what you discussed last time is somewhere else.",
      "You need it on an Android phone or a work PC too.",
      "There's no way to see how many visits or follow-ups you did this month.",
    ],
    featuresTitle: "What Surfdesk adds",
    features: [
      { title: "Reminders with context", body: "Each follow-up links to the person, with their notes and history." },
      { title: "Any phone or computer", body: "Works in any browser on iPhone, Android, Mac and Windows." },
      { title: "Notes and lists too", body: "Shopping lists, notes and ideas live next to your tasks." },
      { title: "Reports", body: "See visits, revenue or people served without counting by hand." },
    ],
    table: {
      other: "Apple Reminders",
      rows: [
        ["Built for", "Your day, your notes and your clients", "Personal and shared reminder lists"],
        ["Client profiles and history", "Built in", "Not a core feature"],
        ["Works on Android and Windows", "Yes, in any browser", "Best on Apple devices"],
        ["Reports", "Built in", "Not a core feature"],
        ["Price", "Individual $9/month", "Free"],
      ],
    },
    faqs: [
      { q: "Is Surfdesk worth paying for if Reminders is free?", a: "If you only need simple personal reminders, Apple Reminders is hard to beat. Surfdesk is worth it when your reminders are about people you work with and you want notes, history and reports in one place." },
      PRICING_FAQ,
    ],
    cta: "solo",
  },
  {
    slug: "google-keep",
    title: "Surfdesk vs Google Keep: Notes That Get Things Done",
    description:
      "Google Keep is a free, fast notes app. Surfdesk turns notes into tasks and follow-ups, linked to your clients, with reports. Compare the two.",
    eyebrow: "Surfdesk vs Google Keep",
    h1: "Google Keep holds notes. Surfdesk turns them into action.",
    h1Accent: "Surfdesk turns them into action.",
    lede:
      "Google Keep is free and perfect for quick notes and lists. When notes need to become follow-ups, live on a client's history and show up in your reports, Surfdesk does that automatically.",
    painTitle: "When sticky notes pile up",
    pains: [
      "Notes about clients end up in a long, unsorted stream.",
      "A note says “call back Thursday”, but nothing reminds you on Thursday.",
      "Finding what you wrote about someone last month takes a while.",
    ],
    featuresTitle: "What Surfdesk adds",
    features: [
      { title: "Notes on the right person", body: "Mention someone and the note lands on their profile." },
      { title: "Notes become tasks", body: "A note that mentions a to-do suggests the task for you." },
      { title: "Search everything", body: "People, notes, tasks and lists in one search." },
      { title: "Reports", body: "Visits, revenue or people served, counted from what you log." },
    ],
    table: {
      other: "Google Keep",
      rows: [
        ["Built for", "Your day, your notes and your clients", "Quick notes and lists"],
        ["Notes linked to a person's history", "Built in", "Not a core feature"],
        ["Follow-ups on a Today list", "Built in", "Reminders on individual notes"],
        ["Reports", "Built in", "Not a core feature"],
        ["Price", "Individual $9/month", "Free"],
      ],
    },
    faqs: [
      { q: "Can I keep using Google Keep?", a: "Sure. Many people keep Keep for quick personal notes and use Surfdesk for clients, follow-ups and anything they need to act on or report." },
      PRICING_FAQ,
    ],
    cta: "solo",
  },
];

export const TEMPLATE_PAGES: SeoPageData[] = [
  {
    slug: "funder-impact-report",
    title: "Free Funder Impact Report Template (CSV) | Surfdesk",
    description:
      "Free impact report template for nonprofits: track people served, services and outcomes by month, ready for funders and boards. Download the CSV free.",
    eyebrow: "Free impact report template",
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
    eyebrow: "Free follow-up tracker template",
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
  {
    slug: "service-price-list",
    title: "Free Service Price List Template (CSV) | Surfdesk",
    description:
      "Free service price list template for salons, trainers, coaches, contractors and any service business: services, durations and prices in one sheet. Download free.",
    eyebrow: "Free price list template",
    h1: "Free service price list template.",
    h1Accent: "price list template.",
    lede:
      "One clean sheet for every service you offer, with how long it takes and what it costs. Share it with customers, print it for the front desk, or use it to set your prices. Download it free, no sign-up.",
    painTitle: "What a good price list does",
    pains: [
      "Customers see exactly what you offer and what it costs.",
      "Staff quote the same price every time.",
      "You can spot services that take long but earn little.",
      "Add-ons and packages are easy to offer at checkout.",
    ],
    featuresTitle: "How to use the template",
    features: [
      { title: "1. List your services", body: "One row per service, grouped by category, with duration and price." },
      { title: "2. Add packages", body: "Bundle services in the package rows and set a package price." },
      { title: "3. Share it", body: "Print it, post it, or save it as a PDF from Excel or Google Sheets." },
      { title: "Or put it to work", body: "Add your services to Surfdesk once and log a sale in one line: “Ana – consultation”. Revenue by service is counted for you." },
    ],
    download: {
      href: "/downloads/service-price-list-template.csv",
      label: "Download the template (CSV)",
      what: ["Service, category, duration and price columns", "Sample rows you can rename", "Add-on and package rows", "A price-per-hour column to check your pricing"],
    },
    faqs: [
      { q: "Does it open in Excel and Google Sheets?", a: "Yes. It's a standard CSV file that opens in Excel, Google Sheets and Numbers." },
      { q: "How do I know if a service is priced right?", a: "Compare the price per hour across services. A service that takes long but earns little per hour is a candidate for a price change or a package." },
    ],
    cta: "any",
  },
];

export const ALL_SEO_PAGES = [
  ...AUDIENCE_PAGES.map((p) => ({ ...p, path: `/for/${p.slug}` })),
  ...COMPARE_PAGES.map((p) => ({ ...p, path: `/compare/${p.slug}` })),
  ...TEMPLATE_PAGES.map((p) => ({ ...p, path: `/templates/${p.slug}` })),
];
