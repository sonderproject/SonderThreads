"use client";

import { useEffect, useRef, useState } from "react";
import { reportCaptchaProblem } from "@/lib/actions/captcha";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, options: Record<string, unknown>) => string;
      remove: (id: string) => void;
      reset: (id: string) => void;
    };
  }
}

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let scriptLoading: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  scriptLoading ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      scriptLoading = null;
      reject(new Error("Turnstile failed to load"));
    };
    document.head.appendChild(s);
  });
  return scriptLoading;
}

type State = "loading" | "ready" | "error";

/**
 * Cloudflare Turnstile bot check, for Supabase Auth's built-in CAPTCHA.
 * Place inside a <form>: it adds a hidden `captcha_token` field that the
 * server action passes to Supabase as `captchaToken`. Usually invisible (it
 * only shows a checkbox when it's unsure).
 *
 * It never fails silently: pressing the button before the check is done waits
 * for it and then sends the form; if the check can't run (blocked script, this
 * web address not allowed in Cloudflare, ad blocker), the person sees why and a
 * Try again button, and the owner is alerted. Renders nothing until
 * NEXT_PUBLIC_TURNSTILE_SITE_KEY is set.
 */
export function Turnstile() {
  const ref = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const token = useRef<string>("");
  const waiting = useRef(false);
  const [state, setState] = useState<State>("loading");
  const [submitWait, setSubmitWait] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!SITE_KEY || !ref.current) return;
    let cancelled = false;
    setState("loading");
    const fail = (code: string) => {
      if (cancelled) return;
      setState("error");
      setSubmitWait(false);
      waiting.current = false;
      reportCaptchaProblem(code, window.location.hostname).catch(() => undefined);
    };
    loadScript()
      .then(() => {
        if (cancelled || !ref.current || !window.turnstile) return;
        widget.current = window.turnstile.render(ref.current, {
          sitekey: SITE_KEY,
          "response-field-name": "captcha_token",
          appearance: "interaction-only",
          theme: "auto",
          size: "flexible",
          callback: (t: string) => {
            token.current = t;
            setState("ready");
            // They pressed the button while the check was running: send the form now.
            if (waiting.current) {
              waiting.current = false;
              setSubmitWait(false);
              ref.current?.closest("form")?.requestSubmit();
            }
          },
          "expired-callback": () => {
            token.current = "";
            setState("loading");
            if (widget.current) window.turnstile?.reset(widget.current);
          },
          "error-callback": (code: string) => {
            fail(String(code ?? "error"));
            return true; // handled: don't throw in the console
          },
          "unsupported-callback": () => fail("unsupported"),
        });
      })
      .catch(() => fail("script-blocked"));
    // If nothing has happened after 15 seconds, say so instead of leaving them guessing.
    const slow = setTimeout(() => {
      if (!token.current && !cancelled) fail("timeout");
    }, 15_000);
    return () => {
      cancelled = true;
      clearTimeout(slow);
      if (widget.current && window.turnstile) window.turnstile.remove(widget.current);
      widget.current = null;
      token.current = "";
    };
  }, [attempt]);

  // Hold the form until the check has a token (instead of sending it without one).
  useEffect(() => {
    if (!SITE_KEY) return;
    const form = ref.current?.closest("form");
    if (!form) return;
    const onSubmit = (e: SubmitEvent) => {
      // With a token, or if the check can't run at all, send the form: the server decides
      // (if CAPTCHA is off in Supabase it signs them in; never block sign-in on our side).
      if (token.current || state === "error") return;
      e.preventDefault();
      e.stopImmediatePropagation();
      waiting.current = true;
      setSubmitWait(true);
    };
    form.addEventListener("submit", onSubmit, true);
    return () => form.removeEventListener("submit", onSubmit, true);
  }, [state]);

  if (!SITE_KEY) return null;
  return (
    <div className="space-y-1">
      <div ref={ref} className="min-h-0" />
      {submitWait && state !== "error" && (
        <p role="status" className="text-xs text-text-muted">
          Finishing a quick security check… this sends by itself in a moment.
        </p>
      )}
      {state === "error" && (
        <div role="alert" className="flag space-y-1 text-xs">
          <p>
            The security check couldn&apos;t load. You can still try signing in. If it doesn&apos;t work, turn off any ad or tracker blocker for
            this site or try another browser, then press Try again.
          </p>
          <button type="button" onClick={() => setAttempt((n) => n + 1)} className="font-semibold text-accent hover:underline">
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
