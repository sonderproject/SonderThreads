import { normalizeBirthday } from "@/lib/csv";
import { normalizePhone } from "@/lib/notify/phone";

/** Year stored for a birthday typed without one ("05/12"). A leap year, so 02/29 works. */
export const NO_BIRTH_YEAR = 1904;

export type PersonLine = { name: string; phone: string | null; birthday: string | null };

/**
 * Splits a list item like "Marcus Johnson 05/12/1998 5551234567" into its
 * parts: the birthday is two digits then a slash (05/12, 05/12/98,
 * 05/12/1998), the phone is a run of 7+ digits, and the name is whatever
 * letters are left.
 */
export function parsePersonLine(label: string): PersonLine {
  let rest = label;

  let birthday: string | null = null;
  const bday = rest.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?\b/);
  if (bday) {
    birthday = bday[3]
      ? normalizeBirthday(bday[0])
      : normalizeBirthday(`${bday[1]}/${bday[2]}/${NO_BIRTH_YEAR}`);
    rest = rest.replace(bday[0], " ");
  }

  let phone: string | null = null;
  const tel = rest.match(/\+?\d[\d\s().-]{5,}\d/);
  if (tel && tel[0].replace(/\D/g, "").length >= 7) {
    phone = normalizePhone(tel[0]) ?? tel[0].replace(/[^\d+]/g, "");
    rest = rest.replace(tel[0], " ");
  }

  const name = rest
    .replace(/[^\p{L}\s'-]/gu, " ")
    .replace(/(^|\s)['-]+|['-]+(?=\s|$)/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return { name, phone, birthday };
}
