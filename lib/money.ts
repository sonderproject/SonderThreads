/** "$1,250" / "$9.50" from cents (safe to import in the browser). */
export function formatMoney(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;
}

/** "45", "$45.50", "1,200" → cents; "" → null; anything else → NaN. */
export function parseMoney(input: string | null | undefined): number | null {
  const t = (input ?? "").replace(/[$,\s]/g, "");
  if (!t) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return NaN;
  return Math.round(Number(t) * 100);
}
