import path from "path";
import PDFDocument from "pdfkit";
import { buildStory, HEATMAP_BLOCKS, WEEKDAY_NAMES, type Kpis, type Metrics, type Point, type ReachPoint } from "@/lib/metrics-shared";

/**
 * The Impact report PDF: a dark cover page, an executive summary (the written
 * story + headline numbers), then one chapter per section with vector charts.
 * Set in Outfit (headings) and Inter (text), like the app. Paper has one
 * look, so colors are the light theme's values written out (the app's
 * palette; chart blue/orange validated for color-blind readers).
 *
 * Client names never appear: a report like this gets shared with funders.
 *
 * White-label: no Strynd or Sonder Project name or mark anywhere, so
 * an agency can put it in front of funders and boards as its own report.
 */

const C = {
  ink: "#141412",
  muted: "#6e5f4d",
  faint: "#aea08d",
  line: "#e2dbd0",
  lineSubtle: "#ece7dd",
  sand: "#f6f4ef",
  obsidian: "#0a0a09",
  warmWhite: "#f3f0eb",
  blue: "#1c77b5",
  orange: "#eb6834",
  warn: "#9a5b00",
};
const RAINBOW = ["#ff6b6b", "#feca57", "#48dbfb", "#9f7aea", "#54a0ff"];

const ASSETS = path.join(process.cwd(), "assets");
const FONT = {
  display: path.join(ASSETS, "fonts/outfit-latin-300-normal.woff"),
  displayRegular: path.join(ASSETS, "fonts/outfit-latin-400-normal.woff"),
  displayMedium: path.join(ASSETS, "fonts/outfit-latin-500-normal.woff"),
  body: path.join(ASSETS, "fonts/inter-latin-400-normal.woff"),
  bodyMedium: path.join(ASSETS, "fonts/inter-latin-500-normal.woff"),
  bodyBold: path.join(ASSETS, "fonts/inter-latin-600-normal.woff"),
};

/** Words for the two report audiences: a nonprofit's Impact report, or a business's Insights report. */
const WORDS = {
  nonprofit: {
    report: "Impact report", people: "People served", peopleLower: "people served", events: "Check-ins", eventsLower: "check-ins",
    newPeople: "New clients", newPeopleLower: "new clients", perPerson: "VISITS PER PERSON", perPersonSub: "Average check-ins per person",
    reachTitle: "Who came through the door", whenMarker: "When people come", needsMarker: "Needs", reasonsTitle: "Why people came in",
    servicesSub: "How often each was provided, to how many people, and versus the previous period.", valueCol: "Value",
    countsOnce: "People served counts each person once.",
    source: "Numbers come straight from case records. Client names are never included in this report, and staff members' personal (non-client) records are never counted.",
  },
  business: {
    report: "Insights report", people: "Customers", peopleLower: "customers", events: "Visits", eventsLower: "visits",
    newPeople: "New customers", newPeopleLower: "new customers", perPerson: "VISITS PER CUSTOMER", perPersonSub: "Average visits per customer",
    reachTitle: "Who came in", whenMarker: "When customers come", needsMarker: "Services", reasonsTitle: "Why customers came in",
    servicesSub: "How often each was provided, to how many customers, what it brought in, and versus the previous period.", valueCol: "Revenue",
    countsOnce: "Customers counts each customer once.",
    source: "Numbers come straight from your visit records. Customer names are never included in this report, and staff members' personal records are never counted.",
  },
};
type ReportWords = (typeof WORDS)["nonprofit"];
const kpiTiles = (w: ReportWords): [keyof Kpis, string][] => [
  ["peopleServed", w.people],
  ["checkIns", w.events],
  ["newPeople", w.newPeople],
  ["tasksDone", "Tasks completed"],
  ["notes", "Notes written"],
];

const PAGE = { w: 612, h: 792, m: 54 };
const CONTENT_W = PAGE.w - PAGE.m * 2;
const FOOTER_Y = PAGE.h - 36;

function fmtDay(day: string): string {
  const [y, mo, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, d)).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function change(cur: number, prev: number): string {
  if (prev === 0) return "No earlier data";
  const pct = Math.round(((cur - prev) / prev) * 100);
  if (pct === 0) return "No change";
  return `${pct > 0 ? "+" : "−"}${Math.abs(pct)}% vs before`;
}

