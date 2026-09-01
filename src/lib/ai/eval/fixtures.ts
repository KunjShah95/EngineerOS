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
];
