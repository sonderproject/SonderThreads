"use client";

/**
 * A form whose server action returns the URL to show next; the page then reloads to it.
 * Used on Reports, where a redirect from a server action was occasionally not followed
 * (the save went through but the button kept spinning).
 */
export function ActionForm({ action, className, children }: { action: (fd: FormData) => Promise<string>; className?: string; children: React.ReactNode }) {
  return (
    <form
      className={className}
      action={async (fd) => {
        const next = await action(fd);
        if (next.startsWith("/reports")) window.location.assign(next);
      }}
    >
      {children}
    </form>
  );
}
