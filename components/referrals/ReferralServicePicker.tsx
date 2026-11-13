"use client";

import { useState } from "react";

/** Public referral form: one service from the organization's list, or "Other" to type it. */
export function ReferralServicePicker({ services }: { services: string[] }) {
  const [choice, setChoice] = useState("");
  return (
    <div className="space-y-2">
      <label className="block space-y-1 text-sm">
        <span className="section-label">Service the client is looking for</span>
        <select name="service" value={choice} onChange={(e) => setChoice(e.target.value)} className="input">
          <option value="">Choose a service...</option>
          {services.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
          <option value="__other__">Other (type it)</option>
        </select>
      </label>
      {choice === "__other__" && (
        <input name="service_other" required maxLength={80} autoFocus placeholder="What does the client need?" className="input" />
      )}
    </div>
  );
}
