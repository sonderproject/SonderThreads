"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  getAppPassword,
  safeEqual,
  safeNextPath,
  sessionToken,
} from "@/lib/auth";

export async function login(formData: FormData): Promise<void> {
  const next = safeNextPath(formData.get("next")?.toString());
  const attempt = formData.get("password")?.toString() ?? "";
  const password = getAppPassword();

  if (!password || !safeEqual(attempt, password)) {
    // Slow down guessing — there's no per-IP lockout on serverless.
    await new Promise((r) => setTimeout(r, 1000));
    redirect(`/login?error=1${next !== "/" ? `&next=${encodeURIComponent(next)}` : ""}`);
  }

  (await cookies()).set(SESSION_COOKIE, await sessionToken(password), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  redirect(next);
}

export async function logout(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
