# Sonder Threads — Design System

Use this file as the visual source of truth for Sonder Threads. Match it exactly unless told otherwise. When building any UI, apply these tokens and components before inventing new ones.

## Feel

Calm, utilitarian, organized. A working tool, not a marketing page. One readable column, clear hierarchy, quiet surfaces, one green accent. No gradients, no emoji as icons, no heavy shadows, no giant hero.

## Tokens

Define every color as a CSS variable on `:root`, then redefine for dark mode. Never hard-code a color in a component.

```css
/* Layout: single readable column; grouped sections; running progress */
:root{
  --bg:#f7f8f6; --surface:#ffffff; --fg:#1d2420; --muted:#5d6a63; --line:#d9dfdb;
  --accent:#1f6b4f; --accent-soft:#e3efe9; --warn:#9a5b00; --warn-soft:#fbf0de;
  --display:"Source Serif 4", Georgia, serif;
  --body:"Source Sans 3", system-ui, -apple-system, "Segoe UI", sans-serif;
}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){
  --bg:#141917; --surface:#1c2320; --fg:#e7ece9; --muted:#9aa8a1; --line:#2e3833;
  --accent:#6cc39f; --accent-soft:#1f3229; --warn:#e8b25c; --warn-soft:#33281a; color-scheme:dark}}
:root[data-theme="dark"]{
  --bg:#141917; --surface:#1c2320; --fg:#e7ece9; --muted:#9aa8a1; --line:#2e3833;
  --accent:#6cc39f; --accent-soft:#1f3229; --warn:#e8b25c; --warn-soft:#33281a; color-scheme:dark}
body{background:var(--bg);color:var(--fg);font-family:var(--body);font-size:16px;line-height:1.5}
```

| Token | Use |
|---|---|
| `--bg` | Page background |
| `--surface` | Cards, lists, tables |
| `--fg` | Main text |
| `--muted` | Secondary text, labels, dates |
| `--line` | Borders and dividers |
| `--accent` / `--accent-soft` | Links, checkboxes, progress, "verified"/success tags |
| `--warn` / `--warn-soft` | Callouts, "estimate"/caution tags |

## Typography

Load from Google Fonts:

```html
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,600&family=Source+Sans+3:wght@400;600;700&display=swap">
```

| Role | Font | Size | Weight |
|---|---|---|---|
| Page title (h1) | Source Serif 4 | 2rem, line-height 1.15 | 600 |
| Section title (h2) | Source Serif 4 | 1.3rem | 600 |
| Body | Source Sans 3 | 16px, line-height 1.5 | 400 |
| Eyebrow / table header | Source Sans 3 | 0.78rem, uppercase, letter-spacing .06–.08em | 600, `--muted` |
| Notes / small | Source Sans 3 | 0.88–0.9rem | 400, `--muted` |

- Serif is for headings only. Everything else is sans.
- Headings use `text-wrap: balance`.
- Any numbers in columns use `font-variant-numeric: tabular-nums`.

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

## Rules

- Cards and borders only on the list/table boxes and the one callout. Don't put every block in a card.
- One accent color. Warn color only for caution states.
- Focus states visible: `outline: 2px solid var(--accent); outline-offset: 2px`.
- Respect `prefers-reduced-motion` (turn off transitions).
- Copy is plain and direct. Buttons say exactly what they do.
- Numbered section titles only when the order matters.
