"use client";

import { useState } from "react";

/** Message a list: opens your own email app with everyone on the list in BCC (nothing is sent through Surfdesk). */
export function EmailEveryone({ listName, emails, missing }: { listName: string; emails: string[]; missing: number }) {
  const [copied, setCopied] = useState(false);
  if (emails.length === 0) return null;
  // Most email apps cut off very long links, so big lists open in groups of 40.
  const groups: string[][] = [];
  for (let i = 0; i < emails.length; i += 40) groups.push(emails.slice(i, i + 40));
  const href = (g: string[]) => `mailto:?bcc=${g.map(encodeURIComponent).join(",")}&subject=${encodeURIComponent(listName)}`;
  const btn = "inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm font-medium text-text hover:bg-bg-hover";
  return (
    <section className="card mt-8 space-y-2 p-4">
      <h2 className="text-sm font-semibold text-text">Email everyone on this list</h2>
      <p className="text-xs text-text-muted">
        Opens your own email app with {emails.length} {emails.length === 1 ? "person" : "people"} in BCC, so they don&apos;t see each other&apos;s
        addresses and replies come to you.
        {missing > 0 ? ` ${missing} on the list ${missing === 1 ? "has" : "have"} no email address.` : ""}
      </p>
      <div className="flex flex-wrap gap-2">
        {groups.map((g, i) => (
          <a key={i} href={href(g)} className={btn}>
            <span aria-hidden>✉️</span> {groups.length === 1 ? "Write an email" : `Email group ${i + 1} (${g.length})`}
          </a>
        ))}
        <button
          type="button"
          className={btn}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(emails.join(", "));
              setCopied(true);
            } catch {
              setCopied(false);
            }
          }}
        >
          {copied ? "Copied" : "Copy addresses"}
        </button>
      </div>
    </section>
  );
}
