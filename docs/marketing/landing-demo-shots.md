# Landing page demo recordings (shot list)

Three real screen recordings for `/individuals`, `/business` and `/nonprofits`.
Until a file exists, each page shows its step-by-step demo (drawn with sample data) and the video slot stays hidden.

## How to record

- **Account:** a fresh trial account loaded with sample data (Home → "Try it with sample clients"). Never record a real account or real client names.
- **Device:** iPhone screen recording (Control Center → Screen Recording) in portrait. Turn on Do Not Disturb first so no notifications show.
- **Length:** 15–30 seconds each. No voiceover needed; videos play muted.
- **Pace:** pause about one second on each result so viewers can read it.
- **Hand-off:** send me the `.mp4`. I'll trim it, make a poster frame and captions (`.vtt`), put it in `public/videos/`, and switch the slot on (`const VIDEO` at the top of each page).

## Shot A: Individuals (about 20s), `/individuals`

| # | Screen | Action | Hold on |
|---|--------|--------|---------|
| 1 | Home | Tap the command box, type "Remind me to send the proposal Friday", press Enter | The "Task created" confirmation |
| 2 | Tasks | Open Tasks | "Send the proposal · Fri" in the list |
| 3 | Calendar | Open Calendar, tap Friday | The task on Friday |
| 4 | Home | Command box: "Add milk and eggs to my shopping list" | The confirmation, then the Shopping list |
| 5 | Home | Scroll to Today | Today's list |

## Shot B: Business (about 25s), `/business`

Use a **business** organization (visits, Insights) with a "Haircut" service priced at $45 in Settings → Services.

| # | Screen | Action | Hold on |
|---|--------|--------|---------|
| 1 | Home | Command box: "Add Ana Ortiz as a new customer" | "Customer added" |
| 2 | Home | Command box: "Ana – haircut $45" | "Visit logged" |
| 3 | Ana's profile | Open Ana | The visit at the top of her timeline |
| 4 | Ana's profile | Command box: "Follow up with Ana in 3 weeks" | The follow-up task with its date |
| 5 | Insights | Open Insights | Revenue and revenue by service |

## Shot C: Nonprofits (about 30s), `/nonprofits`

Use a **nonprofit** organization with the referral link on, a second staff member, and a "Housing help" service.

| # | Screen | Action | Hold on |
|---|--------|--------|---------|
| 1 | Referral link (phone browser) | Fill in the partner referral form for "Jasmine Reyes" and submit | The thank-you screen |
| 2 | Referrals | Open Referrals, tap Accept | Jasmine's new profile |
| 3 | Jasmine's profile | Reassign to the second staff member | "Assigned to …" |
| 4 | Home | Command box: "Jasmine – housing help" | "Check-in logged" |
| 5 | Home | Command box: "Check in with Jasmine next Tuesday" | The follow-up task |
| 6 | Team | Open the Team dashboard | Each person's check-ins today |
| 7 | Impact | Open Impact | People served and Housing help |

## Analytics

Each video records `Video Play` (first play) and `Video Complete` in Vercel Web Analytics, with the page name.
