# FRONTEND_ROADMAP.md — EngineerOS

## Stack

- **Framework:** Next.js (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS + shadcn/ui (per DESIGN_SYSTEM.md)
- **State:** React Query (server state: notes/tasks/projects/daily notes) + minimal Zustand for pure UI state (theme, command palette open/closed, active kanban drag)
- **Forms:** React Hook Form + Zod (schema matches DATABASE_PLAN.md constraints)
- **Markdown:** `react-markdown` + `remark-gfm` for render, plain `<textarea>`-based editor with edit/preview toggle for V1 (no WYSIWYG editor — YAGNI until user feedback says otherwise)
- **Drag-and-drop (kanban):** `@dnd-kit/core`
- **Data layer:** Supabase JS client, typed via generated types from the Postgres schema in DATABASE_PLAN.md

## Routing (App Router file structure)

```
app/
├── (marketing)/
│   └── page.tsx                 # Landing
├── (auth)/
│   ├── login/page.tsx
│   └── register/page.tsx
├── (app)/                       # authenticated layout wraps all below
│   ├── layout.tsx               # shell: nav + top bar
│   ├── dashboard/page.tsx
│   ├── projects/
│   │   ├── page.tsx             # list
│   │   └── [id]/page.tsx        # single project, tabs as query param or nested segments
│   ├── notes/
│   │   ├── page.tsx
│   │   └── [id]/page.tsx
│   ├── tasks/page.tsx           # kanban
│   ├── daily/
│   │   ├── page.tsx             # redirects to today
│   │   └── [date]/page.tsx
│   └── settings/page.tsx
└── not-found.tsx
```

## Component Hierarchy

```
components/
├── shell/
│   ├── AppNav.tsx
│   ├── TopBar.tsx
│   └── ThemeToggle.tsx
├── quick-capture/
│   └── QuickCaptureButton.tsx + QuickCaptureModal.tsx
├── search/
│   └── CommandPalette.tsx
├── project/
│   ├── ProjectCard.tsx
│   ├── ProjectForm.tsx
│   └── ProjectTabs.tsx
├── note/
│   ├── NoteCard.tsx
│   ├── NoteEditor.tsx          # edit/preview toggle wrapper
│   └── MarkdownRenderer.tsx
├── task/
│   ├── KanbanBoard.tsx
│   ├── KanbanColumn.tsx
│   ├── TaskCard.tsx
│   └── TaskDetailPanel.tsx
├── daily/
│   ├── DailyNoteSection.tsx     # generic reusable section editor
│   └── TodayTasksList.tsx
├── dashboard/
│   ├── TodayFocus.tsx
│   ├── RecentNotes.tsx
│   ├── ProjectProgress.tsx
│   └── ActivityFeed.tsx
└── ui/                          # shadcn primitives, restyled
```

Rule: components are split by entity (project/note/task/daily), not by technical layer — matches file-structure guidance of "files that change together live together."

## State Management Rules

- **Server state (anything from Supabase)** lives in React Query. No entity data duplicated into Zustand or component state beyond optimistic-update scratch state.
- **Optimistic updates** required for: kanban drag (status/position), note pin toggle, task status change. Everything else can wait for server round-trip (creates/deletes are infrequent enough not to need it).
- **UI-only state** (theme, modal open/closed, command palette query) in Zustand or local `useState` — never React Query.

## Data Fetching Pattern

```typescript
// hooks/useTasks.ts
export function useTasks(workspaceId: string, filters?: TaskFilters) {
  return useQuery({
    queryKey: ['tasks', workspaceId, filters],
    queryFn: () => fetchTasks(workspaceId, filters),
  });
}

export function useUpdateTaskStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateTaskStatus,
    onMutate: async (variables) => {
      // optimistic cache update for drag-and-drop
      await queryClient.cancelQueries({ queryKey: ['tasks'] });
      const previous = queryClient.getQueryData(['tasks']);
      queryClient.setQueryData(['tasks'], (old) => applyOptimisticStatus(old, variables));
      return { previous };
    },
    onError: (_err, _vars, context) => {
      queryClient.setQueryData(['tasks'], context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  });
}
```

This pattern (query hook + optimistic mutation hook, one pair per entity) is reused for notes, projects, and daily notes — not reinvented per screen.

## Build Order

Matches UI_DEVELOPMENT_PLAN.md screen order exactly: shell → auth → projects → notes → tasks → daily → search → dashboard → settings → polish. Frontend roadmap adds no new sequencing — it specifies *how* each screen in that plan gets built, not a different order.

## Performance Budget

- Route transitions: no full-page reload (App Router client navigation)
- Kanban drag: 60fps, no layout thrash — use `@dnd-kit` transform-based dragging, not re-render-per-frame
- Command palette open: <100ms to interactive
- Markdown preview render: debounce at 150ms while typing in edit mode
