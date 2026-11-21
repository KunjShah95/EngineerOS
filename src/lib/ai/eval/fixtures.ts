/**
 * Evaluation corpus and question set for retrieval.
 *
 * This is a fixed, in-repo workspace so retrieval quality is measurable
 * without a live database or an embedding API key. The questions are written
 * the way people actually search — partial recall, wrong vocabulary, and the
 * occasional exact token — rather than as restatements of the note titles,
 * which would make the eval trivially easy and therefore useless.
 */

export interface EvalDoc {
  id: string;
  title: string;
  text: string;
  /** Outgoing wikilink edges to other doc ids (knowledge-graph adjacency). */
  links?: string[];
}

export interface EvalQuery {
  question: string;
  /** Doc ids that genuinely answer the question. */
  relevant: string[];
  /**
   * What this question is testing:
   *  - "paraphrase": no keyword overlap, requires semantic matching
   *  - "exact": an error code or identifier, requires keyword matching
   *  - "mixed": both signals present
   */
  kind: "paraphrase" | "exact" | "mixed";
}

export const EVAL_DOCS: EvalDoc[] = [
  {
    id: "auth-supabase",
    title: "Supabase auth setup",
    text: `## Session handling
We use Supabase SSR with cookie-based sessions. The middleware refreshes the
session on every request so server components always see a valid user.

## Why not NextAuth
NextAuth would mean a second source of truth for identity. Supabase already
owns the user table and row-level security keys off auth.uid(), so adding
NextAuth meant syncing two systems for no benefit.`,
    links: ["jwt-refresh", "rls-policies"],
  },
  {
    id: "jwt-refresh",
    title: "JWT refresh flow",
    text: `## The problem
Access tokens expire after one hour. A user who leaves a tab open overnight
comes back to a dead session and a confusing redirect to the login screen.

## How the refresh works
The client holds a refresh token in an httpOnly cookie. On a 401 the client
swaps the refresh token for a new access token and replays the request once.
If the replay also fails we clear the session and send the user to /login.

## Failure mode we hit
Two concurrent requests both got a 401 and both tried to refresh. The second
refresh invalidated the first token. We now serialize refreshes through a
single in-flight promise.`,
    links: ["auth-supabase", "embedding-errors"],
  },
  {
    id: "pgvector-choice",
    title: "Why pgvector over a dedicated vector DB",
    text: `## Decision
Use pgvector in the existing Postgres instance rather than Pinecone or Weaviate.

## Reasoning
We are already running Postgres for everything else. A second datastore means
a second thing to back up, monitor, and keep in sync with the notes table.
At our scale — tens of thousands of chunks, not billions — an HNSW index over
a vector column is comfortably fast enough. Recall would improve marginally
with a dedicated engine, and operational cost would roughly double.

## When to revisit
If chunk count passes a few million, or if we need filtered vector search that
Postgres cannot plan well.`,
    links: ["embedding-errors", "rls-policies"],
  },
  {
    id: "rls-policies",
    title: "Row level security policies",
    text: `## Workspace isolation
Every table carries workspace_id. Policies check that workspace_id belongs to
a workspace the current auth.uid() is a member of. There is no service-role
path in the request handlers — everything goes through the user's own client
so RLS actually applies.

## Testing
The policy tests create two workspaces and assert that a member of one cannot
read, update, or delete rows in the other.`,
    links: ["auth-supabase", "pgvector-choice"],
  },
  {
    id: "kanban-dnd",
    title: "Kanban drag and drop",
    text: `## Position storage
Cards store a fractional position float rather than a dense integer index.
Dropping between two cards averages their positions, so a move writes one row
instead of renumbering the whole column.

## Rebalancing
Repeated inserts in the same gap shrink the float until precision runs out.
When the gap between neighbours falls below an epsilon we renumber the column
in a single transaction.`,
  },
  {
    id: "embedding-errors",
    title: "Embedding indexing failures",
    text: `## ERR_EMBED_DIM_MISMATCH
Raised when a provider returns a vector whose length is not 1536. Gemini
returns 768 and Mistral 1024, so we pad to the column width. Padding preserves
cosine ordering within one provider but vectors from different providers are
not comparable.

## Rate limits
Providers return 429 under bursts. We retry three times with exponential
backoff starting at 400ms, and cap concurrency at six embeds per batch.`,
    links: ["pgvector-choice", "embedding-cost"],
  },
  {
    id: "daily-rollover",
    title: "Daily note rollover",
    text: `## Behaviour
Unfinished tasks from yesterday appear in today's note automatically. The
rollover runs on first visit rather than on a cron, so a user who skips three
days sees one consolidated carry-forward instead of three empty notes.

## Timezone handling
Dates are stored as plain dates, not timestamps. Storing a timestamp meant a
user in UTC+5:30 creating a note at 1am got yesterday's date.`,
  },
  {
    id: "graph-layout",
    title: "Knowledge graph layout",
    text: `## Force simulation
Nodes are notes and tasks; edges are wikilinks and task-note links. We run a
force-directed simulation for a fixed number of ticks then freeze, rather than
animating continuously, because a permanently drifting graph is unusable.

## Orphans
Notes with no links cluster in a corner. We surface an orphan count so the
user can see what is disconnected from everything else.`,
    links: ["wikilinks", "graph-filtering"],
  },

  /* ---- Distractors ----
   * Topically adjacent documents that must NOT outrank the true answer.
   * Without these the eval saturates: with only one auth note in the corpus,
   * any ranker that knows "auth" scores perfectly. Real workspaces have a
   * dozen notes about auth, and picking the right one is the actual task. */
  {
    id: "auth-oauth-providers",
    title: "OAuth provider setup",
    text: `## Providers
Google and GitHub OAuth are configured in the Supabase dashboard. Redirect
URLs must be registered per environment or the callback fails silently.

## Scopes
We request email and profile only. Requesting repo scope on GitHub scared
users off during the first beta.`,
  },
  {
    id: "auth-password-reset",
    title: "Password reset emails",
    text: `## Flow
The reset link is a one-time token valid for one hour. Clicking it signs the
user in with a recovery session that can only change the password.

## Deliverability
Reset mail was landing in spam until we set up SPF and DKIM on the sending
domain.`,
  },
  {
    id: "session-storage",
    title: "Client session storage",
    text: `## What we store
Only a session pointer. Notes and tasks are never cached in localStorage
because the workspace may contain sensitive material on a shared machine.

## Sign out
Sign out clears the cookie server-side as well as the client cache, so a back
button press cannot resurrect the session.`,
  },
  {
    id: "vector-index-tuning",
    title: "HNSW index tuning",
    text: `## Parameters
m controls graph connectivity and ef_construction controls build-time search
breadth. Higher values improve recall and cost build time and memory.

## What we set
Defaults were adequate. We raised ef_search at query time instead, which
trades a little latency for noticeably better recall on short queries.`,
  },
  {
    id: "embedding-cost",
    title: "Embedding cost tracking",
    text: `## Per-workspace spend
Every embed call records token count and provider. A workspace re-indexing
from scratch costs roughly one cent per thousand chunks at current pricing.

## Avoiding waste
We only re-embed on content change, not on every save, because autosave fires
every few seconds while typing.`,
  },
  {
    id: "task-recurrence",
    title: "Recurring task rules",
    text: `## Cadence
Rules support daily, weekly, and monthly. The next instance is created when
the current one is completed, not on a schedule, so a paused habit does not
generate a backlog of missed instances.

## Editing
Editing a rule affects future instances only. Past completions are history
and stay as they were.`,
  },
  {
    id: "calendar-timed-tasks",
    title: "Timed tasks on the calendar",
    text: `## Blocks
A task with a start and end time renders as a resizable block on the day grid.
Dragging the bottom edge changes the end time in fifteen minute steps.

## Local time
Times are stored with the user's offset preserved so a block created at 2pm
still reads 2pm after travel.`,
  },
  {
    id: "search-palette",
    title: "Command palette",
    text: `## Shortcut
Cmd K opens the palette from anywhere. It searches notes, tasks, projects, and
tags in one list rather than separate tabs.

## Ranking
Recently opened items get a small boost so the thing you were just looking at
is near the top.`,
  },
  {
    id: "wikilinks",
    title: "Wikilink parsing",
    text: `## Syntax
Double bracket syntax links to a note by title. Unresolved links render in a
muted style and offer to create the note.

## Backlinks
Every note shows what links to it. The backlink list is computed from the same
parse that builds the graph edges.`,
  },
  {
    id: "pdf-extraction",
    title: "PDF text extraction",
    text: `## Pipeline
Uploaded PDFs are parsed to plain text and stored alongside the file. Scanned
documents without a text layer produce nothing and we tell the user rather
than silently indexing an empty string.

## Size cap
We truncate extracted text at twelve thousand characters for indexing. Longer
documents are still readable in full, just not fully embedded.`,
  },
  {
    id: "github-sync",
    title: "GitHub issue sync",
    text: `## Direction
One way, GitHub to EngineerOS. Issues become tasks. We do not write back
because bidirectional sync without a conflict model creates duplicates.

## Rate limits
The API allows five thousand requests an hour authenticated. We poll on an
interval and back off on 403.`,
  },
  {
    id: "postgres-backups",
    title: "Backup and restore",
    text: `## Schedule
Supabase takes daily automated backups on paid plans. For self-hosted setups
pg_dump on a cron into object storage is enough.

## Restore drill
An untested backup is not a backup. We restore into a scratch project
quarterly and check row counts against production.`,
  },
  {
    id: "note-versions",
    title: "Note version history",
    text: `## Snapshots
A version is written when a note has been idle for thirty seconds after an
edit, not on every keystroke, to keep the history readable.

## Diffing
Versions are diffed as markdown at the line level so a formatting-only change
does not look like a rewrite.`,
  },
  {
    id: "graph-filtering",
    title: "Filtering the knowledge graph",
    text: `## By project
Selecting a project dims everything not connected to it rather than removing
nodes, so you keep a sense of where the subgraph sits in the whole.

## Performance
Above about two thousand nodes we stop rendering labels until zoomed in.`,
  },
];

