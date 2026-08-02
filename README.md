# EngineerOS

I got tired of losing my mind.

Not dramatically. Just the slow, grinding kind — where you know you wrote something down somewhere, you just can't remember if it was in Notion, a Obsidian vault, a Google Doc, a sticky note, a GitHub issue, a Slack message, or a ChatGPT thread that's now buried under forty others.

I'm an engineer. I work on multiple things at once. I have architecture decisions I made six months ago that I need to remember today. I have tasks that belong to projects that relate to notes that reference PDFs I read once and can't find. I have daily journals that never connect to the work they're about. I have GitHub issues that have no relationship to the notes I took while fixing them.

Everything is somewhere. Nothing is connected. Nothing remembers.

So I built this.

---

## What it is

EngineerOS is a workspace that treats your knowledge like a database — not a pile of documents. Notes link to tasks. Tasks belong to projects. Everything is indexed and searchable by meaning, not just keywords. You can ask it questions and it will cite the notes it pulled the answer from. Your daily journal connects to today's tasks. Your architecture notes are one wikilink away from the code decision they explain.

Mental model: **Obsidian + Linear + Notion + NotebookLM** — in one place, with an AI layer on top that actually understands what's in there.

The core data model is six objects:

```
User → Workspace → Project → Task
                           → Note
                           → Daily Note
```

Everything else is derived from or attached to these. No dead ends. No orphaned documents.

---

## Why I built it instead of using something else

**Notion** is a document tool pretending to be a database. Tasks are second-class citizens. Search is mediocre. The AI feels bolted on.

**Obsidian** is a graph of markdown files. No tasks. No projects. No structured data. Syncing is painful. The AI plugins are plugins.

**Linear** is tasks only. No notes. No daily journal. No knowledge base.

**Logseq / Roam** — outliner-centric. I don't think in outliners.

**Cursor Memories** — only knows about your code, not your architecture docs, your meeting notes, or your 3am ideas.

None of them talked to each other. I was maintaining context across six different tools. Every context switch was a tax. Every search was a lottery. I was the glue, and I was failing at it.

The closest thing to what I wanted was "what if everything lived in one place and an AI could see all of it." So I started building that instead.

---

## What it actually does

### Capture

One dialog (`⌘K` or the Quick Capture button), two keystrokes, and whatever's in your head is either a note, a task, or sitting in the inbox until you triage it. Auto-triage rules can route captures by keyword automatically.

### Organize

- **Notes** — markdown with frontmatter, tags, project assignment, pinning, `[[wikilinks]]` that resolve to backlinks
- **Tasks** — kanban board (Backlog / Todo / In Progress / Done), priority, due date, linked notes
- **Projects** — notes, tasks, timeline, and resources under one roof with visible progress
- **Daily notes** — one per day, auto-created, with sections: Morning goals, Journal, Today's tasks, Learned, Wins, Problems, Tomorrow. Unfinished tasks roll over automatically.
- **Resources** — code snippets, bookmarks, reading list, architecture notes, meeting notes, all typed and queryable

### Find

- **⌘K command palette** — instant search across notes, tasks, projects, tags
- **Semantic search** — toggle to meaning-based search; the index finds the right note even when you don't remember the exact words. Falls back to local keyword scoring without an API key.

### Understand

- **AI assistant** — ask questions about your workspace in plain English. Answers cite the exact notes they came from. Threads are persisted so you can continue a conversation.
- **Knowledge graph** — force-directed graph of how your notes connect via wikilinks, task links, and project membership. Filter by project, drag nodes, click to open.
- **PDF chat** — upload a paper or doc, ask questions about it, get cited answers
- **Voice notes** — record and transcribe; transcription falls back to local extraction without a key
- **Mind maps** — any note becomes a visual mind map

### Automate

- **Recurring tasks** — create daily, weekly, or monthly tasks automatically
- **Auto-triage** — keyword rules route quick captures to notes or tasks
- **Daily rollover** — yesterday's unfinished tasks carry forward
- All of this runs in a client-drained Postgres job queue — no cron, no edge functions, no separate worker

### Integrate

- **GitHub** — import issues into tasks; link repos to projects
- **Calendar** — export tasks with due dates to `.ics`

---

## Stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router), React 19 |
| Language | TypeScript throughout |
| Database | Supabase (Postgres + pgvector + RLS) |
| Auth | Supabase Auth |
| State | TanStack Query (server state), Zustand (UI state) |
| UI | shadcn/ui, Tailwind CSS v4, Framer Motion |
| AI | OpenAI embeddings + chat — fully optional, local fallbacks for everything |
| Email | Resend (optional) |
| Monitoring | Sentry (optional), Plausible (optional) |
| Tests | Vitest |

