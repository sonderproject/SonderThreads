# LinkedIn campaign setup (round 1)

*Nov 14, 2026. Goal: learn which message and audience bring organization trials, for about $420 over 14 days, without wasting a dollar on the wrong people.*

## The plan in one line
Two image-ad campaigns that drive clicks to thesurfdesk.app (images get cheaper clicks than video on LinkedIn), plus the videos posted for free on your profile and Company Page. Every ad link is tagged, so the command center shows sign-ups and paid customers per ad.

| Campaign | Audience | Budget | Ads |
|---|---|---|---|
| **NP – Visits – Image** | Nonprofit and program leaders, US | $20/day × 14 days = $280 | NP-1, NP-2 |
| **BIZ – Visits – Image** | Owners of businesses with regulars, your state | $10/day × 14 days = $140 | BIZ-1, BIZ-2 |

Why images, not video, for paid clicks: industry data (vendor benchmarks, directional) puts LinkedIn video at about a 0.24% click-through rate and around $15 a click, versus about 0.42% for single-image ads. Video is for organic posts and, later, cheap video-view campaigns.

## Before you start (once)
1. **Company Page** for Surfdesk (ads run from a page): https://www.linkedin.com/company/setup/new/ . Logo: `docs/brand/strynd-mark-blue.png`. Tagline: "Know every person you serve." Website: https://thesurfdesk.app
2. **Campaign Manager account** with a payment card: https://www.linkedin.com/campaignmanager/
3. **Don't add the LinkedIn Insight Tag.** Surfdesk's privacy policy promises no third-party tracking. The tagged links below do the job.

## Campaign 1: NP – Visits – Image
Create a campaign group "Round 1", then a campaign:

- **Objective:** Website visits
- **Locations:** United States
- **Audience (all three must match):**
  - Job titles (any): Executive Director, Program Director, Director of Programs, Program Manager, Chief Program Officer, Director of Operations, Operations Manager, Director of Client Services, Workforce Development Director, Workforce Development Manager, Community Services Director, Case Management Supervisor, Reentry Program Manager, Family Resource Center Director
  - AND company industries (pick the closest names offered): Non-profit Organizations, Individual and Family Services, Civic and Social Organizations, Community Services, Vocational Rehabilitation Services
  - AND company size: 11–50, 51–200 (add 2–10 only if the audience is under 50,000)
  - Exclude job functions: Sales, Business Development
- **Audience size:** aim for 50,000–300,000. Too small and the same people see it too often; too big and titles are too loose.
- **Audience Expansion: OFF.** (It's on until you turn it off, and it can switch back on after edits; re-check.)
- **LinkedIn Audience Network: OFF.** (Placements: LinkedIn feed only.)
- **Ad format:** Single image
- **Budget:** daily $20, start today, end in 14 days
- **Bidding:** Manual bidding, cost per click. Start at the **low end** of the range LinkedIn suggests. If it's spending less than half the daily budget after 48 hours, raise the bid 15% (repeat once if needed).
- **Ad rotation:** rotate evenly (if offered).
- **Conversion tracking:** none.

**Ad NP-1**: image `docs/marketing/ads/np-1-funder-report-due-1x1.png`
- Intro text, headline, description: Variant A in `linkedin-ads.md` (funder reporting)
- Destination URL: `https://thesurfdesk.app/welcome?utm_source=linkedin&utm_medium=paid&utm_campaign=np-funder&utm_content=np1`
- Button: Learn more

**Ad NP-2**: image `docs/marketing/ads/np-2-reports-one-click-1x1.png`
- Copy: Variant B in `linkedin-ads.md` (front desk, one-tap check-ins)
- Destination URL: `https://thesurfdesk.app/welcome?utm_source=linkedin&utm_medium=paid&utm_campaign=np-checkins&utm_content=np2`
- Button: Learn more

## Campaign 2: BIZ – Visits – Image
Same settings as Campaign 1, except:
- **Locations:** your state (local owners respond to a local founder)
- **Job titles:** Owner, Co-Owner, Founder, Practice Manager, Clinic Manager, Office Manager, Studio Owner, Salon Owner, General Manager
- **Industries:** Veterinary Services, Pet Services, Personal Care Services, Wellness and Fitness Services, Education (closest names offered)
- **Company size:** 1–10, 11–50
- **Budget:** daily $10
- If the audience is under 30,000, add neighboring states.

**Ad BIZ-1**: `docs/marketing/ads/biz-1-regulars-remember-1x1.png`, copy from section 2 of `linkedin-ads.md`, URL `https://thesurfdesk.app/welcome?utm_source=linkedin&utm_medium=paid&utm_campaign=biz-regulars&utm_content=biz1`, button Sign up
**Ad BIZ-2**: `docs/marketing/ads/biz-2-log-visit-one-tap-1x1.png`, same copy, URL `https://thesurfdesk.app/welcome?utm_source=linkedin&utm_medium=paid&utm_campaign=biz-visits&utm_content=biz2`, button Sign up

## Free distribution (do the same day)
- Post `docs/marketing/video/strynd-full-tour-4x5.mp4` on **your personal profile** with a short founder story (why you built it). Founder posts usually reach more people than company posts.
- Reshare it from the Company Page. Post the 27s nonprofit cut a few days later.

## Where to watch results
- **LinkedIn Campaign Manager:** impressions, clicks, click-through rate (CTR), cost per click, per ad.
- **Surfdesk command center** → "Sign-ups by source (30 days)": sign-ups and "card or paid" per campaign (np-funder, np-checkins, biz-regulars, biz-visits). https://thesurfdesk.app/owner

## Rules (decide by these, not by feel)
- **48 hours:** spending less than half the budget? Raise the bid 15%.
- **Each ad at 2,000+ impressions:** pause an ad whose CTR is under 0.25% when its sibling is over 0.4%.
- **Day 7:** if a campaign has 40+ clicks and zero sign-ups, the ad isn't the problem; the landing page or offer is. Pause it and tell Claude; fix the page before spending more.
- **Day 14, pick a winner by cost per sign-up** (spend ÷ sign-ups from the command center), then cost per card added.
- **Stop-loss:** if the full $420 is spent with no organization trial started, pause all ads and put the time into the personal emails in `outreach.md`.

These thresholds are judgment calls from typical LinkedIn ranges, not guarantees; the point is to decide on numbers.

## Round 2 (only after round 1 shows a winner)
- Winner's message with the video vs. the image.
- $10/day **Video views** campaign of the nonprofit cut, to build an audience of people who watched; then retarget them with the winning image ad (cheapest warm clicks).
- Lead Gen Form test: "Get a sample funder report" (needs a short privacy-policy note about marketing contacts first).
