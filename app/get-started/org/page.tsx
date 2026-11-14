import Link from "next/link";
import { SetupFrame } from "@/components/setup/SetupFrame";
import { TimeZoneInput } from "@/components/notifications/TimeZoneInput";
import { saveOrgBasics } from "@/lib/actions/setup";
import { ORG_KINDS, ORG_KINDS_SAME } from "@/lib/terms";
import { OrgKindText } from "@/components/org/OrgKindText";
import { TEAM_SIZES, readDraft } from "@/lib/setup";

export const metadata = { title: "Set up your organization · Strynd" };
export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  name: "Enter your organization's name.",
  kind: "Choose what kind of organization it is.",
  size: "Choose how many people will use Strynd.",
};

type Params = { error?: string; offer?: string; utm_source?: string; utm_medium?: string; utm_campaign?: string; utm_content?: string };

/** Organization set-up, step 1 of 7: name, type, team size (time zone comes from the browser). */
export default async function OrgBasicsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const { error, offer, ...utm } = await searchParams;
  const d = await readDraft();
  const draft = d?.flow === "org" ? d : null;
  return (
    <SetupFrame flow="org" step={1} title="Tell us about your organization" intro="This sets up Strynd's words, reports and seats for your team. You can change it later.">
      <form action={saveOrgBasics} className="space-y-5">
        {error && ERRORS[error] && <p className="flag text-sm">{ERRORS[error]}</p>}
        {offer === "skip" && <input type="hidden" name="offer" value="skip" />}
        {Object.entries(utm).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v.slice(0, 80)} /> : null))}
        <TimeZoneInput />

        <label className="block space-y-1">
          <span className="text-sm font-medium text-text">Organization name</span>
          <input
            name="name"
            required
            maxLength={200}
            autoFocus
            defaultValue={draft?.name ?? ""}
            placeholder="Hope House, or Pawsome Grooming"
            className="input"
          />
        </label>

        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-medium text-text">What kind of organization?</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {ORG_KINDS.map((k) => (
              <label
                key={k.value}
                className="card flex cursor-pointer items-start gap-3 p-4 transition-colors hover:bg-bg-hover has-[:checked]:border-accent has-[:checked]:ring-1 has-[:checked]:ring-accent"
              >
                <input type="radio" name="kind" value={k.value} required defaultChecked={draft?.kind === k.value} className="mt-1 accent-[var(--accent)]" />
                <OrgKindText {...k} />
              </label>
            ))}
          </div>
          <p className="text-xs text-text-muted">{ORG_KINDS_SAME}</p>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-medium text-text">How many people will use Strynd?</legend>
          <div className="flex flex-wrap gap-2">
            {TEAM_SIZES.map((t) => (
              <label
                key={t.value}
                className="cursor-pointer rounded-full border border-border px-3 py-1.5 text-sm text-text transition-colors hover:bg-bg-hover has-[:checked]:border-accent has-[:checked]:bg-accent has-[:checked]:text-bg"
              >
                <input type="radio" name="size" value={t.value} required defaultChecked={draft?.size === t.value} className="sr-only" />
                {t.label}
              </label>
            ))}
          </div>
          <p className="text-xs text-text-muted">Counting you. Staff only, not clients. You can add or remove seats any time.</p>
        </fieldset>

        <div className="flex items-center justify-between gap-3 pt-2">
          <Link href="/get-started" className="text-sm text-text-muted hover:text-text">
            ← Back
          </Link>
          <button type="submit" className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-bg hover:bg-accent-dim">
            Continue
          </button>
        </div>
      </form>
    </SetupFrame>
  );
}
