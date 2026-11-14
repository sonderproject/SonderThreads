"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createCheckInSafe } from "@/lib/actions/check-ins";
import { useTerms } from "@/components/TermsProvider";

/**
 * Call, Text and Email buttons beside a person's phone and email (separate
 * from the fields, which still edit on tap). After a call or text, one tap
 * logs it as a check-in/visit/meeting ("Phone call" / "Text message").
 */
export function ContactActions({ personId, phone, email }: { personId: string; phone: string | null; email: string | null }) {
  const terms = useTerms();
  const router = useRouter();
  const [offer, setOffer] = useState<"Phone call" | "Text message" | "Email" | null>(null);
  const [logged, setLogged] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const tel = phone?.replace(/[^\d+]/g, "") ?? "";
  if (!tel && !email) return null;

  const log = () =>
    start(async () => {
      setError(null);
      const r = await createCheckInSafe({ personId, reason: offer });
      if (!r.ok) return setError(r.error);
      setLogged(`${offer} logged as a ${terms.checkInLower}.`);
      setOffer(null);
      router.refresh();
    });

  const btn = "inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm font-medium text-text hover:bg-bg-hover";
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {tel && (
          <>
            <a href={`tel:${tel}`} onClick={() => setOffer("Phone call")} className={btn}>
              <span aria-hidden>📞</span> Call
            </a>
            <a href={`sms:${tel}`} onClick={() => setOffer("Text message")} className={btn}>
              <span aria-hidden>💬</span> Text
            </a>
          </>
        )}
        {email && (
          <a href={`mailto:${email}`} onClick={() => setOffer("Email")} className={btn}>
            <span aria-hidden>✉️</span> Email
          </a>
        )}
      </div>
      {offer && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <button
            type="button"
            disabled={pending}
            onClick={log}
            className="rounded-full bg-accent px-3 py-1.5 font-semibold text-bg hover:bg-accent-dim disabled:opacity-60"
          >
            {pending ? "Logging…" : `Log ${offer.toLowerCase()} as a ${terms.checkInLower}`}
          </button>
          <button type="button" onClick={() => setOffer(null)} className="text-text-muted hover:text-text">
            No thanks
          </button>
        </div>
      )}
      {logged && (
        <p role="status" className="text-xs text-accent">
          {logged}
        </p>
      )}
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
