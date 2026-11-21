"use client";

import { useId, useRef, useState } from "react";
import {
  CalendarClock,
  ListTree,
  MessageSquareText,
  Plus,
  Sparkles,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

import {
  ArrowLink,
  SectionIntro,
  SectionShell,
} from "@/components/marketing/landing-primitives";
import { cn } from "@/lib/utils";

type TabId = "answer" | "trace" | "asof";

const TABS: {
  id: TabId;
  label: string;
  description: string;
  icon: typeof MessageSquareText;
}[] = [
  {
    id: "answer",
    label: "Answer",
    description: "A grounded reply with numbered sources.",
    icon: MessageSquareText,
  },
  {
    id: "trace",
    label: "Trace",
    description: "The passages, retrievers, and scores behind it.",
    icon: ListTree,
  },
  {
    id: "asof",
    label: "As of",
    description: "What the workspace said on a past date.",
    icon: CalendarClock,
  },
];

function Chrome({
  icon: Icon,
  title,
  right,
}: {
  icon: typeof MessageSquareText;
  title: string;
  right: React.ReactNode;
}) {
  return (
    <div className="flex h-11 items-center gap-2 border-b border-canvas-line bg-canvas-chrome px-4">
      <Icon className="size-3.5 text-canvas-accent-strong" strokeWidth={1.75} />
      <span className="text-[11px] font-medium text-on-canvas">{title}</span>
      <span aria-hidden className="text-on-canvas-faint">
        /
      </span>
      <span className="text-[10px] text-on-canvas-tertiary">Acme Platform</span>
      <div className="ml-auto flex items-center gap-2">{right}</div>
    </div>
  );
}

function Cite({ children }: { children: React.ReactNode }) {
  return (
    <sup className="ml-0.5 font-mono text-[9px] text-canvas-signal">
      {children}
    </sup>
  );
}

function SourceRow({
  index,
  title,
  meta,
  score,
  note,
}: {
  index: number;
  title: string;
  meta: string;
  score: string;
  note?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded border border-canvas-line bg-canvas-panel/50 px-3 py-2">
      <span className="figure-mono flex size-5 shrink-0 items-center justify-center rounded border border-canvas-line text-[8px] text-on-canvas-tertiary">
        {index}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] text-on-canvas">{title}</p>
        <p className="mt-0.5 text-[9px] text-on-canvas-faint">{meta}</p>
      </div>
      {note}
      <span className="figure-mono shrink-0 text-[9px] text-on-canvas-tertiary">
        {score}
      </span>
    </div>
  );
}

function AnswerPanel() {
  return (
    <div className="p-4 md:p-6">
      <div className="ml-auto w-fit max-w-[92%] rounded-md border border-canvas-line bg-white/[0.045] px-3 py-2 text-[11.5px] leading-relaxed text-on-canvas-secondary">
        Why did we drop Redis?
      </div>

      <div className="mt-5 max-w-[62ch]">
        <p className="text-[12.5px] leading-[1.8] text-on-canvas-secondary">
          You dropped Redis in the March architecture review. The queue is a
          Postgres{" "}
          <code className="rounded bg-white/[0.06] px-1 py-0.5 font-mono text-[10.5px] text-on-canvas">
            jobs
          </code>{" "}
          table drained by the signed-in client
          <Cite>1</Cite> — no cron, no separate worker. A second datastore added
          operational cost without improving reliability at your scale
          <Cite>2</Cite>.
        </p>

        <div className="mt-4 space-y-1.5">
          <SourceRow
            index={1}
            title="Architecture review · queueing"
            meta="note · updated Mar 12"
            score="0.91"
          />
          <SourceRow
            index={2}
            title="ADR-0004 · drop Redis"
            meta="decision · accepted Mar 12"
            score="0.84"
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-canvas-line pt-3">
          <span className="inline-flex items-center gap-1.5 rounded border border-canvas-line bg-white/[0.03] px-2.5 py-1.5 text-[10px] text-on-canvas-secondary">
            <Plus className="size-3" strokeWidth={1.75} />
            Create follow-up task
          </span>
          <span className="figure-mono text-[9px] text-on-canvas-faint">
            2 sources · 47 notes scanned
          </span>
        </div>
      </div>
    </div>
  );
}

const TRACE_ROWS = [
  {
    title: "Architecture review: queueing",
    retriever: "keyword + semantic",
    score: 0.91,
    status: "quoted",
  },
  {
    title: "ADR-0004 · drop Redis",
    retriever: "keyword",
    score: 0.84,
    status: "quoted",
  },
  {
    title: "Load test · 10k jobs",
    retriever: "semantic",
    score: 0.71,
    status: "context",
  },
  {
    title: "Sprint checklist",
    retriever: "keyword",
    score: 0.44,
    status: "dropped",
  },
  {
    title: "Billing ADR (draft)",
    retriever: "semantic",
    score: 0.31,
    status: "dropped",
  },
];

