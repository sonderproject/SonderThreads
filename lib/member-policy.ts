import { cache } from "react";
import { requireUserId } from "@/lib/current-user";
import { memberPolicyFor } from "@/lib/member-policy-core";

export { MANAGED_DATA_MESSAGE, memberPolicyFor, type MemberPolicy } from "@/lib/member-policy-core";

/** The signed-in person's Member data rules (lib/member-policy-core.ts), once per request. */
export const getMemberPolicy = cache(async () => memberPolicyFor(await requireUserId()));
