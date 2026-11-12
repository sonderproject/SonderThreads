# Strynd — Design System (Sonder Studio style)

Use this file as the visual source of truth for Strynd. Match it exactly unless told otherwise. When building any UI, apply these tokens and components before inventing new ones.

## Feel

Sonder Studio style, tuned for a tool people read all day: calm warm neutrals (sand by day, obsidian by night), one surf-blue accent, airy geometric headings, rounded surfaces with hairline borders, and frosted glass only on floating chrome (header, tab bar, sheets). No heavy shadows, no emoji as icons. Body text stays at a normal weight and size so lists scan fast.

## Tokens

Every color is a CSS variable in `app/globals.css` on `:root`, redefined for dark mode (under `prefers-color-scheme: dark` guarded by `:root:not([data-theme="light"])`, and under `:root[data-theme="dark"]`). Never hard-code a color in a component.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | `#f6f4ef` sand | `#0a0a09` obsidian | Page background |
| `--surface` | `#ffffff` | `#141412` charcoal | Cards, inputs, menus |
| `--hover` | `#f3f0eb` | `#1e1d1b` stone | Hover and pressed rows |
| `--fg` | `#141412` | `#f3f0eb` | Main text |
| `--muted` | `#6e5f4d` | `#aea08d` | Secondary text, labels, dates |
| `--line` / `--line-subtle` | `#e2dbd0` / `#ece7dd` | `#2a2926` / `#1e1d1b` | Borders / row dividers |
| `--accent` / `--accent-strong` / `--accent-soft` | `#1c77b5` / `#155c8c` / `#eef6fc` | `#62b4e6` / `#7cbce4` / `#0b2236` | Links, primary actions, success |
| `--warn` / `--warn-soft` | `#9a5b00` / `#fbf0de` | `#e8b25c` / `#33281a` | Attention: due today, follow up |
| `--urgent` / `--urgent-soft` | `#b93815` / `#fdebe4` | `#ff8f6b` / `#3a1f17` | Overdue, unread count |
| `--new` / `--new-soft` | `#6a45b8` / `#f1ecfa` | `#b79cf0` / `#241d38` | Added in the last 2 days, unread |
| `--danger` | `#b42318` | `#f28b82` | Destructive actions |
| `--glass` / `--glass-line` | translucent white | translucent charcoal | Frosted header, tab bar, sheets |

The accent is Sonder Studio's surf blue (`#3e9bd4`), darkened in light mode (`#1c77b5`) so text and buttons pass contrast on white.

## Typography

Loaded with `next/font` in `app/layout.tsx`.

| Role | Font | Size | Weight |
|---|---|---|---|
| Page title (`.page-title`) | Outfit | 2rem, line-height 1.1, letter-spacing -0.02em | 400 |
| Section title (`.section-title`) | Outfit | 1.3rem | 500 |
| Body | Inter | 16px, line-height 1.5 | 400 |
| Eyebrow / labels (`.eyebrow`) | Inter | 0.7rem, uppercase, letter-spacing 0.22em | 500, `--muted` |
| Tags (`.tag`) | Inter | 0.68rem, pill | 600 |

- Outfit is for headings and the brand only; everything else is Inter.
- Numbers in columns use `tabular-nums`.

## Shape

- Cards (`.card`): 16px radius, hairline `--line` border, `--shadow-card`.
- Inputs (`.input`): 12px radius. Default `rounded` is 10px.
- Tags and primary buttons: pill (fully rounded).

## Layout

- One centered column, `max-width: 760px`.
- Page padding: `padding-block: 32px 64px`, sides `max(16px, env(safe-area-inset-left/right, 0px))`.
- Stack sections with flex column and `gap: 28px`. Inside a section, `gap: 10px`.
- Use `gap` for spacing, not margins between siblings.
- Must work at 400px wide with no horizontal page scroll. Wide tables scroll inside their own `overflow-x: auto` wrapper.

## Components

### Header
Eyebrow (context) → h1 → meta row (key facts, bold values in `--fg`, labels in `--muted`, flex-wrap, `gap: 8px 20px`) → progress bar.

