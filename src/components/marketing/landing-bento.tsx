import {
  CalendarDays,
  Check,
  CheckSquare,
  FileText,
  FolderKanban,
  GitBranch,
  Search,
} from "lucide-react";

import {
  SectionIntro,
  SectionShell,
} from "@/components/marketing/landing-primitives";
import { cn } from "@/lib/utils";

function CellHeader({
  title,
  meta,
  children,
}: {
  title: string;
  meta?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="text-[15px] font-semibold tracking-[-0.01em] text-foreground">
          {title}
        </h3>
        {meta ? (
          <span className="figure-mono text-[10px] text-faint">{meta}</span>
        ) : null}
      </div>
      <p className="mt-1.5 max-w-[46ch] text-[13px] leading-relaxed text-secondary">
        {children}
      </p>
    </div>
  );
}

function TaskCard({
  title,
  tag,
  priority,
}: {
  title: string;
  tag?: string;
  priority: string;
}) {
  return (
    <div className="rounded border border-canvas-line bg-canvas-panel p-1.5">
      <div className="flex gap-1.5">
        <span
          aria-hidden
          className={cn("mt-px h-3 w-px shrink-0 rounded-full", priority)}
        />
        <div className="min-w-0">
          <p className="text-[8.5px] leading-[1.45] text-on-canvas">{title}</p>
          {tag ? (
            <span className="mt-1 inline-block rounded-sm bg-white/[0.045] px-1 py-px text-[7px] text-on-canvas-tertiary">
              {tag}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function NoteCell() {
  return (
    <div className="flex h-full flex-col bg-base p-5 md:col-span-7 md:min-h-[366px] md:p-6">
      <CellHeader title="Notes" meta="47">
        Markdown with wikilinks. Every link becomes a backlink, and every
        backlink a way back to the reasoning.
      </CellHeader>

      <div className="mt-5 flex flex-1 flex-col overflow-hidden rounded-md border border-canvas-line bg-canvas">
        <div className="flex items-center gap-2 border-b border-canvas-line px-3 py-2">
          <FileText className="size-3 text-on-canvas-faint" strokeWidth={1.75} />
          <span className="text-[9px] text-on-canvas-tertiary">
            note · 6 min read
          </span>
          <span className="ml-auto text-[9px] text-on-canvas-faint">
            updated 2h ago
          </span>
        </div>

        <div className="grid flex-1 grid-cols-1 sm:grid-cols-[minmax(0,1fr)_158px]">
          <div className="p-4">
            <p className="text-[13px] font-semibold leading-snug tracking-[-0.01em] text-on-canvas">
              Architecture review: queueing
            </p>
            <p className="mt-2 text-[10px] leading-[1.7] text-on-canvas-tertiary">
              The queue started on Redis in January. By March it was the second
              datastore we had to operate, back up, and reason about during an
              incident.
            </p>
            <p className="mt-2 text-[10px] leading-[1.7] text-on-canvas-tertiary">
              No Redis. Postgres holds the queue. Revisit at 10k jobs/day. See{" "}
              <span className="text-canvas-accent underline decoration-canvas-accent/30 underline-offset-2">
                [[ADR-0004]]
              </span>
              .
            </p>

            <div className="mt-3 border-l border-canvas-signal/50 pl-2.5">
              <p className="text-[8px] uppercase tracking-[0.14em] text-canvas-signal">
                Decision
              </p>
              <p className="mt-1 text-[9px] leading-relaxed text-on-canvas-secondary">
                One datastore, transactional enqueue, no worker to operate.
              </p>
            </div>
          </div>

          <div className="hidden border-l border-canvas-line p-3 sm:block">
            <p className="text-[8px] uppercase tracking-[0.14em] text-on-canvas-faint">
              Backlinks
            </p>
            <div className="mt-2 space-y-2">
              {[
                ["Auth middleware", "note"],
                ["Sprint checklist", "task"],
                ["ADR-0004", "decision"],
                ["Load test · 10k", "note"],
              ].map(([label, kind]) => (
                <div key={label}>
                  <p className="text-[9px] leading-tight text-on-canvas-secondary">
                    {label}
                  </p>
                  <p className="mt-0.5 font-mono text-[7px] uppercase tracking-[0.12em] text-on-canvas-faint">
                    {kind}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-3 border-t border-canvas-line pt-2 text-[8px] text-on-canvas-faint">
              +1 more
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function TasksCell() {
  const columns = [
    {
      label: "Todo",
      count: 3,
      cards: [
        { title: "Document drain failure modes", priority: "bg-priority-high", tag: "queue" },
        { title: "Add time-travel eval case", priority: "bg-priority-medium" },
        { title: "Draft billing ADR", priority: "bg-priority-none" },
      ],
    },
    {
      label: "Doing",
      count: 2,
      cards: [
        { title: "Re-run the 10k job benchmark", priority: "bg-priority-urgent", tag: "benchmark" },
        { title: "Retrieval inspector copy", priority: "bg-priority-medium" },
      ],
    },
    {
      label: "Done",
      count: 4,
      cards: [
        { title: "Drop Redis from the stack", priority: "bg-priority-none" },
        { title: "Queue drain on page load", priority: "bg-priority-none" },
      ],
    },
  ];

  return (
    <div className="flex h-full flex-col bg-base p-5 md:col-span-5 md:min-h-[366px] md:p-6">
      <CellHeader title="Tasks" meta="7 open">
        A board that shares the note&rsquo;s project, priority, and due date. No
        second tracker to keep in sync.
      </CellHeader>

      <div className="mt-5 flex flex-1 flex-col rounded-md border border-canvas-line bg-canvas p-2.5">
        <div className="flex items-center justify-between px-1 pb-2">
          <span className="text-[9px] text-on-canvas-tertiary">
            Acme Platform · board
          </span>
          <span className="figure-mono text-[8px] text-on-canvas-faint">
            9 total
          </span>
        </div>

        <div className="grid flex-1 grid-cols-3 gap-1.5">
          {columns.map((column) => (
            <div
              key={column.label}
              className="rounded border border-canvas-line/70 bg-canvas-panel/60 p-1.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-[8px] font-medium text-on-canvas-tertiary">
                  {column.label}
                </span>
                <span className="figure-mono text-[7px] text-on-canvas-faint">
                  {column.count}
                </span>
              </div>
              <div className="mt-1.5 space-y-1.5">
                {column.cards.map((card) => (
                  <TaskCard key={card.title} {...card} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ProjectsCell() {
  return (
    <div className="flex h-full flex-col bg-base p-5 md:col-span-4 md:min-h-[292px] md:p-6">
      <CellHeader title="Projects" meta="3 active">
        The one object every note, task, and decision attaches to. Progress is
        derived, not reported.
      </CellHeader>

      <div className="mt-5 flex flex-1 flex-col rounded-md border border-canvas-line bg-canvas">
        <div className="p-3">
          <div className="flex items-center gap-2">
            <span className="flex size-6 shrink-0 items-center justify-center rounded bg-indigo-500/15 text-[9px] font-medium text-canvas-accent">
              A
            </span>
            <div className="min-w-0">
              <p className="truncate text-[11px] font-medium text-on-canvas">
                Acme Platform
              </p>
              <p className="mt-0.5 text-[8px] text-on-canvas-faint">
                6 notes · 14 tasks · 2 decisions
              </p>
            </div>
            <span className="figure-mono ml-auto text-[9px] text-on-canvas-tertiary">
              3/5
            </span>
          </div>
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/[0.06]">
            <div className="h-full w-[60%] rounded-full bg-canvas-accent-strong" />
          </div>
        </div>

        <div className="mt-auto space-y-1.5 border-t border-canvas-line p-3">
          {[
            { label: "Queue drain", state: "shipped", done: true },
            { label: "Auth boundary", state: "shipped", done: true },
            { label: "Billing", state: "in progress", done: false },
          ].map((milestone) => (
            <div key={milestone.label} className="flex items-center gap-2">
              <span
                className={cn(
                  "flex size-3 items-center justify-center rounded-full border",
                  milestone.done
                    ? "border-canvas-signal/40 bg-canvas-signal/10 text-canvas-signal"
                    : "border-canvas-line text-transparent"
                )}
              >
                <Check className="size-2" strokeWidth={2.5} />
              </span>
              <span className="text-[9px] text-on-canvas-secondary">
                {milestone.label}
              </span>
              <span className="ml-auto text-[8px] text-on-canvas-faint">
                {milestone.state}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DailyCell() {
  const tasks = [
    { label: "Drain queue on page load", done: true },
    { label: "Write up the queueing call", done: false },
    { label: "Review retrieval regression", done: false },
  ];

  return (
    <div className="flex h-full flex-col bg-base p-5 md:col-span-4 md:min-h-[292px] md:p-6">
      <CellHeader title="Daily notes" meta="1 today">
        A page per day that pulls in open tasks and rolls unfinished work
        forward. The journal connects to the work it is about.
      </CellHeader>

      <div className="mt-5 flex flex-1 flex-col rounded-md border border-canvas-line bg-canvas">
        <div className="flex items-center justify-between border-b border-canvas-line px-3 py-2">
          <span className="text-[9px] text-on-canvas-tertiary">
            Thursday, March 12
          </span>
          <span className="flex items-center gap-1 text-[8px] text-canvas-signal">
            <span className="size-1 rounded-full bg-canvas-signal" />2 carried
          </span>
        </div>

        <div className="flex flex-1 flex-col p-3">
          <p className="font-mono text-[7px] uppercase tracking-[0.14em] text-on-canvas-faint">
            Focus
          </p>
          <p className="mt-1 text-[10px] leading-relaxed text-on-canvas-secondary">
            Ship the queue drain, then check the retrieval regression.
          </p>

          <div className="mt-2.5 space-y-1.5">
            {tasks.map((task) => (
              <div key={task.label} className="flex items-center gap-1.5">
                <span
                  className={cn(
                    "flex size-3 shrink-0 items-center justify-center rounded-sm border",
                    task.done
                      ? "border-canvas-signal/40 bg-canvas-signal/10 text-canvas-signal"
                      : "border-canvas-line text-transparent"
                  )}
                >
                  <Check className="size-2" strokeWidth={2.5} />
                </span>
                <span
                  className={cn(
                    "text-[9px]",
                    task.done
                      ? "text-on-canvas-faint line-through"
                      : "text-on-canvas-secondary"
                  )}
                >
                  {task.label}
                </span>
              </div>
            ))}
          </div>

          <p className="mt-auto border-t border-canvas-line pt-2 text-[9px] italic leading-relaxed text-on-canvas-tertiary">
            &ldquo;Two datastores, one incident, one review.&rdquo;
          </p>
        </div>
      </div>
    </div>
  );
}

function DecisionsCell() {
  return (
    <div className="flex h-full flex-col bg-base p-5 md:col-span-4 md:min-h-[292px] md:p-6">
      <CellHeader title="Decisions" meta="12 logged">
        A note with a state. Accepted, superseded, or revisited — with the note
        that replaced it one link away.
      </CellHeader>

      <div className="mt-5 flex flex-1 flex-col rounded-md border border-canvas-line bg-canvas p-3">
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1 rounded bg-canvas-signal/10 px-1.5 py-0.5 text-[8px] text-canvas-signal">
            <span className="size-1 rounded-full bg-canvas-signal" />
            accepted
          </span>
          <span className="figure-mono text-[8px] text-on-canvas-faint">
            ADR-0004
          </span>
        </div>

        <p className="mt-2.5 text-[11px] font-medium leading-snug text-on-canvas">
          Drop Redis for a Postgres job queue
        </p>
        <p className="mt-1.5 text-[9px] leading-relaxed text-on-canvas-tertiary">
          One datastore, transactional enqueue, no worker to operate. Revisit at
          10k jobs/day.
        </p>

        <div className="mt-auto flex items-center gap-1.5 border-t border-canvas-line pt-2 text-[8px] text-on-canvas-faint">
          <GitBranch className="size-2.5" strokeWidth={1.75} />
          supersedes ADR-0002
          <span aria-hidden>·</span>
          3 linked notes
        </div>
      </div>
    </div>
  );
}

function SearchCell() {
  const results = [
    {
      icon: FileText,
      kind: "note",
      title: "Architecture review: queueing",
      snippet: "The queue started on Redis in January…",
      score: 91,
    },
    {
      icon: GitBranch,
      kind: "decision",
      title: "ADR-0004 · drop Redis",
      snippet: "One datastore, transactional enqueue…",
      score: 84,
    },
    {
      icon: CheckSquare,
      kind: "task",
      title: "Re-run the 10k job benchmark",
      snippet: "Blocked on the queue drain landing first.",
      score: 62,
    },
  ];

  return (
    <div className="bg-base p-5 md:col-span-12 md:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <CellHeader title="Search" meta="47 objects indexed">
          One query, every object type. Scores are visible, and the ranking can
          be inspected. Keyword when there is no API key; meaning when there is.
        </CellHeader>
        <p className="shrink-0 text-[11px] text-tertiary">
          The same index the assistant reads.
        </p>
      </div>

      <div className="mt-5 overflow-hidden rounded-md border border-canvas-line bg-canvas">
        <div className="flex items-center gap-2 border-b border-canvas-line px-3 py-2.5">
          <Search className="size-3 text-on-canvas-faint" strokeWidth={1.75} />
          <span className="text-[11px] text-on-canvas-secondary">
            why did we drop redis
          </span>
          <span className="ml-auto flex items-center gap-1.5">
            <span className="rounded border border-canvas-line px-1.5 py-0.5 text-[8px] text-on-canvas-tertiary">
              hybrid
            </span>
            <span className="figure-mono text-[8px] text-on-canvas-faint">
              4.2 ms
            </span>
          </span>
        </div>

        <div className="grid grid-cols-1 divide-y divide-canvas-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {results.map((result) => {
            const Icon = result.icon;
            return (
              <div key={result.title} className="p-3">
                <div className="flex items-center gap-1.5">
                  <Icon
                    className="size-2.5 text-on-canvas-faint"
                    strokeWidth={1.75}
                  />
                  <span className="font-mono text-[7px] uppercase tracking-[0.12em] text-on-canvas-faint">
                    {result.kind}
                  </span>
                  <span className="figure-mono ml-auto text-[8px] text-canvas-signal">
                    {result.score}
                  </span>
                </div>
                <p className="mt-1.5 text-[10px] font-medium text-on-canvas">
                  {result.title}
                </p>
                <p className="mt-1 text-[9px] leading-relaxed text-on-canvas-tertiary">
                  {result.snippet}
                </p>
                <div className="mt-2 h-px overflow-hidden bg-canvas-line">
                  <div
                    className="h-px bg-canvas-accent-strong"
                    style={{ width: `${result.score}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function LandingBento() {
  return (
    <SectionShell id="features">
      <SectionIntro
        title={
          <>
            The data model is{" "}
            <span className="text-secondary">the product.</span>
          </>
        }
        body="Notes, tasks, projects, and daily entries are rows in one schema — not five tools stitched together. The same index answers across all of them, and the same graph links them."
      />

      <div className="mt-12 grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-border-subtle bg-border-subtle md:grid-cols-12">
        <NoteCell />
        <TasksCell />
        <ProjectsCell />
        <DailyCell />
        <DecisionsCell />
        <SearchCell />
      </div>

      <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-tertiary">
        <span className="inline-flex items-center gap-1.5">
          <FolderKanban className="size-3" strokeWidth={1.75} />
          Every object carries a workspace, a project, and an owner.
        </span>
        <span aria-hidden className="text-border-default">
          ·
        </span>
        <span className="inline-flex items-center gap-1.5">
          <CalendarDays className="size-3" strokeWidth={1.75} />
          Synthetic workspace shown.
        </span>
      </p>
    </SectionShell>
  );
}
