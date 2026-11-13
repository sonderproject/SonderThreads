# Incident plan

One page for when something goes wrong. Owner: sonderproject.co@gmail.com.

## What counts as an incident
- **Data:** anyone sees data that isn't theirs, a key or password leaks, an account is taken over, or data is lost.
- **Outage:** www.strynd.com is down or sign-in fails for more than 15 minutes.
- **Money:** customers are charged wrongly (double charges, wrong amounts).

## First hour
1. **Stop the damage.** Roll back on Vercel (Deployments → last good one → Promote), turn off the broken feature, or rotate the leaked key (Stripe, Resend, Supabase, Vercel).
2. **Write down what you know**, with times: what happened, when it started, who's affected, what you did. Keep this log; you'll need it.
3. **Check the command center** (/owner) and Vercel/Supabase logs to see how far it reached.

## Who to tell, and how fast
- **Customers affected by a data incident:** as soon as you know who's affected, and within 72 hours at most. Many US states require notice "without unreasonable delay"; some set deadlines (e.g. 30–60 days) and some require telling the state attorney general when many residents are affected. When the LLC forms, ask the lawyer which states apply.
- **Organizations:** tell each affected organization's Admin directly; they may have their own duty to tell their clients or funders.
- **Outages and billing mistakes:** email affected customers the same day; refund wrong charges in Stripe right away.
- **Get help:** call the lawyer for any data incident. Call the insurer once you have cyber insurance (claims often need notice within days).

## Customer email templates

**Data incident**
> Subject: Important: a security issue affecting your Strynd account
>
> On [date], we found [what happened, in one sentence]. It affected [what data] for [who]. We [what we did to stop it] on [date]. You don't need to do anything / we recommend you [action]. We're sorry. Reply to this email with any questions, and we'll answer within one business day.

**Outage**
> Subject: Strynd was down on [date]: what happened
>
> From [time] to [time], [what didn't work]. Your data was safe and nothing was lost. The cause was [one sentence], and we've [fix] so it doesn't happen again. Sorry for the disruption.

**Billing mistake**
> Subject: We charged you incorrectly, refund on the way
>
> On [date] you were charged [amount] by mistake. We've refunded it; it should reach your account in 5–10 business days. Sorry about that.

## Customer data: our rules
- Only look at a customer's records when they ask for help, and tell them you did.
- The owner command center shows totals and account emails, not anyone's clients or notes. Looking deeper means querying the database directly: only do that for a support request or an incident, and note it in the incident log.
- Never paste keys or customer data into chats, emails or documents.

## After it's over
Within a week: write what caused it and what changed so it can't happen again, and add that to this file's log below.

## Log
- Nov 2026: Stripe, Resend and Supabase keys pasted in a chat during setup. Rotation pending (CLAUDE.md).
