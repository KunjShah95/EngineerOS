# DESIGN_SYSTEM.md — EngineerOS

## Design Principles

1. **Dense, not cluttered.** Engineers want information density (Linear/Notion level), not marketing-site whitespace.
2. **Dark mode is the default**, light mode is the alternate — this is a tool used at night and during deep work, not a consumer app.
3. **Markdown-native.** Typography must render clean markdown (headings, code blocks, lists, tables) beautifully — this is used constantly.
4. **No decoration without function.** No illustrations, no gradients-for-gradients-sake. Every visual element earns its place.
5. **Engineering instrument, not dashboard.** The app must not read as default shadcn. Specifically: no `rounded-full` pills as a structural device, no filled rounded icon chips, no uppercase Inter as a label. Structure comes from hairline rules and rails; corners are square-ish (6px); labels are monospaced.
6. **Color is a signal, never an ornament.** One accent (indigo) for interaction, one signal color (mint) for state — historical, verified, resolved. If something is mint, it is telling you something.

## Type System

Four families, four jobs. Using the wrong one for a job is a design bug, not a taste call.

| Family | Variable | Job | Never used for |
|---|---|---|---|
| **Fraunces** | `--font-serif-display` | Editorial display: page/section headlines that make a claim | Body text, controls, dense data |
| **Inter** | `--font-sans` | Body text, prose, UI copy | Labels, numeric readouts |
| **JetBrains Mono** | `--font-mono` | Labels, metadata, keycaps, scores, dates, anything monospaced | Paragraphs |
| **Space Grotesk** | `--font-display` | Reserved accents | — |

- **Labels are monospaced.** Section eyebrows, group headers, statuses, counts. This is the single strongest signal that an interface was designed rather than defaulted — Inter uppercase reads as template; mono tracked-out reads as instrument.
  - Use `.label-mono`: 11px, 0.16em tracking, uppercase, tertiary.
- **Measured values are tabular.** Relevance scores, `+N −M` deltas, counts, dates, keycaps.
  - Use `.figure-mono`: mono + `tabular-nums` so columns align and can be compared at a glance.
- **Fraunces inside the app** is for one thing: a headline making a claim (e.g. the assistant empty state). Not for chrome.

### Shared utilities

Defined in `globals.css` under `@layer components` / `@utility`:

- `.label-mono` — micro-label (11px, tracked, uppercase, tertiary)
- `.figure-mono` — tabular measured value
- `.panel-inset` — structural container: 6px radius, hairline border, surface bg, **no shadow**
- `.rail-accent` / `.rail-signal` — 2px left rail for selection and provenance
- `bg-blueprint` — 28px engineering grid; texture for empty space only

Shadows are reserved for things that genuinely float (popovers, dialogs, the landing terminal). Structure never gets a shadow.

## Shape Language

- **Structure:** square-ish. 6px radius (`rounded-md`). Pills (`rounded-full`) only for tags and status chips, never for buttons, list items, or nav.
- **Selection** is marked by a 2px left rail, not a filled background pill.
- **Grouping** is by hairline rules (`divide-y border-border-subtle`), not by nested boxes.

## Typography

- **Font (UI):** Inter (system-ui fallback stack)
- **Font (code/markdown code blocks):** JetBrains Mono (monospace fallback)
- **Scale:**
  - Display: 32px / 40px line-height / 600 weight — landing only
  - H1: 24px / 32px / 600 — page titles
  - H2: 18px / 28px / 600 — section headers
  - H3: 15px / 22px / 600 — card/subsection headers
  - Body: 14px / 20px / 400 — default UI text
  - Small: 12px / 16px / 400 — metadata, timestamps, labels
  - Code: 13px / 20px / 400, monospace

## Color Palette

Defined as CSS variables, dark-first.

