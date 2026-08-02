# INFORMATION_ARCHITECTURE.md — EngineerOS

## UX Research Inputs (Phase 2 reference)

Studied for pattern-borrowing, not cloning:

| Product | Learn From |
|---|---|
| Obsidian | Knowledge graph, backlinks |
| Notion | Databases, flexible pages |
| Linear | Task management, issue flow |
| Logseq | Daily notes, journaling |
| Capacities | Object-based knowledge management |
| Anytype | Local-first architecture |
| Reflect | AI-assisted note organization |
| NotebookLM | Document understanding |
| Superlist | Personal task management |

Principle applied below: Linear's task flow for Tasks/Kanban, Logseq's daily-note ritual for Daily Notes, Notion's flexible-page model for Notes, Obsidian's backlink concept reserved for Phase 9 (Knowledge Graph) — not built now, but Note↔Task↔Project linking in the schema is what makes it possible later.

## Site Map

```
EngineerOS
├── Dashboard
├── Projects
│   ├── Overview
│   ├── Notes
│   ├── Tasks
│   └── Resources
├── Notes
├── Tasks
├── Daily Notes
├── Search
└── Settings
```

Every screen maps to exactly one core entity (User, Workspace, Project, Task, Note, Daily Note). No screen is introduced that doesn't serve one of the six.

## Route Table

| Route | Screen | Primary Entity | Auth Required |
|---|---|---|---|
| `/` | Landing | — | No |
| `/login` | Login | User | No |
| `/register` | Register | User | No |
| `/dashboard` | Dashboard | Workspace (aggregate) | Yes |
| `/projects` | Projects list | Project | Yes |
| `/projects/:id` | Single Project | Project | Yes |
| `/notes` | Notes list | Note | Yes |
| `/notes/:id` | Single Note | Note | Yes |
| `/tasks` | Kanban board | Task | Yes |
| `/daily` | Today's Daily Note (redirects to `/daily/:date`) | Daily Note | Yes |
| `/daily/:date` | Daily Note for date | Daily Note | Yes |
| `/settings` | Settings | User/Workspace | Yes |
| `*` | 404 | — | No |

Search has no dedicated route — it's a global overlay (cmd+K style) accessible from every authenticated screen, not a page of its own.

## Navigation Rules

- Top-level nav is fixed: Dashboard, Projects, Tasks, Notes, Daily, Search, Settings. Nothing added without cutting something else — this list does not grow during Phase 6 build.
- Within a Project, the four sub-tabs (Overview, Notes, Tasks, Timeline, Resources — per MVP.md) are scoped views filtered by `project_id`, not separate top-level entities.
- Quick Capture is a persistent action (not a screen) reachable from Dashboard and via global shortcut — it creates a Note or Task without leaving current context.

## Entity Relationship Summary (IA-level, full schema in DATABASE_PLAN.md)

```
User 1───1 Workspace
Workspace 1───* Project
Workspace 1───* DailyNote
Project 1───* Task
Project 1───* Note
Task *───* Note   (linked notes, many-to-many)
```

## Content Hierarchy per Screen

**Dashboard** — Today's Focus (top), Today's Tasks + Recent Notes (two-column), Project Progress (row of cards), Recent Activity (feed), Quick Capture (persistent, always accessible).

**Single Project** — Overview tab default on open; Notes/Tasks/Timeline/Resources as tabs, not nested routes requiring full reload.

**Single Note** — Title + metadata bar (tags, project, pinned, updated) above a full-width markdown editor/viewer toggle.

**Kanban (Tasks)** — Columns by status; filters for Project and Priority pinned above the board; no sub-navigation.

**Daily Note** — Fixed section order (Morning Goals, Journal, Today's Tasks, Learned, Wins, Problems, Tomorrow) — order does not change per user, so the daily ritual stays muscle-memory fast.
