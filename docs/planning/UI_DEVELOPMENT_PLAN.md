# UI_DEVELOPMENT_PLAN.md — EngineerOS

Screen-by-screen build order for Phase 6 (Frontend MVP). Build in this order — later screens depend on components built by earlier ones.

## Build Order

### 1. Design tokens + shell
- Tailwind config wired to DESIGN_SYSTEM.md CSS variables, dark/light theme toggle working
- App shell: left nav (Dashboard/Projects/Tasks/Notes/Daily/Search/Settings), top bar with Quick Capture + theme toggle
- **Acceptance:** navigating between (empty) routes preserves shell, theme toggle persists across reload (localStorage), all 7 nav items route correctly

### 2. Auth screens (Landing, Login, Register)
- Landing: single-viewport pitch + CTA, no scroll-jacking
- Login/Register: email+password via Supabase Auth, error states for invalid creds / existing email
- **Acceptance:** can register, get redirected to `/dashboard` with a workspace auto-created, can log out and back in, invalid login shows inline error not a crash

### 3. Projects (list + single)
- Projects list: card grid, name/status/color, "New Project" creates and routes to it
- Single Project: Overview tab (description, stats), tab bar for Notes/Tasks/Timeline/Resources (Timeline/Resources can be empty-state stubs — Should Have, not required functional in V1 beyond the tab existing)
- **Acceptance:** create/rename/archive a project; Overview shows live counts of its notes and tasks

### 4. Notes (list + single + editor)
- Notes list: filterable by project/tag, pinned notes surface at top
- Single Note: markdown editor (edit/preview toggle) with title, tags, project picker, pinned toggle
- **Acceptance:** create a note, write markdown, see it render correctly (headings/code/lists/tables per DESIGN_SYSTEM.md), pin it, assign to a project, it appears in that project's Notes tab

### 5. Tasks (kanban)
- Board with Backlog/Todo/In Progress/Done columns
- Drag-and-drop between columns (updates `status` + `position`)
- Task card: title, priority color bar, due date, project chip
- Task detail (modal or side panel): full field editor incl. linked notes
- Filters: by project, by priority
- **Acceptance:** create a task, drag it across all 4 columns with position persisting on reload, link a note to a task, filter board by project

### 6. Daily Notes
- `/daily` redirects to `/daily/:today`, auto-creates row on first visit
- Fixed section order per INFORMATION_ARCHITECTURE.md, each section is its own markdown textarea/editor
- "Today's Tasks" section renders live tasks due that day (computed, not stored — per DATABASE_PLAN.md)
- Date navigation (prev/next day, jump-to-date)
- **Acceptance:** visiting `/daily` for a new date creates the row exactly once (no duplicate on refresh), navigating to yesterday shows/edits that day's entry, task list on a given day matches tasks with that due_date

### 7. Search
- Global cmd+K / click-to-open command palette
- Debounced query across Notes/Tasks/Projects/Tags, grouped results, keyboard navigation
- **Acceptance:** opening search from any screen, typing a note title returns it within 300ms perceived latency, Enter navigates to it, Escape closes without navigating

### 8. Dashboard
- Built last because it aggregates all other entities
- Today's Focus, Today's Tasks, Recent Notes, Project Progress, Recent Activity, Quick Capture
- **Acceptance:** all six sections populated from real data (not mocked), Quick Capture creates a `quick_captures` row and is triageable into a note or task without leaving the dashboard

### 9. Settings
- Profile (display name, avatar), workspace name, theme preference, logout, account deletion (soft — flags workspace, does not hard-delete per DATABASE_PLAN.md)
- **Acceptance:** changing display name reflects immediately in top bar, logout returns to Landing

### 10. 404 + polish pass
- 404 screen for unmatched routes
- Full dark/light parity check across all 9 prior screens
- Loading and empty states for every list view (Projects/Notes/Tasks/Search with zero results)
- **Acceptance:** every screen has a designed empty state (not a blank white/black rectangle), every screen tested in both themes

## Definition of Done (applies to every screen above)

- Matches DESIGN_SYSTEM.md tokens (no ad hoc colors/spacing)
- Keyboard-accessible: tab order sane, focus states visible
- No console errors
- Works at 1280px+ width (V1 targets desktop; mobile responsiveness is Should Have, not blocking)
- Real data from Supabase, not hardcoded mocks, before marked complete
