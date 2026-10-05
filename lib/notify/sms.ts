/**
 * Text messages via Twilio's REST API (no SDK). Needs TWILIO_ACCOUNT_SID,
 * TWILIO_AUTH_TOKEN and either TWILIO_MESSAGING_SERVICE_SID (recommended —
 * it's what a registered A2P 10DLC campaign is attached to) or TWILIO_FROM
 * (a Twilio number). Without them, texts are printed to the server console.
 * Twilio handles STOP/HELP replies itself.
 */
export function smsConfigured(): boolean {
  return !!(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    (process.env.TWILIO_MESSAGING_SERVICE_SID || process.env.TWILIO_FROM)
  );
}

export async function sendSms(to: string, body: string): Promise<boolean> {
  if (!smsConfigured()) {
    console.log(`[sms] (not sent — Twilio isn't configured)\nTo: ${to}\n\n${body}`);
    return false;
  }

  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const form = new URLSearchParams({ To: to, Body: body });
  if (process.env.TWILIO_MESSAGING_SERVICE_SID) form.set("MessagingServiceSid", process.env.TWILIO_MESSAGING_SERVICE_SID);
  else form.set("From", process.env.TWILIO_FROM!);

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form,
  });
  if (!res.ok) {
    console.error(`[sms] Twilio error ${res.status}: ${await res.text().catch(() => "")}`);
    return false;
  }
  return true;
}
