"use server";

import { headers } from "next/headers";
import { acceptSubmission, ipHashFor, type SubmitResult } from "@/lib/forms-intake";

/**
 * The public form's submit (no sign-in). Answers go straight to the database: never into
 * the URL, analytics or logs. Every check runs on the server (lib/forms-intake.ts).
 */
export async function submitPublicForm(formData: FormData): Promise<SubmitResult> {
  const code = (formData.get("__code")?.toString() ?? "").slice(0, 40);
  const raw: Record<string, unknown> = {};
  for (const key of new Set(formData.keys())) {
    if (key.startsWith("__") || key.length > 20) continue;
    const all = formData.getAll(key).map((v) => (typeof v === "string" ? v : ""));
    raw[key] = all.length > 1 || key.endsWith("[]") ? all : all[0];
  }
  // Checkbox groups are sent as "<id>[]".
  for (const key of Object.keys(raw)) if (key.endsWith("[]")) raw[key.slice(0, -2)] = ([] as string[]).concat(raw[key] as string[]);
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "unknown";
  try {
    return await acceptSubmission({
      code,
      raw,
      ipHash: ipHashFor(ip),
      stamp: formData.get("__started")?.toString() ?? "",
      honeypot: formData.get("__website")?.toString() ?? "",
    });
  } catch {
    return { ok: false, reason: "busy" };
  }
}
