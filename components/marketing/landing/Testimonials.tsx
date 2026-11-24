import { TESTIMONIALS, type Testimonial } from "@/lib/testimonials";

/** "What people are saying": real quotes from lib/testimonials.ts. Renders nothing if there are none. */
export function Testimonials({ audience, title = "From the people using it" }: { audience?: Testimonial["audience"]; title?: string }) {
  const list = audience ? TESTIMONIALS.filter((t) => t.audience === audience) : TESTIMONIALS;
  if (list.length === 0) return null;
  return (
    <section aria-label="What people say about Surfdesk" className="space-y-5">
      <p className="eyebrow text-text-faint">{title}</p>
      <div className={`grid gap-4 ${list.length > 1 ? "md:grid-cols-2" : ""}`}>
        {list.map((t) => (
          <figure key={t.quote} className="card flex flex-col justify-between gap-5 p-6 sm:p-7">
            <blockquote className="font-display text-xl font-light leading-snug text-text sm:text-2xl">
              <span className="text-accent" aria-hidden>
                “
              </span>
              {t.quote}
              <span className="text-accent" aria-hidden>
                ”
              </span>
            </blockquote>
            <figcaption className="flex items-center gap-3 text-sm text-text-muted">
              <span className="h-px w-8 bg-accent" aria-hidden />
              {t.who}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
