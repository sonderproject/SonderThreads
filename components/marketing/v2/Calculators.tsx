"use client";

import { useRef, useState } from "react";
import { track } from "@vercel/analytics";
import { INDIVIDUAL_CENTS, calculateMonthlyPriceCents } from "@/lib/pricing";

/**
 * Money math from the visitor's own numbers. Every assumption is an input they can change;
 * nothing here is a promise. Competitor prices are their public monthly prices (checked Nov 23, 2026).
 */

const usd = (n: number) => `$${Math.round(n).toLocaleString()}`;

/** Monthly Surfdesk price in dollars for a team of `seats` (1 = Individual). */
export function surfdeskMonthly(seats: number): number {
  return (seats <= 1 ? INDIVIDUAL_CENTS : calculateMonthlyPriceCents("organization", seats)) / 100;
}

function useTrackOnce(page: string, calc: string) {
  const done = useRef(false);
  return () => {
    if (done.current) return;
    done.current = true;
    track("Calculator Use", { page, calc });
  };
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="flex items-baseline justify-between gap-2 text-sm text-text">
        {label}
        {hint && <span className="text-xs text-text-faint">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

function Num({ value, onChange, prefix, suffix, min = 0, max = 100000 }: { value: number; onChange: (n: number) => void; prefix?: string; suffix?: string; min?: number; max?: number }) {
  return (
    <span className="flex items-center gap-1 rounded-xl border border-border bg-bg px-3 py-2 focus-within:border-accent">
      {prefix && <span className="text-text-muted">{prefix}</span>}
      <input
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        value={Number.isFinite(value) ? value : ""}
        onChange={(e) => onChange(Math.min(max, Math.max(min, Number(e.target.value) || 0)))}
        className="w-full min-w-0 bg-transparent tabular-nums text-text outline-none"
      />
      {suffix && <span className="whitespace-nowrap text-text-muted">{suffix}</span>}
    </span>
  );
}

function Slider({ value, onChange, min, max, step = 1, format }: { value: number; onChange: (n: number) => void; min: number; max: number; step?: number; format: (n: number) => string }) {
  return (
    <span className="flex items-center gap-3">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 flex-1 cursor-pointer accent-[var(--accent)]"
      />
      <span className="w-20 text-right tabular-nums text-sm font-semibold text-text">{format(value)}</span>
    </span>
  );
}

function Result({ big, label, lines }: { big: string; label: string; lines: React.ReactNode[] }) {
  return (
    <div className="space-y-2 rounded-2xl bg-accent-soft p-5" aria-live="polite">
      <p className="text-sm text-text-muted">{label}</p>
      <p className="font-display text-4xl font-light tabular-nums text-accent sm:text-5xl">{big}</p>
      {lines.map((l, i) => (
        <p key={i} className="text-sm text-text">
          {l}
        </p>
      ))}
    </div>
  );
}

const STACK = [
  { label: "To-do app", hint: "Todoist Pro: $7", value: 7 },
  { label: "Notes app", hint: "Notion Plus: $12", value: 12 },
  { label: "Calendar app", hint: "if you pay for one", value: 0 },
  { label: "Client list or CRM", hint: "if you pay for one", value: 0 },
];

export function AppStackCalc({ page }: { page: string }) {
  const [vals, setVals] = useState(STACK.map((s) => s.value));
  const touched = useTrackOnce(page, "app_stack");
  const total = vals.reduce((a, b) => a + b, 0);
  const ours = surfdeskMonthly(1);
  const saved = (total - ours) * 12;
  return (
    <div className="space-y-5">
      <p className="font-semibold text-text">What do you pay for apps now?</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {STACK.map((s, i) => (
          <Field key={s.label} label={s.label} hint={s.hint}>
            <Num
              value={vals[i]}
              prefix="$"
              suffix="/mo"
              max={500}
              onChange={(n) => {
                touched();
                setVals((v) => v.map((x, j) => (j === i ? n : x)));
              }}
            />
          </Field>
        ))}
      </div>
      {saved > 0 ? (
        <Result
          label="You'd save every year"
          big={usd(saved)}
          lines={[
            <>
              {usd(total)}/mo for separate apps vs <strong>{usd(ours)}/mo</strong> for Surfdesk, all in one place.
            </>,
          ]}
        />
      ) : (
        <Result
          label="Everything in one place for"
          big={`${usd(ours)}/mo`}
          lines={[total > 0 ? <>Just {usd(ours - total)} more than you pay now, and nothing lives in five places anymore.</> : <>One app for your tasks, notes, lists, calendar and clients.</>]}
        />
      )}
      <p className="text-[11px] text-text-faint">
        Todoist Pro and Notion Plus are their monthly prices from todoist.com and notion.com (Nov 2026). Change any number to match what you pay.
      </p>
    </div>
  );
}

export function FollowUpCalc({ page }: { page: string }) {
  const [customers, setCustomers] = useState(120);
  const [sale, setSale] = useState(60);
  const [drift, setDrift] = useState(20);
  const [winBack, setWinBack] = useState(10);
  const [team, setTeam] = useState(1);
  const touched = useTrackOnce(page, "follow_up_cost");
  const t = <T,>(fn: (v: T) => void) => (v: T) => {
    touched();
    fn(v);
  };
  const atRisk = customers * (drift / 100) * sale * 12;
  const won = atRisk * (winBack / 100);
  const cost = surfdeskMonthly(team) * 12;
  const multiple = cost > 0 ? won / cost : 0;
  return (
    <div className="space-y-5">
      <p className="font-semibold text-text">What are customers who drift away costing you?</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Customers a month">
          <Num value={customers} onChange={t(setCustomers)} max={100000} />
        </Field>
        <Field label="Average sale">
          <Num value={sale} onChange={t(setSale)} prefix="$" max={100000} />
        </Field>
        <Field label="Don't come back" hint="your estimate">
          <Slider value={drift} onChange={t(setDrift)} min={0} max={60} format={(n) => `${n}%`} />
        </Field>
        <Field label="Follow-ups win back" hint="your estimate">
          <Slider value={winBack} onChange={t(setWinBack)} min={0} max={50} format={(n) => `${n}%`} />
        </Field>
        <Field label="People on your team">
          <Num value={team} onChange={t(setTeam)} min={1} max={500} />
        </Field>
      </div>
      <Result
        label={`Winning back ${winBack}% is worth, every year`}
        big={usd(won)}
        lines={[
          <>
            {usd(atRisk)} a year walks out the door. Surfdesk for {team === 1 ? "you" : `${team} people`} is <strong>{usd(cost)} a year</strong>
            {multiple >= 1 ? <>: about {multiple >= 10 ? Math.round(multiple) : multiple.toFixed(1)}× back.</> : "."}
          </>,
        ]}
      />
      <p className="text-[11px] text-text-faint">An estimate from the numbers you enter, not a promise. Surfdesk prices from our pricing below.</p>
    </div>
  );
}

export function HoursBackCalc({ page }: { page: string }) {
  const [staff, setStaff] = useState(8);
  const [minutes, setMinutes] = useState(20);
  const [rate, setRate] = useState(25);
  const touched = useTrackOnce(page, "hours_back");
  const t = <T,>(fn: (v: T) => void) => (v: T) => {
    touched();
    fn(v);
  };
  const weekly = (staff * minutes * 5) / 60;
  const yearly = weekly * 50;
  const value = yearly * rate;
  const cost = surfdeskMonthly(Math.max(2, staff)) * 12;
  return (
    <div className="space-y-5">
      <p className="font-semibold text-text">How much staff time could your team get back?</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Staff">
          <Num value={staff} onChange={t(setStaff)} min={1} max={500} />
        </Field>
        <Field label="Cost per staff hour">
          <Num value={rate} onChange={t(setRate)} prefix="$" max={500} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Time saved per person, per day" hint="your estimate">
            <Slider value={minutes} onChange={t(setMinutes)} min={5} max={60} step={5} format={(n) => `${n} min`} />
          </Field>
        </div>
      </div>
      <Result
        label="Hours back every week"
        big={`${weekly >= 10 ? Math.round(weekly) : weekly.toFixed(1)} hrs`}
        lines={[
          <>
            About {Math.round(yearly).toLocaleString()} hours a year, worth {usd(value)} of staff time. Surfdesk for {Math.max(2, staff)} people is{" "}
            <strong>{usd(cost)} a year</strong>.
          </>,
        ]}
      />
      <p className="text-[11px] text-text-faint">An estimate from the numbers you enter (50 working weeks), not a promise.</p>
    </div>
  );
}
