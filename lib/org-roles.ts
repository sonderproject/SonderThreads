/** Organization roles and their labels (safe to import in the browser). */
export type OrgRole = "admin" | "supervisor" | "case_manager";
export const ORG_ROLES: OrgRole[] = ["case_manager", "supervisor", "admin"];
export const ROLE_LABELS: Record<OrgRole, string> = {
  admin: "Admin",
  supervisor: "Manager",
  case_manager: "Member",
};
export const ROLE_HELP: Record<OrgRole, string> = {
  case_manager: "Works with their own clients.",
  supervisor: "Also sees every client and every member's work, read-only. Never anyone's personal records.",
  admin: "Manager access, plus invites people, changes roles and deactivates people.",
};

export function isOrgRole(value: unknown): value is OrgRole {
  return value === "admin" || value === "supervisor" || value === "case_manager";
}
