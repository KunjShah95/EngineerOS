# DESIGN_SYSTEM.md — EngineerOS

## Design Principles

1. **Dense, not cluttered.** Engineers want information density (Linear/Notion level), not marketing-site whitespace.
2. **Dark mode is the default**, light mode is the alternate — this is a tool used at night and during deep work, not a consumer app.
3. **Markdown-native.** Typography must render clean markdown (headings, code blocks, lists, tables) beautifully — this is used constantly.
4. **No decoration without function.** No illustrations, no gradients-for-gradients-sake. Every visual element earns its place.

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
  --bg-surface: #16171d;
  --bg-surface-hover: #1e1f27;
  --bg-elevated: #1e1f27;
  --border-subtle: #2a2b34;
  --border-default: #35363f;

  --text-primary: #e8e9ed;
  --text-secondary: #9a9ba5;
  --text-tertiary: #66676f;

  --accent: #6366f1;       /* indigo — primary actions */
  --accent-hover: #7678f5;
  --accent-muted: #23233f;

  --success: #22c55e;
  --warning: #eab308;
  --danger: #ef4444;
  --info: #3b82f6;

  /* priority colors (tasks) */
  --priority-urgent: #ef4444;
  --priority-high: #f97316;
  --priority-medium: #eab308;
  --priority-low: #3b82f6;
  --priority-none: #66676f;
}

[data-theme="light"] {
  --bg-base: #ffffff;
  --bg-surface: #f7f7f8;
  --bg-surface-hover: #eeeef0;
  --bg-elevated: #ffffff;
  --border-subtle: #e5e5e8;
  --border-default: #d4d4d9;

  --text-primary: #16171d;
  --text-secondary: #5c5d66;
  --text-tertiary: #8a8b93;

  --accent: #6366f1;
  --accent-hover: #4f52e0;
  --accent-muted: #eeeeff;
}
```

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
