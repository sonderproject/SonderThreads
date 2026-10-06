# sonderthreads — what it is and what it does

## What it's for

sonderthreads is a command-first personal organizer for the people, notes, lists and dates in your life. You type or say something in plain English and it files it where it belongs. "Remind me to call Marcus Friday" becomes a task due Friday, linked to Marcus.

It's built for someone who keeps track of a lot of people: a coach, mentor, recruiter, program lead, small-business owner or community organizer. They need to remember who said what, who needs a follow-up, and what's due. It's **not a CRM** (customer relationship management system). There are no sales stages, pipelines or deal values, just fast capture plus a clear view of what matters today.

**Core idea:** capture fast, organize automatically, see what needs you.

---

## The command bar

The heart of the app is on the Home tab. Press `/` anywhere, or tap the **+** button on a phone.

| You type | It does |
|---|---|
| `Add Marcus Johnson` | Creates a person |
| `Add Marcus, James and Wes to Group 7` | Adds three people to a group (creates the group and any new people) |
| `Remind me to call Marcus Friday at 3` | Task due Friday 3pm, linked to Marcus |
| `Call Marcus every Monday` | Recurring weekly task |
| `Marcus got hired at Amazon` | Note on Marcus's profile |
| `note: spare key is with the neighbor` | Standalone note |
| `Create a list called Groceries` | New list |
| `add milk, eggs and coffee to groceries` | Three list items |
| `Set Marcus's next action to follow up after week one` | Updates his profile |
| `show me everyone I need to follow up with` | Search |

- **Brain dumps:** paste several sentences or lines and each becomes its own item.
- **Live preview:** before you hit enter, it shows what it's about to do.
- **Smart dates:** "Friday at 3", "Oct 5", "in 2 weeks", "tonight" and "tomorrow morning" all resolve in your own time zone.
- **Autocomplete:** type `@` for people and `#` for lists.
- **Follow-up questions:** "new note" or "new list" asks *what* and keeps listening.
- **No AI required:** built-in rules handle all of this for free. AI (OpenAI or Anthropic) can be plugged in later for messier wording.

## The connective tissue (sections talk to each other)

- **Notes suggest tasks.** Every note is scanned for to-dos, and anything that looks like one shows up under **Suggested tasks** on the Notifications page with one-tap **✓ Add** / **✕ Dismiss** (or Add all / Dismiss all). Nothing lands on your task list until you say yes.
  - To-do wording: "need to work on the pitch deck by Friday", "I'll call the landlord tomorrow", "talk to Marcus about…", "follow up with…".
  - A note that names someone in People, even a standalone note ("Marcus got hired at Amazon"), suggests "Follow up with Marcus Johnson", carrying the note's text.
  - Dates in the sentence become the due date, and people named become the linked person.
  - **Explicit asks skip the suggestion step:** "remind me to…" or "todo: …" in a note creates the task right away, with **Undo** on the Notifications page.
- **Lists become people.** **Add to People** on a list turns each line ("Marcus Johnson 05/12 5551234567") into a person: name from the letters, birthday from `MM/DD`, phone from the digits.
- **Groups build your roster.** Adding names to a group creates people automatically.
- **Everything lands on the person.** Notes, tasks, list memberships and activity all show on that person's timeline.
- **Birthdays flow everywhere.** A person's birthday shows on the Calendar and in Notifications.

---

## Tabs

### Home (Command)
The command bar and quick actions, plus a mini calendar and clock, **Today** (due and overdue tasks), **Needs Attention**, **Recent People** and **Recent Notes**.

### 🔔 Notifications
The bell in the top-right shows a badge for unread items plus overdue tasks. The page shows:
- **Overdue** and **Due today** tasks (complete or snooze them right there)
- **Suggested tasks** pulled from your notes, each with ✓ Add or ✕ Dismiss
- **Activity**, such as "New task: … (created from your note)", with **Keep** or **Undo**
- **Coming up**: tasks due in the next couple of days
- **Birthdays** in the next 7 days
- **Needs attention**: people flagged for follow-up, quiet for 7+ days, or with overdue tasks

### People
- Your roster with search, **+ New**, **CSV import** and **Export roster as CSV**.
- **Select → Delete** removes many people at once, with Undo.
- Each profile has an editable name, birthday, phone and email, plus current status, next action, an auto-written summary, open tasks, lists and a full activity timeline.
- A profile's **Delete** button also comes with Undo.
- A **stale** badge appears after 14 days with no activity.

### Lists & Groups
- Plain lists (groceries, packing, projects) or **groups** (rosters of people).
- Check off, edit, drag to reorder, duplicate, delete (with Undo).
- **Share:** text, email, copy, or the phone's share sheet.
- **Export:** PDF or Excel.
- **Add to People:** turns every item into a person (see above).
- **Import:** a CSV or one-name-per-line file becomes a list of people.

### Tasks
- **Today**, **Upcoming**, **No Date** and **Completed** sections.
- Due dates, optional times, and repeats (daily, weekly or monthly). Checking off a repeating task schedules the next one.
- On a phone, swipe right to complete or left to snooze.
- 🗑 on every task deletes it in one tap. **Select** → check tasks (or Select all per section) → **Delete N** clears many at once. Both have Undo.

### Notes
Quick notes, standalone or attached to a person. You can search them and edit them inline, and any to-dos inside show up as suggested tasks.

### Calendar
A month view of every task with a due date, plus everyone's birthdays. **+ New** adds a task straight onto a day.

### Account
- Mobile number and text-reminder opt-in
- Turning push notifications on or off for this device
- Sending a test notification
- Signing out, and permanently deleting the account

---

## Getting things in fast

- **Voice:** tap the mic on any text field, or hold the **+** button on a phone, and speak.
- **Install it like an app:** "Add to Home Screen" gives it its own icon and full-screen mode. Long-press the icon (Android) for New task / New note / Voice shortcuts.
- **Share into it:** on Android, share text from any app into sonderthreads and it lands in the command bar.
- **Keyboard:** `/` opens the command bar, and `⌘K` / `Ctrl+K` searches everything.
- **Undo everywhere:** complete, delete, snooze or move anything and you get 5 seconds to take it back.

## Reminders & notifications

| Channel | Status | Notes |
|---|---|---|
| In-app (bell + Notifications tab) | ✅ Live | |
| Push notifications | ⚙️ Built, needs keys | Free. iPhone requires the app to be added to the Home Screen first. |
| Text messages (SMS) | ⚙️ Built, needs Twilio | About $0.01–0.02 per text plus A2P 10DLC carrier registration. Users must opt in. |

- **Timed tasks** are reminded about 10 minutes before they're due.
- **All-day tasks** are reminded at 8am in your time zone.
- On Vercel's free plan the reminder job runs once a day. For on-time reminders, use an outside 5-minute ping or upgrade to Vercel Pro.

## Accounts, privacy & data

- Email and password sign-up. A mobile number is required at sign-up, and texts are opt-in.
- Each account sees only its own data.
- **Forgot password** works once email (Resend) is set up.
- **Full backup:** download all your data as JSON from the header, or from More on a phone.
- Deleting things is a soft delete, so it's recoverable. **Delete account** removes everything permanently.

---

## Still to do

- Privacy policy and terms of service pages. These are needed for SMS approval, Google/Apple sign-in and the app stores.
- Turn on push notifications (VAPID keys), texts (Twilio + A2P 10DLC), password-reset email (Resend) and the reminder schedule (`CRON_SECRET`).
- Google and Apple sign-in, plus a public account-deletion page.
- An "Add to Home Screen" how-to on the landing page.
- Optional: an AI parser for messier wording.