export const EVAL_QUERIES: EvalQuery[] = [
  // Paraphrase: the words in the question do not appear in the target doc.
  { question: "how do users sign in", relevant: ["auth-supabase", "jwt-refresh"], kind: "paraphrase" },
  { question: "what happens when a session dies overnight", relevant: ["jwt-refresh"], kind: "paraphrase" },
  { question: "can one customer read another customer's data", relevant: ["rls-policies"], kind: "paraphrase" },
  { question: "why did we not use pinecone", relevant: ["pgvector-choice"], kind: "mixed" },
  { question: "how are cards reordered on the board", relevant: ["kanban-dnd"], kind: "paraphrase" },
  { question: "what carries over between days", relevant: ["daily-rollover"], kind: "paraphrase" },
  { question: "why is my note dated yesterday", relevant: ["daily-rollover"], kind: "paraphrase" },
  { question: "notes connected to nothing", relevant: ["graph-layout"], kind: "paraphrase" },

  // Exact: identifiers and error strings that embeddings handle poorly.
  { question: "ERR_EMBED_DIM_MISMATCH", relevant: ["embedding-errors"], kind: "exact" },
  { question: "auth.uid()", relevant: ["rls-policies", "auth-supabase"], kind: "exact" },
  { question: "HNSW index", relevant: ["pgvector-choice"], kind: "exact" },
  { question: "429 rate limit retry", relevant: ["embedding-errors"], kind: "exact" },
  { question: "httpOnly cookie", relevant: ["jwt-refresh"], kind: "exact" },

  // Mixed: some literal overlap plus a conceptual component.
  { question: "why fractional position instead of an integer", relevant: ["kanban-dnd"], kind: "mixed" },
  { question: "supabase SSR middleware session refresh", relevant: ["auth-supabase"], kind: "mixed" },
  { question: "vector dimension padding across providers", relevant: ["embedding-errors"], kind: "mixed" },
  { question: "workspace_id isolation testing", relevant: ["rls-policies"], kind: "mixed" },
  { question: "force directed simulation ticks", relevant: ["graph-layout"], kind: "mixed" },
  { question: "when should we move off postgres for vectors", relevant: ["pgvector-choice"], kind: "mixed" },
  { question: "concurrent refresh invalidated the token", relevant: ["jwt-refresh"], kind: "mixed" },

  // Graph / multi-hop: answer lives in a note reached via a wikilink, not by
  // direct keyword overlap with the question.
  { question: "which note about auth connects to row level security", relevant: ["auth-supabase", "rls-policies"], kind: "paraphrase" },
  { question: "what does the auth note connect to for data isolation", relevant: ["auth-supabase", "rls-policies"], kind: "paraphrase" },
  { question: "which storage decision references embedding failures", relevant: ["pgvector-choice", "embedding-errors"], kind: "paraphrase" },
  { question: "what graph notes are connected to wikilink parsing", relevant: ["graph-layout", "wikilinks", "graph-filtering"], kind: "paraphrase" },
  { question: "orphan notes and how to filter the graph", relevant: ["graph-layout", "graph-filtering"], kind: "mixed" },
  { question: "embedding cost and how failures are retried", relevant: ["embedding-cost", "embedding-errors"], kind: "mixed" },

  // Expanded set — paraphrase variants
  { question: "how does a user stay logged in across requests", relevant: ["auth-supabase"], kind: "paraphrase" },
  { question: "refresh token rotation race condition", relevant: ["jwt-refresh"], kind: "exact" },
  { question: "tenant data isolation", relevant: ["rls-policies"], kind: "paraphrase" },
  { question: "why postgres instead of pinecone", relevant: ["pgvector-choice"], kind: "paraphrase" },
  { question: "fractional indexing for kanban", relevant: ["kanban-dnd"], kind: "mixed" },
  { question: "unfinished tasks next day", relevant: ["daily-rollover"], kind: "paraphrase" },
  { question: "force directed graph freeze", relevant: ["graph-layout"], kind: "mixed" },
  { question: "ERR_EMBED_DIM_MISMATCH padding", relevant: ["embedding-errors"], kind: "exact" },
  { question: "auth.uid() membership check", relevant: ["rls-policies", "auth-supabase"], kind: "exact" },
  { question: "HNSW ef_search recall", relevant: ["pgvector-choice", "vector-index-tuning"], kind: "mixed" },
  { question: "429 retry backoff", relevant: ["embedding-errors"], kind: "exact" },
  { question: "httpOnly refresh cookie", relevant: ["jwt-refresh"], kind: "exact" },
  { question: "why not NextAuth", relevant: ["auth-supabase"], kind: "mixed" },
  { question: "cards reordered by averaging positions", relevant: ["kanban-dnd"], kind: "paraphrase" },
  { question: "rebalance float precision", relevant: ["kanban-dnd"], kind: "mixed" },
  { question: "timezone date storage", relevant: ["daily-rollover"], kind: "paraphrase" },
  { question: "orphan notes count", relevant: ["graph-layout"], kind: "paraphrase" },
  { question: "embedding provider dimensions", relevant: ["embedding-errors"], kind: "mixed" },
  { question: "concurrency embed cap", relevant: ["embedding-errors"], kind: "mixed" },
  { question: "workspace member policy test", relevant: ["rls-policies"], kind: "mixed" },
  { question: "no service role in handlers", relevant: ["rls-policies"], kind: "paraphrase" },
  { question: "pgvector HNSW index", relevant: ["pgvector-choice", "vector-index-tuning"], kind: "mixed" },
  { question: "when to revisit vector db choice", relevant: ["pgvector-choice"], kind: "paraphrase" },
  { question: "supabase SSR cookie session", relevant: ["auth-supabase"], kind: "mixed" },
  { question: "overnight dead session redirect", relevant: ["jwt-refresh"], kind: "paraphrase" },
  { question: "replay request after 401", relevant: ["jwt-refresh"], kind: "mixed" },
  { question: "serialize refresh promise", relevant: ["jwt-refresh"], kind: "mixed" },
  { question: "second datastore operational cost", relevant: ["pgvector-choice"], kind: "paraphrase" },
  { question: "chunk count millions", relevant: ["pgvector-choice"], kind: "paraphrase" },
  { question: "filtered vector search postgres", relevant: ["pgvector-choice"], kind: "paraphrase" },
  { question: "gemini 768 mistral 1024 padding", relevant: ["embedding-errors"], kind: "mixed" },
  { question: "cosine ordering within provider", relevant: ["embedding-errors", "pgvector-choice"], kind: "mixed" },
  { question: "unfinished tasks carry forward", relevant: ["daily-rollover"], kind: "paraphrase" },
  { question: "consolidated carry forward skipped days", relevant: ["daily-rollover"], kind: "paraphrase" },
  { question: "plain dates not timestamps", relevant: ["daily-rollover"], kind: "mixed" },
  { question: "UTC offset note date", relevant: ["daily-rollover"], kind: "paraphrase" },
  { question: "force simulation ticks freeze", relevant: ["graph-layout"], kind: "mixed" },
  { question: "nodes notes tasks edges", relevant: ["graph-layout", "wikilinks"], kind: "mixed" },
  { question: "backlinks computed from parse", relevant: ["wikilinks"], kind: "mixed" },
  { question: "unresolved links create note", relevant: ["wikilinks"], kind: "paraphrase" },
  { question: "double bracket syntax", relevant: ["wikilinks"], kind: "mixed" },
  { question: "command palette shortcut", relevant: ["search-palette"], kind: "mixed" },
  { question: "recently opened boost", relevant: ["search-palette"], kind: "paraphrase" },
  { question: "pdf text extraction pipeline", relevant: ["pdf-extraction"], kind: "mixed" },
  { question: "scanned document empty", relevant: ["pdf-extraction"], kind: "paraphrase" },
  { question: "truncate extracted text cap", relevant: ["pdf-extraction"], kind: "mixed" },
  { question: "github issue sync direction", relevant: ["github-sync"], kind: "mixed" },
  { question: "bidirectional sync duplicates", relevant: ["github-sync"], kind: "paraphrase" },
  { question: "api rate limit backoff", relevant: ["github-sync", "embedding-errors"], kind: "mixed" },
  { question: "backup restore drill", relevant: ["postgres-backups"], kind: "mixed" },
  { question: "pg_dump cron object storage", relevant: ["postgres-backups"], kind: "mixed" },
  { question: "note version snapshot idle", relevant: ["note-versions"], kind: "mixed" },
  { question: "line level diff markdown", relevant: ["note-versions"], kind: "mixed" },
  { question: "filter graph by project", relevant: ["graph-filtering"], kind: "mixed" },
  { question: "dim not remove nodes", relevant: ["graph-filtering"], kind: "paraphrase" },
  { question: "labels above two thousand nodes", relevant: ["graph-filtering"], kind: "mixed" },
  { question: "recurring task cadence", relevant: ["task-recurrence"], kind: "mixed" },
  { question: "next instance on completion", relevant: ["task-recurrence"], kind: "paraphrase" },
  { question: "editing rule future instances", relevant: ["task-recurrence"], kind: "mixed" },
  { question: "timed task calendar block", relevant: ["calendar-timed-tasks"], kind: "mixed" },
  { question: "fifteen minute resize", relevant: ["calendar-timed-tasks"], kind: "mixed" },
  { question: "local time offset preserved", relevant: ["calendar-timed-tasks"], kind: "paraphrase" },
  { question: "OAuth provider redirect urls", relevant: ["auth-oauth-providers"], kind: "mixed" },
  { question: "request email profile only", relevant: ["auth-oauth-providers"], kind: "paraphrase" },
  { question: "password reset one time token", relevant: ["auth-password-reset"], kind: "mixed" },
  { question: "SPF DKIM deliverability", relevant: ["auth-password-reset"], kind: "mixed" },
  { question: "session storage localStorage", relevant: ["session-storage"], kind: "mixed" },
  { question: "sign out clears cookie", relevant: ["session-storage"], kind: "mixed" },
  { question: "HNSW m ef_construction", relevant: ["vector-index-tuning"], kind: "mixed" },
  { question: "raise ef_search query time", relevant: ["vector-index-tuning"], kind: "mixed" },
  { question: "embedding cost per workspace", relevant: ["embedding-cost"], kind: "mixed" },
  { question: "re-embed on content change", relevant: ["embedding-cost"], kind: "mixed" },
  { question: "how much does reindex cost", relevant: ["embedding-cost"], kind: "paraphrase" },
  { question: "client session storage sensitive", relevant: ["session-storage"], kind: "paraphrase" },
  { question: "supabase daily backups", relevant: ["postgres-backups"], kind: "mixed" },
  { question: "self hosted pg_dump", relevant: ["postgres-backups"], kind: "mixed" },
  { question: "version written after idle", relevant: ["note-versions"], kind: "mixed" },
  { question: "formatting only change diff", relevant: ["note-versions"], kind: "paraphrase" },
];

