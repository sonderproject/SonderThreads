const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True for a well-formed UUID, so a mistyped link 404s instead of erroring in Postgres. */
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}
