# MVP.md — EngineerOS Phase 1 Scope

## MVP Goal

Solve exactly one problem in V1: **capture everything, find everything, organize everything.** No AI.

## MoSCoW

### Must Have

- Dashboard
- Projects
- Notes
- Daily Notes
- Kanban
- Tasks
- Search
- Markdown editing
- Authentication
- Dark mode
- Quick capture
- Tags
- Project linking

### Should Have

- Calendar
- Code snippets
- Bookmarks
- Architecture notes
- Reading list
- Meeting notes

### Could Have

- Voice notes
- AI summary
- GitHub integration
- Calendar sync
- PDF chat
- Mind maps

### Won't Have (this version)

- Team collaboration
- Billing
- Marketplace
- Plugin store
- Multi-workspace
- Enterprise features

## Core Objects

Six entities. Everything else is derived from or attached to these.

```
User → Workspace → Project → Task
                          → Note
                          → Daily Note
```

- **User** — auth identity
- **Workspace** — top-level container owned by a user (single workspace per user in V1, schema allows more later)
- **Project** — a body of work; contains notes, tasks, resources
- **Task** — actionable item; belongs to a project (or standalone), has status/priority/due date
- **Note** — markdown document; may belong to a project, may be pinned, tagged
- **Daily Note** — one per calendar day per workspace; auto-scaffolded template

## User Journey

```
Signup
  → Create Workspace
  → Create First Project
  → Create Daily Note
  → Write Notes
  → Add Tasks
  → Move Tasks (kanban)
  → Search
  → Weekly Review
  → Return Tomorrow
```

This is the entire loop the MVP must support end-to-end without friction.

## Navigation (top-level, nothing more)

- Dashboard
- Projects
- Tasks
- Notes
- Daily
- Search
- Settings

## Dashboard

Must answer, at a glance:

1. What should I work on?
2. What did I finish?
3. What is blocked?
4. Where are my notes?

Sections:

- Today's Focus
- Today's Tasks
- Recent Notes
- Project Progress
- Recent Activity
- Quick Capture

## Projects

Each project has:

- Overview
- Notes
- Tasks
- Timeline
- Resources

## Notes — required fields

- Title
- Markdown body
- Tags
- Created (timestamp)
- Updated (timestamp)
- Project (nullable FK)
- Status
- Pinned (bool)

## Tasks — required fields

- Title
- Priority
- Status
- Due date
- Estimate
- Project (nullable FK)
- Linked notes

## Daily Notes — auto-generated sections

- Morning Goals
- Journal
- Today's Tasks
- Learned
- Wins
- Problems
- Tomorrow

One daily note auto-created per day, on first visit to `/daily` for that date.

## Search

Single search bar. Searches across: Notes, Tasks, Projects, Tags. Instant (client-side filter on cached index, or debounced server query — decided in BACKEND_ROADMAP.md).

## MVP Screens (exhaustive — nothing else gets built)

1. Landing
2. Login
3. Register
4. Dashboard
5. Projects (list)
6. Single Project
7. Notes (list)
8. Single Note
9. Tasks (kanban board)
10. Daily Note
11. Settings
12. 404

## Success Metrics

After one week of real use, a user should have, without feeling overwhelmed:

- 30 notes
- 100 tasks
- 5 projects
- 7 daily journals

If the app can't comfortably hold that volume without feeling cluttered or slow, the IA or UI has failed and needs revisiting before moving to Phase 8.
