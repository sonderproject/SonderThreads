/**
 * Marketing sample: renders the real Impact report PDF from made-up numbers
 * (no real clients). Run: npx tsx scripts/sample-impact-pdf.ts out.pdf
 */
import { writeFileSync } from "fs";
import { impactPdf } from "@/lib/export/impact-pdf";
import type { Metrics, Point } from "@/lib/metrics-shared";

const months = ["2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11"];
const label = (k: string) => ["Jun", "Jul", "Aug", "Sep", "Oct", "Nov"][months.indexOf(k)];
const series = (vals: number[]): Point[] => vals.map((v, i) => ({ key: months[i], label: label(months[i]), value: v }));
const pts = (pairs: [string, number][]): Point[] => pairs.map(([l, v]) => ({ key: l, label: l, value: v }));

const m: Metrics = {
  from: "2026-06-01",
  to: "2026-11-30",
  prevFrom: "2025-12-01",
  prevTo: "2026-05-31",
  bucket: "month",
  kpis: { checkIns: 1842, peopleServed: 612, newPeople: 238, notes: 904, tasksDone: 431 },
  prev: { checkIns: 1390, peopleServed: 498, newPeople: 181, notes: 702, tasksDone: 350 },
  checkInsOverTime: series([241, 268, 297, 322, 338, 376]),
  newPeopleOverTime: series([31, 36, 39, 41, 43, 48]),
  byReason: pts([["Job readiness workshop", 412], ["Resume help", 356], ["OSHA 10 class", 288], ["Food Handlers card", 241], ["Job application help", 199], ["Laptop use", 164]]),
  byWeekday: pts([["Monday", 402], ["Tuesday", 388], ["Wednesday", 351], ["Thursday", 366], ["Friday", 289], ["Saturday", 46], ["Sunday", 0]]),
  topVisitors: [],
  byEthnicity: pts([["Hispanic or Latino", 241], ["Black or African American", 178], ["White", 102], ["Asian", 47], ["Two or more", 26], ["Not recorded", 18]]),
  byIncome: pts([["None", 288], ["Low", 214], ["Medium", 76], ["Not recorded", 34]]),
  byGender: pts([["Male", 331], ["Female", 263], ["Non-binary", 6], ["Not recorded", 12]]),
  scope: "org",
  orgName: "Harbor Community Services",
  reach: months.map((k, i) => ({ key: k, label: label(k), first: [31, 36, 39, 41, 43, 48][i], returning: [118, 126, 131, 140, 147, 159][i] })),
  heatmap: [
    [0, 0, 0, 0, 22, 61, 48, 39, 18, 0, 0, 0],
    [0, 0, 0, 0, 20, 58, 47, 41, 17, 0, 0, 0],
    [0, 0, 0, 0, 18, 52, 44, 36, 15, 0, 0, 0],
    [0, 0, 0, 0, 19, 55, 45, 38, 16, 0, 0, 0],
    [0, 0, 0, 0, 16, 47, 39, 28, 9, 0, 0, 0],
    [0, 0, 0, 0, 4, 12, 9, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  ],
  followThrough: { due: 460, onTime: 371, late: 60, open: 29 },
  trackingSince: "2025-09-08",
  services: [
    { name: "Job readiness workshop", count: 412, prevCount: 301, people: 288, valueCents: 0, busiestDay: "Tuesday", busiestTime: "10a" },
    { name: "Resume help", count: 356, prevCount: 290, people: 241, valueCents: 0, busiestDay: "Monday", busiestTime: "10a" },
    { name: "OSHA 10 class", count: 288, prevCount: 204, people: 196, valueCents: 0, busiestDay: "Wednesday", busiestTime: "12p" },
    { name: "Food Handlers card", count: 241, prevCount: 199, people: 233, valueCents: 0, busiestDay: "Thursday", busiestTime: "2p" },
  ],
  outcomes: [
    { name: "Got a job", people: 18, prevPeople: 12 },
    { name: "Found housing", people: 11, prevPeople: 9 },
    { name: "Enrolled in benefits", people: 9, prevPeople: 10 },
    { name: "Completed program", people: 6, prevPeople: 4 },
  ],
  outcomePeople: 41,
  prevOutcomePeople: 32,
};

impactPdf(m, {
  preparedFor: "Harbor Community Services",
  org: { name: "Harbor Community Services", phone: "(562) 555-0100", email: "hello@harborcs.org", website: "harborcs.org", address: "412 Harbor Ave, Suite 3, Long Beach, CA" } as never,
}).then((buf) => writeFileSync(process.argv[2] ?? "sample-impact.pdf", buf));
