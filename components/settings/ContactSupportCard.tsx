"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { sendSupportMessage } from "@/lib/actions/support";
import { PROSE_INPUT } from "@/lib/input-props";

const TOPICS = ["Something isn't working", "Billing or my plan", "An idea or request", "Something else"];

/** Settings → About & help: write to support without leaving the app. */
export function ContactSupportCard({ supportEmail }: { supportEmail: string }) {
  const [topic, setTopic] = useState(TOPICS[0]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const r = await sendSupportMessage({ topic, message });
      if (!r.ok) return setError(r.error);
      setSentTo(r.data.email);
      setMessage("");
    });
  }

  if (sentTo) {
    return (
      <div className="card space-y-2 p-4">
        <h3 className="text-sm font-semibold text-text">Message sent</h3>
        <p className="text-sm text-text-muted">Thanks. We&apos;ll reply by email to {sentTo}.</p>
        <button type="button" onClick={() => setSentTo(null)} className="text-sm font-medium text-accent hover:underline">
          Send another message
        </button>
      </div>
    );
  }

  return (
    <form id="contact" onSubmit={submit} className="card scroll-mt-20 space-y-3 p-4">
      <div>
        <h3 className="text-sm font-semibold text-text">Contact support</h3>
        <p className="text-xs text-text-muted">
          Having trouble or have an idea? We&apos;ll reply by email. You can also write to{" "}
          <a href={`mailto:${supportEmail}`} className="text-accent hover:underline">
            {supportEmail}
          </a>
          .
        </p>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
      <label className="block">
        <span className="eyebrow mb-1 block">Topic</span>
        <select value={topic} onChange={(e) => setTopic(e.target.value)} className="input">
          {TOPICS.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="eyebrow mb-1 block">Message</span>
        <textarea
          {...PROSE_INPUT}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="input min-h-32"
          maxLength={5000}
          placeholder="What happened, and what were you trying to do?"
          required
        />
      </label>
      <Button type="submit" disabled={pending || message.trim().length < 5} className="w-full">
        {pending ? "Sending..." : "Send message"}
      </Button>
    </form>
  );
}