Supabase is optional. Without credentials the app runs in local/demo mode and AI features use keyword-based fallbacks. Nothing hard-requires a paid service to run.

---

## Get started

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Register, create a workspace, and start capturing.

### Environment variables

Everything is opt-in. At minimum you need the Supabase pair for real data.

| Variable | What it unlocks |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Real data — required |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Real data — required |
| `OPENAI_API_KEY` | Semantic search, AI assistant, PDF chat, voice transcription, summaries |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | GitHub integration OAuth |
| `RESEND_API_KEY` / `EMAIL_FROM` | Email reminders (Resend) |
| `NEXT_PUBLIC_SENTRY_DSN` / `SENTRY_DSN` | Error tracking |
| `SENTRY_ORG` / `SENTRY_PROJECT` / `SENTRY_AUTH_TOKEN` | Sentry source-map upload (CI only) |
| `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` | Analytics |
| `NEXT_PUBLIC_APP_URL` | Canonical origin for metadata — auto-derived from `VERCEL_URL` if not set |
| `CRON_SECRET` | Server cron auth — Vercel sends it as `Authorization: Bearer` to `/api/cron/drain` |
| `SUPABASE_SERVICE_ROLE_KEY` | Server cron drain only — never expose to the client |

Never expose `SUPABASE_SERVICE_ROLE_KEY` to the client.

---

## Scripts

```bash
npm run dev        # start dev server
npm run build      # production build
npm run lint       # eslint
npm run test       # vitest
npm run typecheck  # tsc --noEmit
```

---

## Database

10 migrations in `supabase/migrations/` (01–10), applied in order. `supabase/config.toml` is committed so the CLI behaves identically locally and in CI:

```bash
supabase start           # boots the local stack and applies migrations
supabase db lint         # lints the applied schema (fail on errors)
supabase stop
```

For a remote project:

```bash
supabase link --project-ref <your-ref>
supabase db push
```

### Types

`src/types/database.ts` is the app's **hand-written** interface layer (it mirrors the migrations). The **generated** baseline lives at `supabase/types/database.ts` and is what CI diffs against the schema. Generate it from the **local stack** (matches CI exactly — needs `supabase start` running):

```bash
npm run types:gen         # supabase gen types typescript --local > supabase/types/database.ts
```

Already linked to a remote project? `supabase gen types typescript --linked > supabase/types/database.ts` works too — just note CI checks against `--local`, so prefer the local command for the committed baseline.

### CI

The `db-verify` job in `.github/workflows/ci.yml` starts the local stack (migrations must apply cleanly), runs `supabase db lint --fail-on error`, regenerates types, and fails the build if `supabase/types/database.ts` drifts from the schema — commit a baseline once and drift is enforced on every push/PR.

---

## Deployment

### Supabase

