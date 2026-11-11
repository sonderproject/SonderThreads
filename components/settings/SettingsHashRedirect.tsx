"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { HASH_TO_SECTION } from "@/lib/settings-sections";

/** Old links like /settings#billing open the section that now holds it. */
export function SettingsHashRedirect() {
  const router = useRouter();
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    const section = HASH_TO_SECTION[hash];
    if (section) router.replace(`/settings/${section}${hash === section ? "" : `#${hash}`}`);
  }, [router]);
  return null;
}
