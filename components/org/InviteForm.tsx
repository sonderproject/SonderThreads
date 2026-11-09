"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { createInvite } from "@/lib/actions/org";
import { ORG_ROLES, ROLE_HELP, ROLE_LABELS } from "@/lib/org-roles";

/** Admin: invite a staff member by email; shows the one-time link to send them. */
export function InviteForm({ orgName }: { orgName: string }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("case_manager");
  const [link, setLink] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCopied(false);
    startTransition(async () => {
      const result = await createInvite(email, role);
      if (!result.ok) return setError(result.error);
      setLink(`${window.location.origin}${result.data.link}`);
      setSentTo(email.trim());
      setEmail("");
      router.refresh();
    });
  }

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  const mailto = link
    ? `mailto:${encodeURIComponent(sentTo)}?subject=${encodeURIComponent(`Join ${orgName} on Sonder Threads`)}&body=${encodeURIComponent(
        `You're invited to join ${orgName} on Sonder Threads. Open this link to accept (it works once and expires in 14 days):\n\n${link}\n\nSign up or sign in with this email address.`,
      )}`
    : "";

  return (
    <div className="card space-y-3 p-4">
      <h3 className="text-sm font-semibold text-text">Invite staff</h3>
      <form onSubmit={submit} className="space-y-3">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@agency.org"
          autoComplete="off"
          className="input"
        />
        <label className="block space-y-1">
          <span className="text-xs text-text-muted">Role</span>
          <select value={role} onChange={(e) => setRole(e.target.value)} className="input">
            {ORG_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
          <span className="block text-xs text-text-faint">{ROLE_HELP[role as keyof typeof ROLE_HELP]}</span>
        </label>
        {error && <p className="text-xs text-danger">{error}</p>}
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create invite link"}
        </Button>
      </form>

      {link && (
        <div className="space-y-2 rounded border border-border p-3">
          <p className="text-sm text-text">Invite link for {sentTo}. Send it to them; it works once and expires in 14 days.</p>
          <code className="block select-all break-all rounded bg-bg-hover px-2 py-1 text-xs text-text">{link}</code>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="ghost" onClick={copy}>
              {copied ? "Copied" : "Copy link"}
            </Button>
            <a href={mailto} className="inline-flex items-center rounded-full border border-border px-3 py-1.5 text-sm font-semibold text-text hover:bg-bg-hover">
              Email it
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