```css
:root {
  /* dark (default) */
  --bg-base: #0d0e12;
  --bg-surface: #15161c;
  --bg-surface-hover: #1d1e26;
  --bg-elevated: #1d1e26;
  --border-subtle: #282a34;
  --border-default: #34363f;

  --text-primary: #e9eaee;
  --text-secondary: #9b9ca7;
  --text-tertiary: #8a8b96;

  --accent: #4f46e5;       /* indigo — interaction */
  --accent-hover: #6366f1;
  --accent-muted: #1c2340;

  /* Signal mint — semantically reserved. Historical state, verified/resolved,
     live system status. Never decoration. */
  --signal: #6ee7b7;
  --signal-muted: #14352c;

  --success: #22c55e;
  --warning: #eab308;
  --danger: #ef4444;
  --info: #3b82f6;

  /* priority colors (tasks) */
  --priority-urgent: #ef4444;
  --priority-high: #f97316;
  --priority-medium: #eab308;
  --priority-low: #3b82f6;
  --priority-none: #65666f;
}

[data-theme="light"] {
  --bg-base: #fafafa;
  --bg-surface: #f4f4f6;
  --bg-surface-hover: #ececf0;
  --bg-elevated: #ffffff;
  --border-subtle: #e7e7eb;
  --border-default: #d6d6dc;

  --text-primary: #16171d;
  --text-secondary: #5c5d66;
  --text-tertiary: #8a8b93;

  --accent: #4f46e5;
  --accent-hover: #4338ca;
  --accent-muted: #eceeff;

  /* Darkened for contrast on the light background. */
  --signal: #047857;
  --signal-muted: #e3f2ec;
}
```

> Authoritative values live in `src/app/globals.css`. This doc is the *rule*;
> the stylesheet is the current *state*. If they disagree, the stylesheet wins
> and this doc needs updating.

### Color discipline

- `--accent` (indigo) = **interaction**. Anything clickable, selected, or active.
- `--signal` (mint) = **state**. Historical/pinned, verified, resolved, live.
- `--text-tertiary` = labels and metadata, never body copy.
- Status colors (`success`/`warning`/`danger`) only carry actual status.

Adding a third accent for a feature is how a product becomes generic. Extend
`--signal` semantics or reuse an existing one.

## Spacing Scale

4px base unit: `4, 8, 12, 16, 24, 32, 48, 64` (Tailwind default scale — no custom spacing tokens needed).

## Component Rules

- **Cards:** `bg-surface`, 1px `border-subtle`, 8px radius, 16px padding. Hover state on interactive cards: `bg-surface-hover`.
- **Buttons:** Primary = `accent` bg / white text. Secondary = `bg-elevated` / `border-default` / `text-primary`. Ghost = transparent / `text-secondary`, hover `bg-surface-hover`. All buttons: 6px radius, 8px/14px padding, 14px text, 500 weight.
- **Inputs:** `bg-surface`, `border-default`, 6px radius, focus ring = 2px `accent` at 40% opacity. No placeholder-as-label — always a real label.
- **Kanban columns:** fixed-width (280px), `bg-base` background, column header = Small-scale uppercase `text-secondary` with count badge.
- **Kanban cards:** `bg-surface` card per rules above, priority shown as a 3px left border-accent in the priority color, title truncates at 2 lines.
- **Tags/pills:** 4px radius (not fully rounded — this isn't a consumer app), 11px text, `bg-accent-muted` / `text-accent` by default, custom tag color overrides background.
- **Markdown rendering:** headings get generous top-margin (24px) but tight bottom-margin (8px) to group with following content; code blocks use `bg-base` (darker than surrounding surface) with `JetBrains Mono`; tables get `border-subtle` row dividers, no zebra striping.

## Iconography

Lucide icons exclusively (matches Linear/shadcn ecosystem), 16px default size in UI chrome, 20px in empty states, stroke-width 1.75.

## Motion

Minimal. 120ms ease-out for hover/press states, 180ms for panel/modal open. No page-transition animation — instant navigation is a feature for a dense productivity tool, not a place for delight-animation.

## Dark/Light Parity

Every component must be specified and tested in both themes before being marked done in UI_DEVELOPMENT_PLAN.md — dark mode is default but light mode is not an afterthought.

## Component Library Base

shadcn/ui on Tailwind CSS, restyled to the tokens above. Do not hand-roll primitives shadcn already provides (Dialog, Dropdown, Tabs, Toast, Command palette for search).
