"use client";

import { useLayoutEffect, useRef, useState } from "react";

const URL_RE = /(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+)/gi;
const TRAILING = /[.,;:!?)\]}'"]+$/;
const COLLAPSED_LINES = 4;

/** "https://event.example.com/a/b?x=1" → "event.example.com/a/b…", so a long link doesn't swamp the note. */
function shortUrl(href: string): string {
  try {
    const u = new URL(href);
    const host = u.hostname.replace(/^www\./, "");
    const path = u.pathname === "/" ? "" : u.pathname;
    const full = host + path;
    const more = Boolean(u.search || u.hash);
    return full.length > 40 ? `${full.slice(0, 38)}…` : more ? `${full}…` : full;
  } catch {
    return href.length > 40 ? `${href.slice(0, 38)}…` : href;
  }
}

/** Note text with its line breaks kept, links clickable, and long notes collapsed to a few lines with "More". */
export function NoteText({ content }: { content: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || expanded) return;
    const check = () => setOverflows(el.scrollHeight > el.clientHeight + 1);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [content, expanded]);

  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const m of content.matchAll(URL_RE)) {
    const raw = m[0];
    const trail = raw.match(TRAILING)?.[0] ?? "";
    const link = trail ? raw.slice(0, -trail.length) : raw;
    const start = m.index ?? 0;
    if (start > last) parts.push(content.slice(last, start));
    const href = link.toLowerCase().startsWith("http") ? link : `https://${link}`;
    parts.push(
      <a
        key={start}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        title={href}
        className="text-accent underline underline-offset-2"
      >
        {shortUrl(href)}
      </a>,
    );
    if (trail) parts.push(trail);
    last = start + raw.length;
  }
  if (last < content.length) parts.push(content.slice(last));

  return (
    <div>
      <p
        ref={ref}
        className="whitespace-pre-wrap text-sm text-text [overflow-wrap:anywhere]"
        style={expanded ? undefined : { display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: COLLAPSED_LINES, overflow: "hidden" }}
      >
        {parts}
      </p>
      {(overflows || expanded) && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
          className="mt-1 text-xs font-medium text-accent hover:underline"
        >
          {expanded ? "Less" : "More"}
        </button>
      )}
    </div>
  );
}
