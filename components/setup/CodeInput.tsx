"use client";

/** The 6-digit email code box: sends the form by itself once six digits are in (typed or pasted). */
export function CodeInput() {
  return (
    <input
      name="code"
      required
      inputMode="numeric"
      autoComplete="one-time-code"
      spellCheck={false}
      autoFocus
      pattern="[0-9 ]{6,12}"
      maxLength={12}
      placeholder="6-digit code"
      aria-label="6-digit code from the email"
      className="input text-center text-lg tracking-[0.3em] tabular-nums"
      onChange={(e) => {
        const digits = e.currentTarget.value.replace(/\D/g, "");
        if (digits.length === 6) e.currentTarget.form?.requestSubmit();
      }}
    />
  );
}
