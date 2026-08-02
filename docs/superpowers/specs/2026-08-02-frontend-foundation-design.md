# Frontend Foundation — Design

**Date:** 2026-08-02
**Source:** docs/planning/FRONTEND_ROADMAP.md, UI_DEVELOPMENT_PLAN.md (step 1), DESIGN_SYSTEM.md, INFORMATION_ARCHITECTURE.md

## Goal

Build step 1 of the Phase 6 frontend MVP: the project scaffold, design-token system, and authenticated app shell. No Supabase — backend wiring is deferred to step 2 (auth).

## Stack (from FRONTEND_ROADMAP.md)

- Next.js (App Router), TypeScript, ESLint
- Tailwind CSS v4 + shadcn/ui, restyled to DESIGN_SYSTEM.md tokens
- Lucide icons (16px default, stroke-width 1.75)
- Zustand or `useState` for pure UI state (theme only in this step)

## Scope

1. **Scaffold** — `create-next-app` (App Router, TypeScript, src dir, ESLint), Tailwind v4, shadcn/ui init.
2. **Design tokens** — `globals.css` carries DESIGN_SYSTEM.md variables verbatim:
   - `:root` = dark (default): `--bg-base #0d0e12`, `--bg-surface #16171d`, `--bg-surface-hover #1e1f27`, `--bg-elevated #1e1f27`, `--border-subtle #2a2b34`, `--border-default #35363f`, `--text-primary #e8e9ed`, `--text-secondary #9a9ba5`, `--text-tertiary #66676f`, `--accent #6366f1`, `--accent-hover #7678f5`, `--accent-muted #23233f`, plus success/warning/danger/info and the five priority colors.
   - `[data-theme="light"]` = the light override block from the same doc.
   - Mapped into Tailwind via `@theme inline` so utilities like `bg-surface`, `text-secondary`, `border-default`, `bg-accent`, `text-accent` resolve to tokens.
3. **ThemeProvider** — dark default; sets `data-theme` on `<html>`; persists choice to localStorage; re-hydrates before paint (no flash on reload).
4. **App shell** (`app/(app)/layout.tsx`) — left nav with the fixed seven items (Dashboard, Projects, Tasks, Notes, Daily, Settings + Search). Per INFORMATION_ARCHITECTURE.md, Search has no dedicated route (it is the cmd+K overlay) — so the Search nav item is a stub button in step 1 (no `href`), to be wired to the command palette in step 7. Top bar with Quick Capture button (visual stub only — modal ships with step 8) and theme toggle.
5. **Routes** — one stub per IA route table, each with a designed empty state (never a blank rectangle):
   - `(marketing)/page.tsx` — Landing placeholder
   - `(auth)/login`, `(auth)/register`
   - `(app)/dashboard`
   - `(app)/projects`, `(app)/projects/[id]`
   - `(app)/notes`, `(app)/notes/[id]`
   - `(app)/tasks`
   - `(app)/daily`, `(app)/daily/[date]`
   - `(app)/settings`
   - `not-found.tsx`
6. **Components** — `components/shell/AppNav.tsx`, `TopBar.tsx`, `ThemeToggle.tsx`; `components/ui/*` = restyled shadcn primitives (Button, etc.). Folder layout per FRONTEND_ROADMAP.md; no code for later screens is pulled forward.

## Component Boundaries

- `ThemeProvider` — owns theme state + persistence. Used once, in `(app)` and `(marketing)` layouts so the toggle works everywhere.
- `AppNav` — renders the seven fixed nav links, active-state highlighting. Reads current path via `usePathname`. Depends only on `next/navigation`.
- `TopBar` — theme toggle + Quick Capture stub. No entity knowledge.
- Route stubs — pure presentational empty states with icon + one-line copy + primary action placeholder. No data fetching.

## Data Flow

None this step — no server state. Theme flow only: ThemeProvider reads localStorage on mount → applies `data-theme` to `<html>` → toggle writes localStorage + updates attribute. Simple and synchronous.

## Error Handling

- Theme hydration: guard against localStorage access during SSR (only touch it client-side).
- Nav active state: fall back gracefully if a path matches no nav item (no crash on 404).

## Testing / Acceptance

From UI_DEVELOPMENT_PLAN.md step 1:
- Navigating between (empty) routes preserves the shell.
- Theme toggle persists across reload (localStorage).
- All 7 nav items route correctly.
- Dark/light parity on every route stub.
- No console errors; keyboard-focusable nav; works at 1280px+.

No unit test framework is added this step (docs specify none); acceptance is verified by `npm run dev` + manual/browser check.

## Out of Scope (explicitly deferred)

- Supabase client, auth, typed `types/database.ts`, env vars — step 2
- Quick Capture modal functionality, command palette — later steps
- Any real entity screens — steps 3–9
