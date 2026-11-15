import { dismissAnnouncement } from "@/lib/actions/announce";

/** The owner's announcement (command center → Controls), shown once per person until dismissed. */
export function Announcement({ id, text, link }: { id: string; text: string; link: string | null }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-border bg-bg-raised px-4 py-2.5 text-sm">
      <p className="min-w-0">
        <span className="tag tag-n mr-2">New</span>
        {text}
        {link && (
          <>
            {" "}
            <a href={link} className="font-semibold text-accent hover:underline">
              Learn more →
            </a>
          </>
        )}
      </p>
      <form action={dismissAnnouncement}>
        <input type="hidden" name="id" value={id} />
        <button type="submit" aria-label="Dismiss" className="shrink-0 rounded-full px-2 text-text-muted hover:bg-bg-hover hover:text-text">
          ×
        </button>
      </form>
    </div>
  );
}