### Progress bar
```css
.progress{display:flex;align-items:center;gap:12px}
.bar{flex:1;height:8px;border-radius:4px;background:var(--line);overflow:hidden}
.bar span{display:block;height:100%;background:var(--accent);transition:width .25s}
.pct{font-variant-numeric:tabular-nums;font-weight:600;min-width:7ch;text-align:right}
```
Show as "done / total".

### Callout (flag)
For one important warning per page. Soft warn background, 3px left border in `--warn`, bold lead-in in `--warn`.
```css
.flag{background:var(--warn-soft);border-left:3px solid var(--warn);padding:12px 14px;border-radius:4px;font-size:.95rem}
```

### Section header
h2 on the left, a short due/status label on the right in `--accent`, 0.85rem, 600. Flex, `justify-content: space-between`, wraps on mobile.

### Card
`.card` in `app/globals.css`: `--surface` background, 1px `--line` border, 6px radius, `--shadow-card`. Every grouped block (lists, forms, detail boxes, calendar) uses it; nothing on the page should sit bare on `--bg` except headings, labels and empty states (dashed border, no fill).

### List (the core component)
One bordered `--surface` box with rows separated by 1px `--line` dividers. Radius 6px.
Each row is a 3-column grid: control (22px) | text (1fr, `min-width:0`) | meta on the right (date, count — `--muted`, 0.82rem, no wrap).
```css
ul.tasks{list-style:none;margin:0;padding:0;background:var(--surface);border:1px solid var(--line);border-radius:6px}
ul.tasks li{border-top:1px solid var(--line)} ul.tasks li:first-child{border-top:0}
ul.tasks label{display:grid;grid-template-columns:22px 1fr auto;gap:12px;align-items:start;padding:12px 14px;cursor:pointer}
ul.tasks input{width:18px;height:18px;margin:3px 0 0;accent-color:var(--accent)}
ul.tasks .note{display:block;color:var(--muted);font-size:.9rem}
ul.tasks input:checked ~ .t{text-decoration:line-through;color:var(--muted)}
```
Optional second line under the main text = `.note`. Use this pattern for any list of items (posts, threads, drafts, ideas), swapping the checkbox for an icon or status if needed.

### Table
Same box style as lists. Uppercase muted headers, 1px row dividers, numbers right-aligned with tabular nums, bold footer row for totals.

### Tags
Small inline status pills next to text:
```css
.tag{display:inline-block;font-size:.72rem;font-weight:700;letter-spacing:.04em;padding:1px 6px;border-radius:3px;margin-left:6px}
.v{background:var(--accent-soft);color:var(--accent)}   /* good / done / verified */
.e{background:var(--warn-soft);color:var(--warn)}       /* caution / draft / estimate */
```

### Status colors
Three meanings, used the same way everywhere (rules in `lib/urgency.ts`):
- `<Badge tone="urgent|attention|new">` for the pill; plain `<Badge>` for neutral labels.
- `.flag-urgent` / `.flag-attention` / `.flag-new` put a 3px stripe on the left edge of the row or card.
- Overdue due-dates read "Overdue · …" in `--urgent`; due today in `--warn`.
Green stays the brand/action color; never use these three for decoration.

### Charts (Metrics)
Single-series charts use `--chart-1` (brand green adjusted to pass the dataviz color checks: `#1a7f56` light, `#45a97f` dark). Columns ≤24px with 4px rounded tops on one baseline, hairline `--line-subtle` grid, value label on the tallest mark only, hover tooltip per mark, and a "View as table" under every chart. Text never uses the chart color. Components: `components/metrics/`.

### Calendar
Colored dots mark what an item is (components/calendar/): meetings/check-ins `--accent`, tasks `--fg` (overdue `--urgent`), birthdays `--cal-birthday`, and linked outside calendars one of `--cal-ext-1`…`--cal-ext-4` (teal, brown, green, slate; stored as the number, never a hex). A legend sits above the calendar. Dots only; text stays `--fg`/`--muted`.

## Rules

- Group related content in a `.card` so it separates clearly from the page; headings and section labels sit on the page background between cards. Don't nest cards inside cards.
- One brand accent (green). Status colors (urgent, attention, new) only to mark state, never decoration.
- Focus states visible: `outline: 2px solid var(--accent); outline-offset: 2px`.
- Respect `prefers-reduced-motion` (turn off transitions).
- Copy is plain and direct. Buttons say exactly what they do.
- Numbered section titles only when the order matters.