function TracePanel() {
  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-canvas-line pb-3">
        <span className="figure-mono text-[9px] text-on-canvas-tertiary">
          query 14 / 20
        </span>
        <span className="text-[9px] text-on-canvas-faint">
          47 chunks scanned
        </span>
        <span className="text-[9px] text-on-canvas-faint">6 kept</span>
        <span className="text-[9px] text-canvas-signal">2 quoted</span>
      </div>

      <div className="mt-3 grid grid-cols-[minmax(0,1fr)_104px] gap-3 px-1 font-mono text-[7px] uppercase tracking-[0.14em] text-on-canvas-faint">
        <span>passage · retriever</span>
        <span className="text-right">relevance</span>
      </div>

      <div className="mt-1">
        {TRACE_ROWS.map((row, index) => (
          <div
            key={row.title}
            className={cn(
              "grid grid-cols-[minmax(0,1fr)_104px] items-center gap-3 border-b border-canvas-line py-2.5",
              index === 0 && "bg-white/[0.02]"
            )}
          >
            <div className="flex min-w-0 items-start gap-2">
              <span className="figure-mono mt-0.5 w-3 shrink-0 text-[8px] text-on-canvas-faint">
                {index + 1}
              </span>
              <div className="min-w-0">
                <p className="truncate text-[11px] text-on-canvas">
                  {row.title}
                </p>
                <p className="mt-0.5 flex items-center gap-1.5 text-[8px] text-on-canvas-faint">
                  <span>{row.retriever}</span>
                  <span aria-hidden>·</span>
                  <span
                    className={cn(
                      row.status === "quoted" && "text-canvas-signal",
                      row.status === "dropped" && "text-on-canvas-faint"
                    )}
                  >
                    {row.status}
                  </span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="h-px flex-1 bg-canvas-line">
                <div
                  className={cn(
                    "h-px",
                    row.status === "dropped"
                      ? "bg-on-canvas-faint"
                      : "bg-canvas-accent-strong"
                  )}
                  style={{ width: `${row.score * 100}%` }}
                />
              </div>
              <span
                className={cn(
                  "figure-mono w-7 text-right text-[9px]",
                  row.status === "dropped"
                    ? "text-on-canvas-faint"
                    : "text-on-canvas-tertiary"
                )}
              >
                {row.score.toFixed(2)}
              </span>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-4 text-[10px] leading-relaxed text-on-canvas-tertiary">
        Dropped rows stay visible. The ranking is reproducible, and the eval
        that sets the floor is checked into the repo.
      </p>
    </div>
  );
}

function AsOfPanel() {
  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-canvas-line pb-3">
        <div>
          <p className="text-[9px] text-on-canvas-tertiary">Question pinned to</p>
          <p className="figure-mono mt-0.5 text-[13px] text-on-canvas">
            2026-03-01
          </p>
        </div>
        <p className="max-w-[24ch] text-right text-[9px] leading-relaxed text-on-canvas-faint">
          Answered from notes as they existed on that date.
        </p>
      </div>

      <div className="relative mt-5">
        <div
          aria-hidden
          className="absolute inset-x-0 top-[5px] h-px bg-canvas-line"
        />
        <div className="relative grid grid-cols-3">
          {[
            { date: "Jan 8", label: "queue added", active: false },
            { date: "Mar 1", label: "pinned", active: true },
            { date: "Mar 12", label: "reversed", active: false },
          ].map((point) => (
            <div
              key={point.date}
              className="flex flex-col items-center gap-1 first:items-start last:items-end"
            >
              <span
                className={cn(
                  "size-2.5 rounded-full border",
                  point.active
                    ? "border-canvas-signal bg-canvas-signal"
                    : "border-canvas-line-strong bg-canvas"
                )}
              />
              <span
                className={cn(
                  "figure-mono text-[8px]",
                  point.active
                    ? "text-canvas-signal"
                    : "text-on-canvas-faint"
                )}
              >
                {point.date}
              </span>
              <span className="text-[8px] text-on-canvas-faint">
                {point.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5">
        <div className="w-fit rounded-md border border-canvas-line bg-white/[0.045] px-3 py-2 text-[11.5px] text-on-canvas-secondary">
          Why did we drop Redis?
        </div>

        <p className="mt-4 max-w-[64ch] text-[12px] leading-[1.8] text-on-canvas-secondary">
          As of March 1, there was no decision. The review still listed Redis as
          the queue and called the second datastore &ldquo;a cost we have not yet
          justified.&rdquo; The call was made on March 12<Cite>1</Cite>.
        </p>

        <div className="mt-4 space-y-1.5">
          <SourceRow
            index={1}
            title="Architecture review · v3"
            meta="as of 2026-03-01"
            score="0.88"
            note={
              <span className="shrink-0 rounded bg-warning/10 px-1.5 py-0.5 text-[8px] text-warning">
                edited Mar 12
              </span>
            }
          />
          <SourceRow
            index={2}
            title="ADR-0002 · Redis queue"
            meta="decision · accepted Jan 8"
            score="0.79"
            note={
              <span className="shrink-0 rounded bg-canvas-signal/10 px-1.5 py-0.5 text-[8px] text-canvas-signal">
                unchanged
              </span>
            }
          />
        </div>

        <p className="mt-4 border-t border-canvas-line pt-3 text-[10px] leading-relaxed text-on-canvas-tertiary">
          1 of 2 sources changed after this date. Today&rsquo;s text is not used.
        </p>
      </div>
    </div>
  );
}

export function LandingAi() {
  const [active, setActive] = useState<TabId>("answer");
  const reduced = useReducedMotion();
  const baseId = useId();
  const tabRefs = useRef<Record<TabId, HTMLButtonElement | null>>({
    answer: null,
    trace: null,
    asof: null,
  });

  const move = (delta: number) => {
    const current = TABS.findIndex((tab) => tab.id === active);
    const next = (current + delta + TABS.length) % TABS.length;
    setActive(TABS[next].id);
    tabRefs.current[TABS[next].id]?.focus();
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      event.preventDefault();
      move(1);
    } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      event.preventDefault();
      move(-1);
    } else if (event.key === "Home") {
      event.preventDefault();
      setActive(TABS[0].id);
      tabRefs.current[TABS[0].id]?.focus();
    } else if (event.key === "End") {
      event.preventDefault();
      const last = TABS[TABS.length - 1].id;
      setActive(last);
      tabRefs.current[last]?.focus();
    }
  };

  const panel =
    active === "answer" ? (
      <AnswerPanel />
    ) : active === "trace" ? (
      <TracePanel />
    ) : (
      <AsOfPanel />
    );

  const chrome =
    active === "answer" ? (
      <Chrome
        icon={Sparkles}
        title="Assistant"
        right={
          <span className="flex items-center gap-1.5 text-[9px] text-canvas-signal">
            <span className="size-1 rounded-full bg-canvas-signal" />
            grounded
          </span>
        }
      />
    ) : active === "trace" ? (
      <Chrome
        icon={ListTree}
        title="Retrieval trace"
        right={
          <span className="figure-mono text-[9px] text-on-canvas-tertiary">
            hybrid · w=0.35
          </span>
        }
      />
    ) : (
      <Chrome
        icon={CalendarClock}
        title="History"
        right={
          <span className="figure-mono text-[9px] text-canvas-signal">
            2026-03-01
          </span>
        }
      />
    );

  return (
    <SectionShell id="ai" className="border-t border-border-subtle">
      <SectionIntro
        title={
          <>
            The answer comes with{" "}
            <em className="font-serif-display font-light italic tracking-[-0.015em]">
              receipts.
            </em>
          </>
        }
        body={
          <>
            Every reply is assembled from your own notes and opens into the
            passages behind it. If retrieval finds nothing, the assistant says
            so instead of guessing.
            <span className="mt-3 block">
              <ArrowLink href="/blog/semantic-search-over-your-own-notes">
                How retrieval is measured
              </ArrowLink>
            </span>
          </>
        }
      />

      <div className="mt-12 grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)] lg:gap-8">
        <div
          role="tablist"
          aria-label="Assistant modes"
          aria-orientation="vertical"
          className="flex flex-col gap-1"
        >
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const selected = active === tab.id;
            return (
              <button
                key={tab.id}
                ref={(node) => {
                  tabRefs.current[tab.id] = node;
                }}
                type="button"
                role="tab"
                id={`${baseId}-tab-${tab.id}`}
                aria-selected={selected}
                aria-controls={`${baseId}-panel`}
                tabIndex={selected ? 0 : -1}
                onClick={() => setActive(tab.id)}
                onKeyDown={onKeyDown}
                className={cn(
                  "relative flex w-full items-start gap-3 rounded-md border px-4 py-3.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                  selected
                    ? "border-border-subtle bg-surface"
                    : "border-transparent hover:bg-surface/60"
                )}
              >
                {selected ? (
                  <span
                    aria-hidden
                    className="absolute inset-y-2 left-0 w-px bg-accent"
                  />
                ) : null}
                <Icon
                  className={cn(
                    "mt-0.5 size-4 shrink-0",
                    selected ? "text-accent" : "text-faint"
                  )}
                  strokeWidth={1.75}
                />
                <span>
                  <span
                    className={cn(
                      "block text-[13px] font-medium",
                      selected ? "text-foreground" : "text-secondary"
                    )}
                  >
                    {tab.label}
                  </span>
                  <span className="mt-0.5 block text-[12px] leading-relaxed text-tertiary">
                    {tab.description}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <div
          role="tabpanel"
          id={`${baseId}-panel`}
          aria-labelledby={`${baseId}-tab-${active}`}
          tabIndex={0}
          className="overflow-hidden rounded-xl border border-canvas-line bg-canvas shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_40px_90px_-50px_rgba(0,0,0,0.9)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          {chrome}
          <motion.div
            key={active}
            initial={reduced ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="min-h-[400px]"
          >
            {panel}
          </motion.div>
        </div>
      </div>

      <p className="mt-4 text-[11px] text-tertiary">
        Illustrative workspace. Answers are synthetic; the retrieval trace, the
        citation model, and the pinned-date behaviour are shipped features.
      </p>
    </SectionShell>
  );
}
