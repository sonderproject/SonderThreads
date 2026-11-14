"use client";

import { useEffect } from "react";

const KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content"] as const;

/**
 * Ad attribution without cookies: when someone lands from a tagged ad link
 * (?utm_source=linkedin&utm_campaign=...), the tags are copied onto this page's
 * sign-up links, so the sign-up form can record which campaign brought them.
 * Nothing is stored in the browser.
 */
export function CampaignLinks() {
  useEffect(() => {
    const here = new URLSearchParams(window.location.search);
    const tags = KEYS.filter((k) => here.get(k));
    if (!tags.length) return;
    document.querySelectorAll<HTMLAnchorElement>('a[href^="/signup"], a[href^="/get-started"]').forEach((a) => {
      const url = new URL(a.getAttribute("href")!, window.location.origin);
      for (const k of tags) url.searchParams.set(k, here.get(k)!.slice(0, 80));
      a.setAttribute("href", url.pathname + url.search);
    });
  }, []);
  return null;
}
