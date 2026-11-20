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

/** Links in plain text. */
function linkify(text: string, key: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(URL_RE)) {
    const raw = m[0];
    const trail = raw.match(TRAILING)?.[0] ?? "";
    const link = trail ? raw.slice(0, -trail.length) : raw;
    const start = m.index ?? 0;
    if (start > last) parts.push(text.slice(last, start));
    const href = link.toLowerCase().startsWith("http") ? link : `https://${link}`;
    parts.push(
      <a
        key={`${key}-${start}`}
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
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

/** **bold** and _italic_ (or *italic*), then links inside each piece. */
function inline(text: string, key: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /\*\*(.+?)\*\*|(?<![\w*])_(.+?)_(?!\w)|(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?![\w*])/g;
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(re)) {
    const start = m.index ?? 0;
    if (start > last) out.push(...linkify(text.slice(last, start), `${key}-t${i}`));
    if (m[1] !== undefined) out.push(<strong key={`${key}-b${i}`} className="font-semibold">{linkify(m[1], `${key}-b${i}`)}</strong>);
    else out.push(<em key={`${key}-i${i}`}>{linkify(m[2] ?? m[3], `${key}-i${i}`)}</em>);
    last = start + m[0].length;
    i++;
  }
  if (last < text.length) out.push(...linkify(text.slice(last), `${key}-t${i}`));
  return out;
}

const BULLET = /^\s*[-*•]\s+/;
const NUMBERED = /^\s*(\d+)[.)]\s+/;
const HEADING = /^(#{1,3})\s+/;

/** Turns note text into blocks: headings (# ), bullet lists (- ), numbered lists (1. ) and lines. */
export function renderNote(content: string): React.ReactNode[] {
  const lines = content.split("\n");
  const blocks: React.ReactNode[] = [];
  for (let i = 0; i < lines.length; ) {
    const line = lines[i];
    const h = line.match(HEADING);
    if (h) {
      const big = h[1].length === 1;
      blocks.push(
        <p key={i} className={`${big ? "text-lg" : "text-base"} mt-1 font-semibold text-text first:mt-0`}>
          {inline(line.slice(h[0].length), `h${i}`)}
        </p>,
      );
      i++;
      continue;
    }
    if (BULLET.test(line) || NUMBERED.test(line)) {
      const numbered = NUMBERED.test(line);
      const pattern = numbered ? NUMBERED : BULLET;
      const startAt = numbered ? Number(line.match(NUMBERED)![1]) : undefined;
      const items: React.ReactNode[] = [];
      const first = i;
      while (i < lines.length && pattern.test(lines[i])) {
        items.push(<li key={i}>{inline(lines[i].replace(pattern, ""), `l${i}`)}</li>);
        i++;
      }
      blocks.push(
        numbered ? (
          <ol key={`ol${first}`} start={startAt} className="list-decimal space-y-0.5 pl-5">
            {items}
          </ol>
        ) : (
          <ul key={`ul${first}`} className="list-disc space-y-0.5 pl-5">
            {items}
          </ul>
        ),
      );
      continue;
    }
    blocks.push(
      <p key={i} className="min-h-[1.25em]">
        {inline(line, `p${i}`)}
      </p>,
    );
    i++;
  }
  return blocks;
}

/**
 * Note text with formatting, line breaks and clickable links. On cards (collapse) long notes show
 * a few lines with "More"; on a note's own page the whole note shows.
 */
export function NoteText({ content, collapse = true, className = "" }: { content: string; collapse?: boolean; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const clamped = collapse && !expanded;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !clamped) return;
    const check = () => setOverflows(el.scrollHeight > el.clientHeight + 1);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [content, clamped]);

  return (
    <div>
      <div
        ref={ref}
        className={`text-sm text-text [overflow-wrap:anywhere] ${className}`}
        style={clamped ? { display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: COLLAPSED_LINES, overflow: "hidden", maxHeight: `${COLLAPSED_LINES * 1.4}rem` } : undefined}
      >
        {renderNote(content)}
      </div>
      {collapse && (overflows || expanded) && (
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
