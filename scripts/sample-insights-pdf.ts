/**
 * Marketing sample: the business Insights report PDF from made-up numbers
 * (a grooming shop; no real customers). Run: npx tsx scripts/sample-insights-pdf.ts out.pdf
 */
import { writeFileSync } from "fs";
import { impactPdf } from "@/lib/export/impact-pdf";
import type { Metrics, Point } from "@/lib/metrics-shared";

const months = ["2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11"];
const names = ["Jun", "Jul", "Aug", "Sep", "Oct", "Nov"];
const series = (vals: number[]): Point[] => vals.map((v, i) => ({ key: months[i], label: names[i], value: v }));
const pts = (pairs: [string, number][]): Point[] => pairs.map(([l, v]) => ({ key: l, label: l, value: v }));

const m: Metrics = {
  from: "2026-06-01",
  to: "2026-11-30",
  prevFrom: "2025-12-01",
  prevTo: "2026-05-31",
  bucket: "month",
  kpis: { checkIns: 1296, peopleServed: 341, newPeople: 87, notes: 402, tasksDone: 158 },
  prev: { checkIns: 1104, peopleServed: 298, newPeople: 71, notes: 330, tasksDone: 131 },
  checkInsOverTime: series([188, 201, 214, 219, 226, 248]),
  newPeopleOverTime: series([12, 14, 15, 13, 16, 17]),
  byReason: pts([["Full groom", 512], ["Bath & brush", 341], ["Nail trim", 236], ["Puppy cut", 121], ["De-shedding", 86]]),
  byWeekday: pts([["Monday", 0], ["Tuesday", 214], ["Wednesday", 231], ["Thursday", 226], ["Friday", 268], ["Saturday", 357], ["Sunday", 0]]),
  topVisitors: [],
  byEthnicity: [],
  byIncome: [],
  byGender: [],
  scope: "org",
  orgName: "Pawsome Grooming Co.",
  reach: months.map((k, i) => ({ key: k, label: names[i], first: [12, 14, 15, 13, 16, 17][i], returning: [131, 138, 142, 147, 151, 160][i] })),
  heatmap: [
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 22, 41, 38, 31, 12, 0, 0, 0],
    [0, 0, 0, 0, 24, 45, 40, 33, 13, 0, 0, 0],
    [0, 0, 0, 0, 23, 44, 39, 32, 12, 0, 0, 0],
    [0, 0, 0, 0, 27, 52, 46, 38, 15, 0, 0, 0],
    [0, 0, 0, 0, 41, 78, 69, 52, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  ],
  followThrough: { due: 0, onTime: 0, late: 0, open: 0 },
  trackingSince: "2025-11-02",
  services: [
    { id: "s94", name: "Full groom", count: 512, prevCount: 431, people: 238, valueCents: 3328000, busiestDay: "Saturday", busiestTime: "10a" },
    { id: "s228", name: "Bath & brush", count: 341, prevCount: 298, people: 177, valueCents: 1534500, busiestDay: "Friday", busiestTime: "10a" },
    { id: "s362", name: "Nail trim", count: 236, prevCount: 221, people: 151, valueCents: 472000, busiestDay: "Saturday", busiestTime: "12p" },
    { id: "s494", name: "Puppy cut", count: 121, prevCount: 92, people: 64, valueCents: 665500, busiestDay: "Wednesday", busiestTime: "10a" },
    { id: "s625", name: "De-shedding", count: 86, prevCount: 62, people: 49, valueCents: 516000, busiestDay: "Saturday", busiestTime: "10a" },
  ],
  outcomes: [
    { name: "Became a regular", people: 22, prevPeople: 15 },
    { name: "Joined membership", people: 8, prevPeople: 5 },
    { name: "Referred a friend", people: 6, prevPeople: 7 },
  ],
  exits: [
    { name: "Reached their goal", kind: "positive", count: 4, prevCount: 2 },
    { name: "Moved away", kind: "neutral", count: 3, prevCount: 2 },
    { name: "Chose another company", kind: "unplanned", count: 2, prevCount: 3 },
  ],
  exitKinds: { positive: 4, neutral: 3, unplanned: 2 },
  prevExitKinds: { positive: 2, neutral: 2, unplanned: 3 },
  outcomePeople: 31,
  prevOutcomePeople: 24,
  extra: { servicesProvided: 214, valueCents: 1284000, referrals: 37, bookings: 12 },
  prevExtra: { servicesProvided: 190, valueCents: 1102000, referrals: 29, bookings: 8 },
  allTime: { since: "2026-03-02", people: 412, checkIns: 2380, outcomes: 96, valueCents: 4312000 },
  monthly: [
    { key: "2026-09-01", label: "Sep 2026", peopleServed: 88, checkIns: 190, newPeople: 21, outcomes: 9, valueCents: 402000 },
    { key: "2026-10-01", label: "Oct 2026", peopleServed: 97, checkIns: 214, newPeople: 25, outcomes: 13, valueCents: 451000 },
    { key: "2026-11-01", label: "Nov 2026", peopleServed: 91, checkIns: 201, newPeople: 19, outcomes: 11, valueCents: 431000 },
  ],
};

impactPdf(m, {
  preparedFor: "Pawsome Grooming Co.",
  audience: "business",
  org: { id: "s772", name: "Pawsome Grooming Co.", about: null, phone: "(562) 555-0177", email: "hello@pawsomegrooming.com", website: "pawsomegrooming.com", address: "88 Elm St, Long Beach, CA" } as never,
}).then((buf) => writeFileSync(process.argv[2] ?? "sample-insights.pdf", buf));
