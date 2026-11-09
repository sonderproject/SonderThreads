/** Organization roles and their labels (safe to import in the browser). */
export type OrgRole = "admin" | "supervisor" | "case_manager";
export const ORG_ROLES: OrgRole[] = ["case_manager", "supervisor", "admin"];
export const ROLE_LABELS: Record<OrgRole, string> = {
  admin: "Admin",
  supervisor: "Supervisor",
  case_manager: "Case manager",
};
export const ROLE_HELP: Record<OrgRole, string> = {
  case_manager: "Works their own caseload.",
  supervisor: "Also sees every client in the organization, read-only. Never anyone's personal records.",
  admin: "Supervisor access, plus invites staff, changes roles and deactivates people.",
};

export function isOrgRole(value: unknown): value is OrgRole {
  return value === "admin" || value === "supervisor" || value === "case_manager";
}
