import https from "node:https";
import dns from "node:dns";
import net from "node:net";

/**
 * Fetches someone's outside calendar (.ics) by the private link they pasted.
 * The link is user-supplied, so this only talks to public HTTPS servers: every
 * address a host resolves to is checked at connect time (no internal or
 * private networks), redirects are re-checked, and size and time are capped.
 */

const MAX_BYTES = 5 * 1024 * 1024;
const TIMEOUT_MS = 8000;
const MAX_REDIRECTS = 3;

export class CalendarFetchError extends Error {}

/** webcal:// → https://, trims, and rejects anything that isn't a plain https URL. Returns null if unusable. */
export function normalizeCalendarUrl(raw: string): string | null {
  let s = raw.trim();
  if (/^webcals?:\/\//i.test(s)) s = s.replace(/^webcals?:\/\//i, "https://");
  let url: URL;
  try {
    url = new URL(s);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password) return null;
  if (url.port && url.port !== "443") return null;
  const host = url.hostname.toLowerCase();
  if (!host.includes(".") || host.endsWith(".local") || host.endsWith(".internal") || host === "localhost") return null;
  if (net.isIP(host.replace(/^\[|\]$/g, ""))) return null; // a host name, not a raw address
  return url.toString();
}

function isPublicAddress(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    if (a === 10 || a === 127 || a === 0) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
    if (a === 100 && b >= 64 && b <= 127) return false; // carrier-grade NAT
    if (a >= 224) return false; // multicast / reserved
    return true;
  }
  const v6 = ip.toLowerCase();
  if (v6 === "::" || v6 === "::1") return false;
  if (v6.startsWith("::ffff:")) return isPublicAddress(v6.slice(7));
  if (/^f[cd]/.test(v6) || /^fe[89ab]/.test(v6) || v6.startsWith("ff")) return false;
  return true;
}

/** DNS lookup that refuses non-public addresses, so the check holds for the address actually connected to. */
const safeLookup: net.LookupFunction = (hostname, options, callback) => {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, "", 0);
    const list = addresses as dns.LookupAddress[];
    const bad = list.find((a) => !isPublicAddress(a.address));
    if (bad || list.length === 0) {
      return callback(new CalendarFetchError("That address isn't a public calendar link."), "", 0);
    }
    if ((options as dns.LookupOptions).all) return (callback as unknown as (e: null, a: dns.LookupAddress[]) => void)(null, list);
    callback(null, list[0].address, list[0].family);
  });
};

function getOnce(url: string): Promise<{ status: number; location?: string; body?: string; type?: string }> {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        lookup: safeLookup,
        timeout: TIMEOUT_MS,
        headers: { "user-agent": "StryndCalendar/1.0", accept: "text/calendar, */*;q=0.5", "accept-encoding": "identity" },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400 && res.headers.location) {
          res.resume();
          return resolve({ status, location: res.headers.location });
        }
        if (status !== 200) {
          res.resume();
          return resolve({ status });
        }
        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (c: Buffer) => {
          size += c.length;
          if (size > MAX_BYTES) {
            req.destroy(new CalendarFetchError("That calendar is too large to show."));
            return;
          }
          chunks.push(c);
        });
        res.on("end", () => resolve({ status, body: Buffer.concat(chunks).toString("utf8"), type: res.headers["content-type"] }));
        res.on("error", reject);
      },
    );
    req.on("timeout", () => req.destroy(new CalendarFetchError("The calendar took too long to answer.")));
    req.on("error", reject);
  });
}

/** The .ics text at `url`, or a CalendarFetchError with a message fit to show the person. */
export async function fetchCalendarText(rawUrl: string): Promise<string> {
  let url = normalizeCalendarUrl(rawUrl);
  if (!url) throw new CalendarFetchError("Use the calendar's https:// or webcal:// link.");
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    let res;
    try {
      res = await getOnce(url);
    } catch (err) {
      if (err instanceof CalendarFetchError) throw err;
      throw new CalendarFetchError("Couldn't reach that calendar.");
    }
    if (res.location) {
      const next = normalizeCalendarUrl(new URL(res.location, url).toString());
      if (!next) throw new CalendarFetchError("The calendar link redirected somewhere it can't be read from.");
      url = next;
      continue;
    }
    if (res.status === 401 || res.status === 403 || res.status === 404) {
      throw new CalendarFetchError("The calendar link didn't work. It may have been reset; copy a fresh one.");
    }
    if (res.status !== 200 || res.body === undefined) throw new CalendarFetchError(`The calendar answered with an error (${res.status}).`);
    if (!res.body.includes("BEGIN:VCALENDAR")) {
      throw new CalendarFetchError("That link isn't a calendar file. Use the private iCal / .ics address.");
    }
    return res.body;
  }
  throw new CalendarFetchError("The calendar link redirected too many times.");
}
