import Link from "next/link";
import { TrackedLink } from "./Track";

/**
 * Building blocks for the audience landing pages, in the homepage's style
 * (app/welcome/page.tsx): numbered markers, light display headings, cards.
 */

export type Cta = { href: string; label: string; cta: string };

const PRIMARY =
  "rounded-full bg-accent px-6 py-3 text-sm font-semibold text-bg shadow-sm ring-1 ring-inset ring-white/15 transition-colors hover:bg-accent-dim";
const SECONDARY = "rounded-full border border-border bg-bg-raised px-6 py-3 text-sm font-semibold text-text transition-colors hover:bg-bg-hover";

export function Marker({ n, children }: { n: string; children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-3 text-[11px] font-medium uppercase tracking-[0.25em] text-text-muted">
      <span className="tabular-nums text-accent">{n}</span>
      <span className="h-px w-10" style={{ background: "color-mix(in srgb, var(--accent) 45%, transparent)" }} aria-hidden />
      {children}
    </p>
  );
}

export function Buttons({ page, primary, secondary, center = false }: { page: string; primary: Cta; secondary?: Cta; center?: boolean }) {
  return (
    <div className={`flex flex-wrap gap-3 ${center ? "justify-center" : ""}`}>
      <TrackedLink page={page} cta={primary.cta} href={primary.href} className={PRIMARY}>
        {primary.label}
      </TrackedLink>
      {secondary && (
        <TrackedLink page={page} cta={secondary.cta} href={secondary.href} className={SECONDARY}>
          {secondary.label}
        </TrackedLink>
      )}
    </div>
  );
}

export function Hero({
  page,
  eyebrow,
  lead,
  accent,
  sub,
  primary,
  secondary,
  fine,
  extra,
  aside,
}: {
  page: string;
  eyebrow: string;
  lead: string;
  accent: string;
  sub: string;
  primary: Cta;
  secondary: Cta;
  fine: string;
  extra?: React.ReactNode;
  aside: React.ReactNode;
}) {
  return (
    <section className="grid gap-10 py-14 sm:py-20 lg:grid-cols-[1.3fr_1fr] lg:items-center">
      <div className="space-y-6">
        <Marker n="01">{eyebrow}</Marker>
        <h1 className="font-display text-4xl font-light leading-[1.05] tracking-[-0.02em] sm:text-5xl lg:text-[3.15rem]">
          {lead} <span className="block text-accent">{accent}</span>
        </h1>
        <p className="max-w-xl text-base leading-relaxed text-text-muted sm:text-lg">{sub}</p>
        <Buttons page={page} primary={primary} secondary={secondary} />
        <p className="text-sm text-text-muted">{fine}</p>
        {extra}
      </div>
      <div>{aside}</div>
    </section>
  );
}

export function Section({
  n,
  marker,
  title,
  accent,
  lede,
  id,
  children,
}: {
  n: string;
  marker: string;
  title: string;
  accent?: string;
  lede?: React.ReactNode;
  id?: string;
  children?: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20 space-y-8 border-t border-border py-16">
      <div className="space-y-5">
        <Marker n={n}>{marker}</Marker>
        <h2 className="max-w-3xl font-display text-3xl font-light leading-tight tracking-[-0.02em] sm:text-4xl">
          {title} {accent && <span className="text-accent">{accent}</span>}
        </h2>
        {lede && <div className="max-w-2xl space-y-3 text-base leading-relaxed text-text-muted sm:text-lg">{lede}</div>}
      </div>
      {children}
    </section>
  );
}

/** "Sound familiar?" problem cards. */
export function Pains({ items }: { items: string[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-3">
      {items.map((p) => (
        <li key={p} className="card flex gap-3 p-5 text-sm leading-relaxed text-text-muted">
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-urgent" aria-hidden />
          {p}
        </li>
      ))}
    </ul>
  );
}

export function Benefits({ items }: { items: { title: string; body: string }[] }) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {items.map((b, i) => (
        <div key={b.title} className="card space-y-2 p-6 transition-transform duration-200 motion-safe:hover:-translate-y-1">
          <p className="font-display text-3xl font-light tabular-nums text-accent">0{i + 1}</p>
          <h3 className="font-display text-xl font-normal leading-snug">{b.title}</h3>
          <p className="text-sm leading-relaxed text-text-muted">{b.body}</p>
        </div>
      ))}
    </div>
  );
}

export type Feature = { title: string; body: string; team?: boolean };

/** Compact feature list. `team` marks features on team plans only. */
export function Features({ items, teamNote }: { items: Feature[]; teamNote?: string }) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((f) => (
          <div key={f.title} className="card space-y-1 p-5">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold text-text">{f.title}</h3>
              {f.team && <span className="tag tag-v whitespace-nowrap">Team plans</span>}
            </div>
            <p className="text-sm leading-relaxed text-text-muted">{f.body}</p>
          </div>
        ))}
      </div>
      {teamNote && <p className="text-xs text-text-muted">{teamNote}</p>}
    </div>
  );
}

/** Verified safeguards only: never add a certification Surfdesk doesn't hold. */
export function Trust({ items }: { items: { title: string; body: string }[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((d) => (
        <div key={d.title} className="card space-y-1.5 p-5">
          <p className="flex items-center gap-2 font-semibold text-text">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent-soft text-[11px] text-accent" aria-hidden>
              ✓
            </span>
            {d.title}
          </p>
          <p className="text-sm text-text-muted">{d.body}</p>
        </div>
      ))}
    </div>
  );
}

export function Faq({ items }: { items: { q: string; a: string }[] }) {
  return (
    <div className="space-y-3">
      {items.map((f) => (
        <details key={f.q} className="card p-5">
          <summary className="cursor-pointer font-semibold">{f.q}</summary>
          <p className="mt-3 text-sm leading-relaxed text-text-muted">{f.a}</p>
        </details>
      ))}
    </div>
  );
}

export function FinalCta({
  page,
  title,
  accent,
  body,
  primary,
  fine,
  extra,
}: {
  page: string;
  title: string;
  accent: string;
  body: string[];
  primary: Cta;
  fine: string;
  extra?: React.ReactNode;
}) {
  return (
    <section className="space-y-6 border-t border-border py-20 text-center sm:py-24">
      <h2 className="mx-auto max-w-3xl font-display text-4xl font-light leading-tight tracking-[-0.02em] sm:text-5xl">
        {title} <span className="text-accent">{accent}</span>
      </h2>
      <div className="mx-auto max-w-xl space-y-2 text-base leading-relaxed text-text-muted sm:text-lg">
        {body.map((b) => (
          <p key={b}>{b}</p>
        ))}
      </div>
      <Buttons page={page} primary={primary} center />
      <p className="text-sm text-text-muted">{fine}</p>
      {extra}
      <p className="pt-6 font-display text-sm font-light uppercase tracking-[0.25em] text-text-muted">
        Surfdesk. <span className="text-accent">Keep everything moving.</span>
      </p>
    </section>
  );
}

/** Links to the other audience pages, so visitors who landed on the wrong one find theirs. */
export function OtherAudiences({ links }: { links: { path: string; label: string }[] }) {
  return (
    <section className="space-y-3 border-t border-border py-10">
      <p className="section-label">Surfdesk is also for</p>
      <ul className="flex flex-wrap gap-2">
        {links.map((r) => (
          <li key={r.path}>
            <Link href={r.path} className="inline-block rounded-full border border-border px-3 py-1.5 text-xs text-text-muted hover:text-text">
              {r.label}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