function niceMax(v: number): number {
  if (v <= 2) return 2;
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

/** A rectangle with only the top corners rounded (data ends rounded, baseline square). */
function topRounded(x: number, y: number, w: number, h: number, r: number): string {
  const rr = Math.min(r, w / 2, h);
  return `M${x} ${y + h} V${y + rr} Q${x} ${y} ${x + rr} ${y} H${x + w - rr} Q${x + w} ${y} ${x + w} ${y + rr} V${y + h} Z`;
}
/** Only the right end rounded, for horizontal bars. */
function rightRounded(x: number, y: number, w: number, h: number, r: number): string {
  const rr = Math.min(r, h / 2, w);
  return `M${x} ${y} H${x + w - rr} Q${x + w} ${y} ${x + w} ${y + rr} V${y + h - rr} Q${x + w} ${y + h} ${x + w - rr} ${y + h} H${x} Z`;
}

/** Organization details for the cover (admins edit them on the Organization page). */
export type ReportOrgInfo = {
  about: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  /** PNG or JPEG bytes (the organization's own logo). */
  logo?: Buffer | null;
};

export function impactPdf(
  m: Metrics,
  opts: {
    preparedFor: string;
    org?: ReportOrgInfo | null;
    /** Include follow-ups (optional; off unless asked for). */
    followUps?: boolean;
    /** Nonprofit (Impact report, demographics) or business (Insights report, revenue, no demographics). */
    audience?: "nonprofit" | "business";
  },
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const audience = opts.audience ?? "nonprofit";
    const W = WORDS[audience];
    const doc = new PDFDocument({ size: "LETTER", margin: PAGE.m, bufferPages: true, info: { Title: W.report } });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.registerFont("display", FONT.display);
    doc.registerFont("display-regular", FONT.displayRegular);
    doc.registerFont("display-medium", FONT.displayMedium);
    doc.registerFont("body", FONT.body);
    doc.registerFont("body-medium", FONT.bodyMedium);
    doc.registerFont("body-bold", FONT.bodyBold);

    const who = m.scope === "org" && m.orgName ? m.orgName : opts.preparedFor;
    const period = `${fmtDay(m.from)} – ${fmtDay(m.to)}`;

    const rainbow = (x: number, y: number, w: number, h = 1.5) => {
      const g = doc.linearGradient(x, y, x + w, y);
      RAINBOW.forEach((c, i) => g.stop(i / (RAINBOW.length - 1), c));
      doc.rect(x, y, w, h).fill(g);
    };

    // ── Cover ────────────────────────────────────────────────────────────
    doc.rect(0, 0, PAGE.w, PAGE.h).fill(C.obsidian);
    let logoDrawn = false;
    if (opts.org?.logo) {
      // The organization's own logo on a white tile (most logos are dark on white).
      try {
        doc.roundedRect(PAGE.m, 50, 190, 64, 10).fill("#ffffff");
        doc.image(opts.org.logo, PAGE.m + 14, 58, { fit: [162, 48], align: "center", valign: "center" });
        logoDrawn = true;
      } catch {
        logoDrawn = false; // unreadable image: fall back to the name
      }
    }
    if (!logoDrawn) {
      doc.rect(PAGE.m, 50, 200, 70).fill(C.obsidian);
      doc.font("display").fontSize(11).fillColor(C.warmWhite).text(who.toUpperCase(), PAGE.m, 74, {
        characterSpacing: 3.5,
        width: CONTENT_W,
        lineBreak: false,
        ellipsis: true,
      });
    }
    rainbow(PAGE.m, 128, CONTENT_W);

    doc.font("body-medium").fontSize(9).fillColor("#62b4e6").text(W.report.toUpperCase(), PAGE.m, 300, { characterSpacing: 3 });
    doc.font("display").fontSize(46).fillColor(C.warmWhite).text(who, PAGE.m, 322, { width: CONTENT_W, lineGap: -4 });
    doc.moveDown(0.5);
    doc.font("display").fontSize(18).fillColor(C.faint).text(period, { width: CONTENT_W });
    if (opts.org?.about) {
      doc.moveDown(1.2);
      doc.font("body").fontSize(10.5).fillColor(C.faint).text(opts.org.about, { width: CONTENT_W * 0.78, lineGap: 3 });
    }

    const k = m.kpis;
    doc.font("display").fontSize(15).fillColor(C.warmWhite).text(
      `${k.peopleServed.toLocaleString("en-US")} ${W.peopleLower} · ${k.checkIns.toLocaleString("en-US")} ${W.eventsLower}`,
      PAGE.m,
      PAGE.h - 160,
      { width: CONTENT_W },
    );
    const contact = opts.org
      ? [opts.org.address?.replace(/\s*\n\s*/g, ", "), opts.org.phone, opts.org.email, opts.org.website?.replace(/^https?:\/\//, "")].filter(Boolean).join("  ·  ")
      : "";
    if (contact) doc.font("body").fontSize(9).fillColor(C.warmWhite).text(contact, PAGE.m, PAGE.h - 126, { width: CONTENT_W, lineBreak: false, ellipsis: true });
    doc.font("body").fontSize(9).fillColor(C.faint).text(
      `Prepared ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`,
      PAGE.m,
      PAGE.h - 106,
      { width: CONTENT_W },
    );

    // ── Helpers for content pages ────────────────────────────────────────
    let y = PAGE.m;
    const newPage = () => {
      doc.addPage();
      doc.rect(0, 0, PAGE.w, PAGE.h).fill("#ffffff");
      y = PAGE.m;
    };
    const ensure = (h: number) => {
      if (y + h > FOOTER_Y - 24) newPage();
    };
    const marker = (n: string | null, title: string) => {
      ensure(80);
      const lineX = n ? PAGE.m + 22 : PAGE.m;
      if (n) doc.font("body-medium").fontSize(8.5).fillColor(C.blue).text(n, PAGE.m, y, { characterSpacing: 2, lineBreak: false });
      doc.rect(lineX, y + 4.5, 28, 0.75).fill(C.blue);
      doc.font("body-medium").fontSize(8.5).fillColor(C.muted).text(title.toUpperCase(), lineX + 38, y, { characterSpacing: 2.5, lineBreak: false });
      y += 22;
    };
    const heading = (text: string, lead?: string) => {
      doc.font("display").fontSize(22).fillColor(C.ink).text(text, PAGE.m, y, { width: CONTENT_W });
      y = doc.y + 2;
      if (lead) {
        doc.font("body").fontSize(10).fillColor(C.muted).text(lead, PAGE.m, y, { width: CONTENT_W });
        y = doc.y;
      }
      y += 14;
    };
    const chartTitle = (x: number, yy: number, title: string, sub: string, w: number, total?: string) => {
      doc.font("body-bold").fontSize(10).fillColor(C.ink).text(title, x, yy, { width: w, lineBreak: false });
      doc.font("body").fontSize(8).fillColor(C.muted).text(sub, x, yy + 14, { width: w, lineBreak: false });
      if (total) doc.font("body-bold").fontSize(10).fillColor(C.ink).text(total, x, yy, { width: w, align: "right", lineBreak: false });
      return yy + 32;
    };
    const sum = (pts: Point[]) => pts.reduce((n, p) => n + p.value, 0);
    const totalLabel = (n: number, unit: string) => `Total: ${n.toLocaleString("en-US")} ${unit}`;

    /** Columns with 3 gridlines, rounded tops, and the value on each bar. Returns the bottom y. */
    const columns = (x: number, top: number, w: number, h: number, pts: Point[], color: string) => {
      const max = Math.max(0, ...pts.map((p) => p.value));
      const axis = niceMax(max);
      const left = 22;
      const plotW = w - left;
      const headroom = 12; // room for the peak label
      const plotH = h - 16 - headroom;
      const yOf = (v: number) => top + headroom + plotH - (axis ? (v / axis) * plotH : 0);
      for (const t of [0, axis / 2, axis]) {
        doc.rect(x + left, yOf(t), plotW, 0.5).fill(C.lineSubtle);
        doc.font("body").fontSize(6.5).fillColor(C.muted).text(String(t), x, yOf(t) - 3, { width: left - 5, align: "right", lineBreak: false });
      }
      const slot = pts.length ? plotW / pts.length : 0;
      const barW = Math.max(1.5, Math.min(16, slot - 2));
      const every = pts.length <= 7 ? 1 : Math.max(1, Math.ceil(pts.length / Math.max(1, Math.floor(plotW / 46))));
      let peakDone = false;
      const labelAll = slot >= 7; // room for a number over every bar
      pts.forEach((p, i) => {
        const bx = x + left + i * slot + (slot - barW) / 2;
        const by = yOf(p.value);
        if (p.value > 0) doc.path(topRounded(bx, by, barW, top + headroom + plotH - by, 3)).fill(color);
        const isPeak = !peakDone && p.value === max && max > 0;
        if (isPeak) peakDone = true;
        if (p.value > 0 && (labelAll || isPeak)) {
          doc
            .font(isPeak ? "body-bold" : "body-medium")
            .fontSize(slot >= 14 ? 7 : slot >= 9 ? 6 : 5.5)
            .fillColor(C.ink)
            .text(String(p.value), bx - 12, by - 9, { width: barW + 24, align: "center", lineBreak: false });
        }
        if (i % every === 0) {
          doc.font("body").fontSize(6.5).fillColor(C.muted).text(p.label, x + left + i * slot - 14, top + headroom + plotH + 5, { width: slot + 28, align: "center", lineBreak: false });
        }
      });
      return top + h;
    };

    /** Returning (blue) + first visit (orange) stacked columns, 2pt gap, with a legend. */
    const reachChart = (x: number, top: number, w: number, h: number, pts: ReachPoint[]) => {
      const legend = (lx: number, color: string, label: string) => {
        doc.roundedRect(lx, top + 1, 7, 7, 1.5).fill(color);
        doc.font("body").fontSize(8).fillColor(C.muted).text(label, lx + 11, top, { lineBreak: false });
        return lx + 11 + doc.widthOfString(label) + 14;
      };
      let lx = legend(x, C.blue, "Returning");
      lx = legend(lx, C.orange, "First visit");
      const t = top + 18;
      const totals = pts.map((p) => p.first + p.returning);
      const max = Math.max(0, ...totals);
      const axis = niceMax(max);
      const left = 22;
      const plotW = w - left;
      const headroom = 11; // room for the total over each stack
      const plotH = h - 18 - 16 - headroom;
      const yOf = (v: number) => t + headroom + plotH - (axis ? (v / axis) * plotH : 0);
      for (const tick of [0, axis / 2, axis]) {
        doc.rect(x + left, yOf(tick), plotW, 0.5).fill(C.lineSubtle);
        doc.font("body").fontSize(6.5).fillColor(C.muted).text(String(tick), x, yOf(tick) - 3, { width: left - 5, align: "right", lineBreak: false });
      }
      const slot = pts.length ? plotW / pts.length : 0;
      const barW = Math.max(1.5, Math.min(18, slot - 2));
      const every = Math.max(1, Math.ceil(pts.length / Math.max(1, Math.floor(plotW / 46))));
      const labelAll = slot >= 7;
      const inside = (n: number, segTop: number, segH: number, bx: number) => {
        // The part's own number, in white, when the segment is tall and wide enough to hold it.
        if (n > 0 && segH >= 10 && barW >= 10) {
          doc.font("body-medium").fontSize(6).fillColor("#ffffff").text(String(n), bx - 6, segTop + segH / 2 - 3, { width: barW + 12, align: "center", lineBreak: false });
        }
      };
      pts.forEach((p, i) => {
        const bx = x + left + i * slot + (slot - barW) / 2;
        const base = t + headroom + plotH;
        const retTop = yOf(p.returning);
        const allTop = yOf(p.first + p.returning);
        if (p.returning > 0) {
          if (p.first > 0) doc.rect(bx, retTop, barW, base - retTop).fill(C.blue);
          else doc.path(topRounded(bx, retTop, barW, base - retTop, 3)).fill(C.blue);
        }
        if (p.first > 0) {
          const gap = p.returning > 0 ? 1.5 : 0;
          const hh = retTop - allTop - gap;
          if (hh > 0) doc.path(topRounded(bx, allTop, barW, hh, 3)).fill(C.orange);
        }
        const all = p.first + p.returning;
        if (all > 0 && (labelAll || all === max)) {
          if (p.first > 0 && p.returning > 0) {
            inside(p.returning, retTop, base - retTop, bx);
            inside(p.first, allTop, retTop - allTop - 1.5, bx);
          }
          doc
            .font(all === max ? "body-bold" : "body-medium")
            .fontSize(slot >= 14 ? 7 : slot >= 9 ? 6 : 5.5)
            .fillColor(C.ink)
            .text(String(all), bx - 12, allTop - 9, { width: barW + 24, align: "center", lineBreak: false });
        }
        if (i % every === 0) {
          doc.font("body").fontSize(6.5).fillColor(C.muted).text(p.label, x + left + i * slot - 14, base + 5, { width: slot + 28, align: "center", lineBreak: false });
        }
      });
      return top + h;
    };

    /** Ranked horizontal bars with the value at the tip. Returns the bottom y. */
    /** `share`: show each bar's % of the total (off where one person can be in several bars, e.g. outcomes). */
    const hbars = (x: number, top: number, w: number, pts: Point[], color: string, labelW = 150, share = true) => {
      const shown = pts.filter((p) => p.value > 0);
      if (!shown.length) {
        doc.font("body").fontSize(9).fillColor(C.muted).text("Nothing recorded in this period.", x, top);
        return top + 18;
      }
      const max = Math.max(1, ...shown.map((p) => p.value));
      const total = shown.reduce((s, p) => s + p.value, 0);
      const barMax = w - labelW - 54;
      shown.forEach((p, i) => {
        const by = top + i * 19;
        doc.font("body").fontSize(8.5).fillColor(C.ink).text(p.label, x, by + 1, { width: labelW - 10, ellipsis: true, lineBreak: false });
        const bw = Math.max(2, (p.value / max) * barMax);
        doc.path(rightRounded(x + labelW, by + 1, bw, 10, 3)).fill(color);
        if (share)
          doc.font("body-medium").fontSize(8).fillColor(C.ink).text(String(p.value), x + labelW + bw + 6, by + 1.5, { lineBreak: false, continued: true })
            .font("body").fillColor(C.muted).text(`  ${Math.round((p.value / total) * 100)}%`, { lineBreak: false });
        else doc.font("body-medium").fontSize(8).fillColor(C.ink).text(String(p.value), x + labelW + bw + 6, by + 1.5, { lineBreak: false });
      });
      return top + shown.length * 19;
    };

    /** Weekday × 2-hour grid, sequential blue (4 steps over white), with a key. */
    const heatmap = (x: number, top: number, w: number, grid: number[][]) => {
      const cols = HEATMAP_BLOCKS.map((_, b) => b).filter((b) => grid.some((r) => r[b] > 0));
      const shown = cols.length ? cols : [4, 5, 6, 7, 8];
      const max = Math.max(1, ...grid.flat());
      const labelW = 30;
      const gap = 2.5;
      const cw = Math.min(46, (w - labelW) / shown.length - gap);
      const ch = 15;
      const shade = (n: number) => {
        if (n === 0) return C.sand;
        const s = Math.ceil((n / max) * 4); // 1..4
        return ["#c6dcee", "#8cb9dc", "#4f93c6", C.blue][s - 1];
      };
      shown.forEach((b, j) => {
        doc.font("body").fontSize(6.5).fillColor(C.muted).text(HEATMAP_BLOCKS[b], x + labelW + j * (cw + gap), top, { width: cw, align: "center", lineBreak: false });
      });
      grid.forEach((row, d) => {
        const ry = top + 12 + d * (ch + gap);
        doc.font("body").fontSize(7.5).fillColor(C.muted).text(WEEKDAY_NAMES[d].slice(0, 3), x, ry + 3.5, { lineBreak: false });
        shown.forEach((b, j) => {
          doc.roundedRect(x + labelW + j * (cw + gap), ry, cw, ch, 3).fill(shade(row[b]));
        });
      });
      const ky = top + 12 + 7 * (ch + gap) + 6;
      doc.font("body").fontSize(7).fillColor(C.muted).text("Fewer", x + labelW, ky + 1, { lineBreak: false });
      let kx = x + labelW + 26;
      for (const c of [C.sand, "#c6dcee", "#8cb9dc", "#4f93c6", C.blue]) {
        doc.roundedRect(kx, ky, 16, 8, 2).fill(c);
        kx += 19;
      }
      doc.font("body").fontSize(7).fillColor(C.muted).text(`More ${W.eventsLower}`, kx + 3, ky + 1, { lineBreak: false });
      return ky + 14;
    };

    // ── Executive summary ────────────────────────────────────────────────
    newPage();
    marker(null, "The story");
    const story = buildStory(m, { followUps: opts.followUps, audience });
    doc.font("display").fontSize(21).fillColor(C.ink).text(story[0] ?? "", PAGE.m, y, { width: CONTENT_W, lineGap: 2 });
    y = doc.y + 8;
    if (story.length > 1) {
      doc.font("body").fontSize(10.5).fillColor(C.muted).text(story.slice(1).join(" "), PAGE.m, y, { width: CONTENT_W, lineGap: 3 });
      y = doc.y;
    }
    y += 24;

    // Headline tiles: 3 + 2.
    const tileGap = 10;
    const tileW = (CONTENT_W - tileGap * 2) / 3;
    const tileH = 78;
    kpiTiles(W).forEach(([key, label], i) => {
      const row = Math.floor(i / 3);
      const col = i % 3;
      const tx = PAGE.m + col * (tileW + tileGap);
      const ty = y + row * (tileH + tileGap);
      doc.roundedRect(tx, ty, tileW, tileH, 10).fill(C.sand);
      doc.font("body-medium").fontSize(7.5).fillColor(C.muted).text(label.toUpperCase(), tx + 14, ty + 13, { characterSpacing: 1.5, lineBreak: false });
      doc.font("display").fontSize(28).fillColor(C.ink).text(m.kpis[key].toLocaleString("en-US"), tx + 14, ty + 26, { lineBreak: false });
      doc.font("body").fontSize(7.5).fillColor(C.muted).text(`${change(m.kpis[key], m.prev[key])} (${m.prev[key].toLocaleString("en-US")})`, tx + 14, ty + 60, { lineBreak: false });
    });
    // Sixth tile: follow-ups on time if they're included, otherwise visits per person.
    {
      const tx = PAGE.m + 2 * (tileW + tileGap);
      const ty = y + tileH + tileGap;
      const f = m.followThrough;
      const useFollowUps = opts.followUps && f.onTime + f.late > 0;
      const visits = m.kpis.peopleServed ? m.kpis.checkIns / m.kpis.peopleServed : 0;
      const prevVisits = m.prev.peopleServed ? m.prev.checkIns / m.prev.peopleServed : 0;
      doc.roundedRect(tx, ty, tileW, tileH, 10).fill(C.obsidian);
      doc.font("body-medium").fontSize(7.5).fillColor(C.faint).text(useFollowUps ? "FOLLOW-UPS DONE" : W.perPerson, tx + 14, ty + 13, { characterSpacing: 1.5, lineBreak: false });
      doc.font("display").fontSize(28).fillColor(C.warmWhite).text(
        useFollowUps ? `${f.onTime + f.late}` : visits ? visits.toFixed(1) : "–",
        tx + 14,
        ty + 26,
        { lineBreak: false },
      );
      doc.font("body").fontSize(7.5).fillColor(C.faint).text(
        useFollowUps ? `of ${f.due} due this period` : prevVisits ? `${prevVisits.toFixed(1)} the period before` : W.perPersonSub,
        tx + 14,
        ty + 60,
        { lineBreak: false },
      );
    }
    y += tileH * 2 + tileGap + 18;
    doc.font("body").fontSize(8).fillColor(C.muted).text(
      `Compared with ${fmtDay(m.prevFrom)} – ${fmtDay(m.prevTo)}. ${W.countsOnce}`,
      PAGE.m,
      y,
      { width: CONTENT_W },
    );
    y = doc.y + 30;
    // About these numbers (on the summary page, where funders read first).
    rainbow(PAGE.m, y, CONTENT_W, 1);
    y += 14;
    doc.font("body").fontSize(8).fillColor(C.muted).text(
      W.source,
      PAGE.m,
      y,
      { width: CONTENT_W },
    );

    y = doc.y + 30;

    // ── 01 Reach ─────────────────────────────────────────────────────────
    const bucketWord = m.bucket === "day" ? "day" : m.bucket === "week" ? "week" : "month";
    // Sections are numbered in order; Outcomes and Who we serve only appear when they apply.
    let section = 0;
    const num = () => String(++section).padStart(2, "0");
    ensure(330);
    marker(num(), "Reach");
    heading(W.reachTitle, `${W.people} each period, split by whether it was their first visit.`);
    {
      const ret = m.reach.reduce((n, p) => n + p.returning, 0);
      const first = m.reach.reduce((n, p) => n + p.first, 0);
      y = chartTitle(
        PAGE.m,
        y,
        W.people,
        `Per ${bucketWord} · ${ret.toLocaleString("en-US")} returning, ${first.toLocaleString("en-US")} first visit`,
        CONTENT_W,
        totalLabel(ret + first, "visits"),
      );
    }
    y = reachChart(PAGE.m, y, CONTENT_W, 170, m.reach) + 24;
    ensure(170);
    const half = (CONTENT_W - 24) / 2;
    let yl = chartTitle(PAGE.m, y, W.events, `Per ${bucketWord}`, half, totalLabel(sum(m.checkInsOverTime), W.eventsLower));
    let yr = chartTitle(PAGE.m + half + 24, y, `${W.newPeople} added`, `Per ${bucketWord}`, half, totalLabel(sum(m.newPeopleOverTime), W.newPeopleLower));
    yl = columns(PAGE.m, yl, half, 120, m.checkInsOverTime, C.blue);
    yr = columns(PAGE.m + half + 24, yr, half, 120, m.newPeopleOverTime, C.blue);
    y = Math.max(yl, yr) + 34;

    // ── Outcomes (when any were recorded in either period) ─────────────
    if (m.outcomes.length) {
      // Heading, big number and every row on one page.
      ensure(190 + m.outcomes.length * 19);
      marker(num(), "Outcomes");
      heading("Results people reached", "Each person counted once per outcome. The large number is everyone who reached at least one.");
      const big = m.outcomePeople.toLocaleString("en-US");
      doc.font("display").fontSize(40).fillColor(C.ink).text(big, PAGE.m, y, { lineBreak: false });
      const bigW = doc.widthOfString(big);
      doc
        .font("body")
        .fontSize(11)
        .fillColor(C.muted)
        .text(`reached an outcome (${m.prevOutcomePeople.toLocaleString("en-US")} in the previous period)`, PAGE.m + bigW + 10, y + 27, { lineBreak: false });
      y += 60;
      y = hbars(PAGE.m, y, CONTENT_W, m.outcomes.map((o) => ({ key: o.name, label: o.name, value: o.people })), C.blue, 170, false) + 34;
    }

    // ── When people come ─────────────────────────────────────────────────
    ensure(290);
    marker(num(), W.whenMarker);
    heading("Busiest times", `${W.events} by day of the week and time of day.`);
    const heatBottom = heatmap(PAGE.m, y, CONTENT_W * 0.62, m.heatmap);
    const wx = PAGE.m + CONTENT_W * 0.66;
    const wy = chartTitle(wx, y - 4, "By day of week", W.events, CONTENT_W * 0.34, `Total: ${sum(m.byWeekday).toLocaleString("en-US")}`);
    const wBottom = columns(wx, wy, CONTENT_W * 0.34, 110, m.byWeekday.map((p) => ({ ...p, label: p.label.slice(0, 3) })), C.blue);
    y = Math.max(heatBottom, wBottom) + 34;

    // ── 03 Needs ─────────────────────────────────────────────────────────
    ensure(70 + Math.max(1, m.byReason.length) * 19 + (m.services.length ? 60 + m.services.length * 18 : 0));
    marker(num(), W.needsMarker);
    if (m.services.length) {
      heading("Services", W.servicesSub);
      const showValue = m.services.some((s) => s.valueCents > 0);
      const cols: [string, number, "left" | "right"][] = [
        ["Service", CONTENT_W * (showValue ? 0.34 : 0.48), "left"],
        ["Times", CONTENT_W * 0.1, "right"],
        ["People", CONTENT_W * 0.1, "right"],
        ...(showValue ? ([[W.valueCol, CONTENT_W * 0.14, "right"]] as [string, number, "left" | "right"][]) : []),
        ["Change", CONTENT_W * 0.12, "right"],
        ["Busiest", CONTENT_W * 0.2, "left"],
      ];
      const row = (cells: string[], bold: boolean) => {
        ensure(18);
        let x = PAGE.m;
        cells.forEach((cell, i) => {
          const [, w, align] = cols[i];
          doc
            .font(bold ? "body-bold" : "body")
            .fontSize(9)
            .fillColor(C.ink)
            .text(cell, i ? x + 10 : x, y, { width: w - 10, align, lineBreak: false, ellipsis: true });
          x += w;
        });
        y += 14;
        doc.moveTo(PAGE.m, y).lineTo(PAGE.m + CONTENT_W, y).lineWidth(0.5).strokeColor(C.lineSubtle).stroke();
        y += 4;
      };
      const money = (c: number) =>
        `$${(c / 100).toLocaleString("en-US", { minimumFractionDigits: c % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;
      row(
        cols.map(([h]) => h),
        true,
      );
      for (const s of m.services) {
        row(
          [
            s.name,
            s.count.toLocaleString("en-US"),
            s.people.toLocaleString("en-US"),
            ...(showValue ? [s.valueCents ? money(s.valueCents) : "–"] : []),
            s.prevCount === 0
              ? "new"
              : `${s.count >= s.prevCount ? "+" : "−"}${Math.abs(Math.round(((s.count - s.prevCount) / s.prevCount) * 100))}%`,
            s.busiestDay ? `${s.busiestDay.slice(0, 3)}${s.busiestTime ? `, ${s.busiestTime}m` : ""}` : "–",
          ],
          false,
        );
      }
      if (showValue) {
        row(["Total", m.services.reduce((n, s) => n + s.count, 0).toLocaleString("en-US"), "", money(m.services.reduce((n, s) => n + s.valueCents, 0)), "", ""], true);
      }
      y += 22;
    }
    heading(W.reasonsTitle, `${W.events} by reason, most common first.`);
    y = hbars(PAGE.m, y, CONTENT_W, m.byReason, C.blue, 170) + 34;

    // ── 04 Who we serve ──────────────────────────────────────────────────
    const demo: [string, Point[]][] = [
      ["Gender", m.byGender],
      ["Ethnicity", m.byEthnicity],
      ["Income level", m.byIncome],
    ];
    if (audience === "nonprofit") {
    ensure(150 + demo[0][1].filter((p) => p.value > 0).length * 19);
    marker(num(), "Who we serve");
    heading("The people behind the numbers", "People served in this period, each counted once.");
    for (const [title, pts] of demo) {
      ensure(40 + pts.filter((p) => p.value > 0).length * 19);
      doc.font("body-bold").fontSize(10).fillColor(C.ink).text(title, PAGE.m, y);
      y += 18;
      y = hbars(PAGE.m, y, CONTENT_W, pts, C.blue, 190) + 18;
    }
    y += 16;
    }

    if (opts.followUps) {
      // ── 05 Follow-through ────────────────────────────────────────────────
      ensure(170);
      marker(num(), "Follow-through");
      heading("Commitments kept", "Follow-ups that were due in this period, and how they turned out.");
      const f = m.followThrough;
      if (!f.due) {
        doc.font("body").fontSize(10).fillColor(C.muted).text("No follow-ups were due in this period.", PAGE.m, y);
        y = doc.y + 20;
      } else {
        const big = `${f.onTime + f.late}`;
        doc.font("display").fontSize(40).fillColor(C.ink).text(big, PAGE.m, y, { lineBreak: false });
        const bigW = doc.widthOfString(big);
        doc.font("body").fontSize(11).fillColor(C.muted).text(`of ${f.due} done`, PAGE.m + bigW + 10, y + 27, { lineBreak: false });
        y += 56;
        const parts = [
          { n: f.onTime, color: C.blue, label: "On time" },
          { n: f.late, color: C.warn, label: "Late" },
          { n: f.open, color: C.line, label: "Not done yet" },
        ];
        let bx = PAGE.m;
        const shownParts = parts.filter((p) => p.n > 0);
        const gaps = (shownParts.length - 1) * 2;
        doc.save();
        doc.roundedRect(PAGE.m, y, CONTENT_W, 12, 6).clip();
        for (const p of shownParts) {
          const w = (p.n / f.due) * (CONTENT_W - gaps);
          doc.rect(bx, y, w, 12).fill(p.color);
          bx += w + 2;
        }
        doc.restore();
        y += 24;
        shownParts.forEach((p, i) => {
          const lx = PAGE.m + i * (CONTENT_W / 3);
          doc.roundedRect(lx, y + 1, 8, 8, 2).fill(p.color);
          doc.font("body").fontSize(8.5).fillColor(C.muted).text(p.label, lx + 13, y, { lineBreak: false });
          doc.font("body-bold").fontSize(11).fillColor(C.ink).text(`${p.n}`, lx, y + 14, { lineBreak: false });
        });
        y += 46;
      }

    }

    // ── Footers (every page but the cover) ───────────────────────────────
    const range = doc.bufferedPageRange();
    const total = range.count;
    for (let i = 1; i < total; i++) {
      doc.switchToPage(i);
      doc.page.margins.bottom = 0; // the footer sits in the margin; don't let it start a new page
      doc.rect(PAGE.m, FOOTER_Y - 8, CONTENT_W, 0.5).fill(C.line);
      doc.font("body").fontSize(7.5).fillColor(C.muted).text(`${W.report} · ${who} · ${period}`, PAGE.m, FOOTER_Y, {
        width: CONTENT_W - 60,
        lineBreak: false,
        ellipsis: true,
      });
      doc.text(`${i + 1} / ${total}`, PAGE.m, FOOTER_Y, { width: CONTENT_W, align: "right", lineBreak: false });
    }
    doc.end();
  });
}
