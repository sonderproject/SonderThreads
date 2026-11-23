"use client";

import { useState, useTransition } from "react";
import { submitPublicForm } from "@/app/f/[code]/actions";
import { isInputField, type FormField } from "@/lib/forms-shared";

const BUSY: Record<string, string> = {
  busy: "Too many answers from this network just now. Please try again in a little while.",
  paused: "This form isn't taking answers right now.",
  closed: "This form is closed.",
  full: "This form is full.",
  maintenance: "We're making a quick update. Please try again in a few minutes.",
  gone: "This form link isn't working anymore.",
};

/** One field as the person filling the form sees it. Also used by the builder's preview. */
export function FieldInput({ f, error, disabled = false }: { f: FormField; error?: string; disabled?: boolean }) {
  const describedBy = [f.description ? `${f.id}-d` : "", error ? `${f.id}-e` : ""].filter(Boolean).join(" ") || undefined;
  const common = { id: f.id, name: f.id, required: f.required, disabled, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy };
  const label = (
    <span className="text-sm font-medium text-text">
      {f.label}
      {f.required && <span className="text-urgent" aria-hidden> *</span>}
    </span>
  );
  const help = f.description ? (
    <span id={`${f.id}-d`} className="block whitespace-pre-line text-xs text-text-muted">
      {f.description}
    </span>
  ) : null;
  const err = error ? (
    <span id={`${f.id}-e`} className="block text-xs font-medium text-urgent">
      {error}
    </span>
  ) : null;

  if (f.type === "heading") {
    return (
      <div className="space-y-1 pt-2">
        <h2 className="font-display text-lg text-text">{f.label}</h2>
        {help}
      </div>
    );
  }
  if (f.type === "info") {
    return (
      <div className="rounded-xl border border-border-subtle bg-bg-raised p-3 text-sm text-text-muted">
        <p className="font-medium text-text">{f.label}</p>
        {f.description && <p className="mt-1 whitespace-pre-line">{f.description}</p>}
      </div>
    );
  }

  if (f.type === "multiple_choice" || f.type === "checkboxes" || f.type === "yes_no" || f.type === "rating") {
    const multi = f.type === "checkboxes";
    const options =
      f.type === "yes_no"
        ? [
            ["yes", "Yes"],
            ["no", "No"],
          ]
        : f.type === "rating"
          ? ["1", "2", "3", "4", "5"].map((n) => [n, n])
          : (f.options ?? []).map((o) => [o, o]);
    return (
      <fieldset className="space-y-2" aria-describedby={describedBy} aria-invalid={error ? true : undefined}>
        <legend className="mb-1">{label}</legend>
        {help}
        <div className={f.type === "rating" || f.type === "yes_no" ? "flex flex-wrap gap-2" : "space-y-1.5"}>
          {options.map(([value, text]) => (
            <label
              key={value}
              className={
                f.type === "rating" || f.type === "yes_no"
                  ? "flex min-w-12 cursor-pointer items-center justify-center rounded-full border border-border px-4 py-2 text-sm has-[:checked]:border-accent has-[:checked]:bg-accent-soft has-[:checked]:text-accent"
                  : "flex cursor-pointer items-start gap-2.5 rounded-xl border border-border-subtle px-3 py-2.5 text-sm has-[:checked]:border-accent"
              }
            >
              <input
                type={multi ? "checkbox" : "radio"}
                name={multi ? `${f.id}[]` : f.id}
                value={value}
                required={!multi && f.required}
                disabled={disabled}
                className={f.type === "rating" || f.type === "yes_no" ? "sr-only" : "mt-0.5 accent-[var(--color-accent)]"}
              />
              <span>{text}</span>
            </label>
          ))}
        </div>
        {err}
      </fieldset>
    );
  }

  if (f.type === "consent") {
    return (
      <div className="space-y-1">
        <label className="flex cursor-pointer items-start gap-2.5 text-sm">
          <input type="checkbox" value="on" {...common} className="mt-0.5 accent-[var(--color-accent)]" />
          <span>
            {f.label}
            {f.required && <span className="text-urgent" aria-hidden> *</span>}
          </span>
        </label>
        {help}
        {err}
      </div>
    );
  }

  let input: React.ReactNode;
  switch (f.type) {
    case "long_text":
      input = <textarea {...common} rows={4} maxLength={f.maxLength ?? 5000} placeholder={f.placeholder} className="input" />;
      break;
    case "dropdown":
      input = (
        <select {...common} defaultValue="" className="input">
          <option value="">Choose…</option>
          {(f.options ?? []).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      );
      break;
    case "email":
      input = <input {...common} type="email" autoComplete="email" maxLength={254} placeholder={f.placeholder} className="input" />;
      break;
    case "phone":
      input = <input {...common} type="tel" autoComplete="tel" maxLength={40} placeholder={f.placeholder} className="input tabular-nums" />;
      break;
    case "number":
      input = <input {...common} type="number" inputMode="decimal" min={f.min} max={f.max} step="any" placeholder={f.placeholder} className="input tabular-nums" />;
      break;
    case "date":
      input = <input {...common} type="date" className="input tabular-nums" />;
      break;
    case "time":
      input = <input {...common} type="time" className="input tabular-nums" />;
      break;
    default:
      input = (
        <input
          {...common}
          type="text"
          maxLength={f.maxLength ?? 300}
          placeholder={f.placeholder}
          autoComplete={f.mapTo === "first_name" ? "given-name" : f.mapTo === "last_name" ? "family-name" : f.mapTo === "full_name" ? "name" : "off"}
          className="input"
        />
      );
  }
  return (
    <label htmlFor={f.id} className="block space-y-1.5">
      {label}
      {help}
      {input}
      {err}
    </label>
  );
}

/** The public form: sends with JavaScript so nothing typed is lost when a field needs fixing. */
export function PublicFormView({
  code,
  name,
  description,
  from,
  fields,
  stamp,
}: {
  code: string;
  name: string;
  description: string | null;
  from: string | null;
  fields: FormField[];
  stamp: string;
}) {
  const [pending, start] = useTransition();
  const [done, setDone] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);

  if (done) {
    return (
      <div className="card space-y-2 p-6 text-center" role="status">
        {from && <p className="eyebrow text-text-faint">{from}</p>}
        <p className="font-display text-xl">{done}</p>
      </div>
    );
  }

  const questions = fields.filter((f) => isInputField(f.type)).length;
  return (
    <>
      <div className="space-y-2 text-center">
        {from && <p className="eyebrow text-text-faint">{from}</p>}
        <h1 className="page-title">{name}</h1>
        {description && <p className="whitespace-pre-line text-sm text-text-muted">{description}</p>}
      </div>
      <form
        className="card space-y-5 p-5 sm:p-6"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          setNotice(null);
          start(async () => {
            const r = await submitPublicForm(fd);
            if (r.ok) {
              setDone(r.message);
              window.scrollTo({ top: 0 });
              return;
            }
            setErrors(r.errors ?? {});
            const first = r.errors ? Object.keys(r.errors)[0] : null;
            if (first) {
              setNotice(`Please check ${Object.keys(r.errors!).length === 1 ? "the highlighted answer" : "the highlighted answers"}.`);
              document.getElementById(first)?.focus();
            } else setNotice(BUSY[r.reason ?? "busy"] ?? BUSY.busy);
          });
        }}
      >
        <input type="hidden" name="__code" value={code} />
        <input type="hidden" name="__started" value={stamp} />
        {/* Spam trap: people never see or fill this. */}
        <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <label>
            Website
            <input name="__website" tabIndex={-1} autoComplete="off" />
          </label>
        </div>
        {notice && (
          <p className="flag rounded-xl p-3 text-sm" role="alert">
            {notice}
          </p>
        )}
        {fields.map((f) => (
          <FieldInput key={f.id} f={f} error={errors[f.id]} />
        ))}
        <button
          type="submit"
          disabled={pending || questions === 0}
          className="w-full rounded-full bg-accent px-6 py-3 text-sm font-semibold text-bg hover:bg-accent-dim disabled:opacity-60"
        >
          {pending ? "Sending…" : "Send"}
        </button>
        <p className="text-center text-xs text-text-faint">Your answers go only to {from ?? "the person who shared this form"}.</p>
      </form>
    </>
  );
}
