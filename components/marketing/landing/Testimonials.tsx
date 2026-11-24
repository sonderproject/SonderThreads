import { TESTIMONIALS, type Testimonial } from "@/lib/testimonials";

function Stars() {
  return (
    <span className="flex gap-0.5 text-warn" aria-label="5 stars">
      {Array.from({ length: 5 }, (_, i) => (
        <svg key={i} viewBox="0 0 20 20" className="h-4 w-4 fill-current" aria-hidden>
          <path d="M10 1.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L10 14.9l-5.2 2.7 1-5.8L1.5 7.7l5.9-.9z" />
        </svg>
      ))}
    </span>
  );
}

/** Real quotes from lib/testimonials.ts, as small cards with stars. Renders nothing if there are none. */
export function Testimonials({ audience, title = "What people are saying" }: { audience?: Testimonial["audience"]; title?: string }) {
  const list = audience ? TESTIMONIALS.filter((t) => t.audience === audience) : TESTIMONIALS;
  if (list.length === 0) return null;
  const cols = list.length >= 4 ? "sm:grid-cols-2 lg:grid-cols-4" : list.length > 1 ? "sm:grid-cols-2" : "";
  // Phones: one swipeable row instead of a tall stack.
  return (
    <section aria-label="What people say about Surfdesk" className="space-y-4">
      <p className="eyebrow text-center text-text-faint">{title}</p>
      <div className={`-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:overflow-visible sm:px-0 sm:pb-0 ${cols}`}>
        {list.map((t) => (
          <figure key={t.quote} className="card flex w-[82%] shrink-0 snap-start flex-col gap-3 p-4 sm:w-auto">
            <Stars />
            <blockquote className="flex-1 text-sm leading-relaxed text-text">&ldquo;{t.quote}&rdquo;</blockquote>
            <figcaption className="text-xs text-text-muted">{t.who}</figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