Create a project at [supabase.com](https://supabase.com), apply the migrations, and copy the project URL and anon key.

### Vercel

The repo is Vercel-ready. Push to GitHub, import at vercel.com, and set the environment variables under Project → Settings → Environment Variables.

| Variable | Environments |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Production + Preview + Development |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production + Preview + Development |
| `OPENAI_API_KEY` | Production (Preview optional) |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | Production only |
| `RESEND_API_KEY` / `EMAIL_FROM` | Production |
| `NEXT_PUBLIC_SENTRY_DSN` | Production + Preview |
| `SENTRY_AUTH_TOKEN` | Build-time, Production + Preview |
| `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` | Production only |
| `NEXT_PUBLIC_APP_URL` | Production only — optional; auto-derived from `VERCEL_URL` if not set |

Every push to the production branch deploys. Every PR gets a preview URL.

**Notes:**

- GitHub OAuth only works on production — the preview callback origin won't match. The integration shows as disconnected on previews, nothing breaks.
- `NEXT_PUBLIC_APP_URL` is auto-derived from `VERCEL_URL` on previews. Only set it for a custom domain on production.
- Sentry source-map upload requires `SENTRY_AUTH_TOKEN` as a build-time variable.
- `vercel.json` pins functions to `iad1` (us-east-1), adds security headers (Permissions-Policy keeps `microphone=(self)` so voice notes keep working), and registers a cron at `/api/cron/drain` — set `CRON_SECRET` (any long random string) + `SUPABASE_SERVICE_ROLE_KEY` for it to run.
- The shipped cron schedule is `0 8 * * *` (daily, 08:00 UTC) — the Hobby plan runs at most one cron per day. On Pro you can tighten it (e.g. `*/15 * * * *`) for near-real-time reminders when the app is closed. The client-drain hooks still cover everything while the app is open.

### Optional services

Sentry, Plausible, Resend — create projects, add the keys, redeploy. Each activates only when its variable is present.

---

## Architecture

**RLS everywhere.** Every table scoped by `workspace_id` via `is_workspace_member()`. All server work runs as the signed-in user. No service role key required at runtime.

**Background work is a client-drained queue.** Postgres triggers enqueue durable `jobs` rows. `useAutoIndex` and `useAutoAutomation` hooks drain them on page load and on a visibility-gated interval — through authenticated API routes. No cron, no worker, no separate process.

**AI is a progressive enhancement.** Every AI feature has a local fallback. Semantic search falls back to keyword scoring. The assistant falls back to extractive answers from note text. Transcription falls back to stored audio without a transcript. The app is fully functional without an OpenAI key.

**Supabase is optional.** `src/lib/supabase/config.ts` gates everything. Without credentials you see a setup notice and can still explore the UI.

---

## CI

`.github/workflows/ci.yml` runs lint, typecheck, Vitest, and a production build on every push and PR.

---

## Why open source

Because I would have killed for something like this when I was starting out and drowning in tools. If it helps someone else stop losing their mind, that's enough.

---

## How I'm thinking about this

V1 was never about AI. It was about data.

The whole point of spending months building a notes system, a kanban board, a daily journal, and a resource library — before touching any AI — was to produce *clean, structured, connected data*. Because AI is only as useful as what it has to reason over. If your knowledge base is a pile of unconnected documents in three different apps, no LLM is going to save you.

Every schema decision in this project was made with AI in mind:

- Notes have `embedding` support via pgvector from the start
- Tasks link to notes so the assistant knows what work relates to which thinking
- Daily notes follow a fixed structure so the AI can parse them predictably
- Wikilinks create an explicit knowledge graph the assistant can traverse
- Resources are typed (code, bookmark, paper, architecture) so retrieval can be filtered by kind

The AI layer built on top of this isn't bolted on. It's the reason the foundation was designed the way it was.

V1 is also deliberately single-workspace, single-user. Not because I couldn't build multi-tenant — because I wanted to use this myself, daily, and prove it works before adding the complexity of teams, billing, and permissions. Ship fast, use it, learn, then expand.

---

## What's next

These aren't promises. They're the direction I'm thinking.

**Better AI reasoning**

Right now the assistant does RAG — retrieve chunks, stuff them in a prompt, generate an answer. That's fine. But the real version reasons across the graph. It knows that this task is linked to this note which references this architecture decision which was made because of this tradeoff. It doesn't just find relevant text; it traces reasoning chains. That's what I want to build toward.

**Proactive surfaces**

The workspace should surface things you didn't ask for. "You haven't updated this project in two weeks and it has 3 overdue tasks." "You wrote about this problem in your daily note on Monday — here's what you said." "This note hasn't been touched in 6 months but you linked to it from something you're working on right now." The data is all there. It just needs to be surfaced without being noisy.

**Agent actions**

Right now the assistant answers questions. The next version takes actions. Create a task from the conversation. Update a note. Schedule a recurring reminder. The backend is already there — the automation engine, the job queue, the write APIs. The assistant just needs to be allowed to call them.

**Team workspaces**

The schema is already multi-workspace. Row-level security is already `is_workspace_member()`, not `is_owner()`. Adding teams is a matter of a membership table, invite flows, and permission scoping — none of which requires rearchitecting anything. It's deliberately next, not now.

**Mobile**

Not a native app. A PWA that makes quick capture instant from your phone. The whole point of quick capture is that it has to be *fast*. If it takes 4 taps to get to the input, you'll just text yourself instead. One tap from the home screen, one field, one button.

**Integrations**

GitHub is already there. Calendar export is there. What I actually want: Linear (import issues, sync status), Slack (capture from messages), browser extension (capture from any tab), Raycast extension (capture without opening the app). The workspace is only as useful as how easy it is to get stuff into it.

**The thing I keep thinking about**

There's a version of this where the AI doesn't just answer questions — it starts to understand how *you* think. What kinds of problems you get stuck on. What your project patterns look like. What your daily journal reveals about what's actually draining you versus what energizes you. Not in a creepy way. In the way a really good second brain would — one that's read everything you've written and actually retained it.

That's the long-term bet. The workspace as a memory layer that gets smarter the more you use it. V1 builds the foundation. Everything after is about making that foundation think.
