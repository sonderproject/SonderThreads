"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

type Mode = "password" | "magic-link";

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const supabase = createClient();

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setStatus(null);

    const { error } = isSignUp
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    if (isSignUp) {
      setStatus("Account created. Check your email to confirm, then sign in.");
      return;
    }

    window.location.href = "/";
  }

  async function handleMagicLinkSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setStatus(null);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    setStatus("Check your email for a magic link.");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="font-mono text-accent text-sm mb-1">&gt; client-command-center</p>
          <h1 className="text-xl font-semibold text-text">Sign in</h1>
        </div>

        <Card className="p-6">
          <div className="mb-5 flex gap-1 rounded bg-bg p-1 text-sm">
            <button
              type="button"
              onClick={() => setMode("password")}
              className={`flex-1 rounded px-2 py-1 transition-colors ${
                mode === "password" ? "bg-bg-hover text-text" : "text-text-muted"
              }`}
            >
              Password
            </button>
            <button
              type="button"
              onClick={() => setMode("magic-link")}
              className={`flex-1 rounded px-2 py-1 transition-colors ${
                mode === "magic-link" ? "bg-bg-hover text-text" : "text-text-muted"
              }`}
            >
              Magic link
            </button>
          </div>

          <form
            onSubmit={mode === "password" ? handlePasswordSubmit : handleMagicLinkSubmit}
            className="space-y-3"
          >
            <div>
              <label className="mb-1 block text-xs text-text-muted">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-text-faint focus:border-accent"
                placeholder="you@example.com"
              />
            </div>

            {mode === "password" && (
              <div>
                <label className="mb-1 block text-xs text-text-muted">Password</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-text-faint focus:border-accent"
                  placeholder="••••••••"
                />
              </div>
            )}

            {error && <p className="text-xs text-danger">{error}</p>}
            {status && <p className="text-xs text-accent">{status}</p>}

            <Button type="submit" disabled={loading} className="w-full">
              {loading
                ? "Working..."
                : mode === "password"
                  ? isSignUp
                    ? "Create account"
                    : "Sign in"
                  : "Send magic link"}
            </Button>
          </form>

          {mode === "password" && (
            <button
              type="button"
              onClick={() => setIsSignUp((s) => !s)}
              className="mt-4 w-full text-center text-xs text-text-muted hover:text-text"
            >
              {isSignUp ? "Already have an account? Sign in" : "No account? Create one"}
            </button>
          )}
        </Card>
      </div>
    </div>
  );
}
