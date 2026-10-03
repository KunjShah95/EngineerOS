"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { CalendarClock, History, Loader2, Plus, RefreshCw, Send, Sparkles, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { MemoryPanel } from "@/components/memory/MemoryPanel";
import { PageLoader } from "@/components/shell/PageLoader";
import { PageHeader } from "@/components/shell/PageHeader";
import {
  useAskAssistant,
  useAskTimeTravel,
  useCreateThread,
  useDeleteThread,
  useIndexWorkspace,
  useThreadMessages,
  useThreads,
} from "@/hooks/useAssistant";
import { SourcesPanel } from "@/components/assistant/SourcesPanel";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useAiConfig } from "@/hooks/useAiConfig";
import { useBackfillNoteVersions } from "@/hooks/useNoteVersions";
import { cn } from "@/lib/utils";
import type { ChatMessage, ChatSource } from "@/types/database";

interface DisplayMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: ChatSource[];
  local?: boolean;
  pending?: boolean;
  strategy?: string;
  asOf?: string;
  unpinned?: { title: string }[];
}

const SUGGESTED_QUESTIONS = [
  "What did I do last week?",
  "Summarize my open tasks",
  "What do my notes say about the auth migration?",
  "Any meetings or decisions I should follow up on?",
];

/** yyyy-mm-dd for a Date, in local time (not UTC — a date picker means the user's day). */
function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Oldest selectable pin: note_versions started after the workspace did. */
function earliestPin(): string {
  return isoDate(new Date(Date.now() - 90 * 24 * 3600 * 1000));
}

const TIME_TRAVEL_QUESTIONS = [
  "What was I planning for this project?",
  "What did I decide about the auth approach?",
  "What were my priorities?",
];

export function AssistantPage() {
  const { data: workspace, isLoading } = useWorkspace();
  const workspaceId = workspace?.id ?? null;

  const { data: aiConfig } = useAiConfig();
  const { data: threads } = useThreads(workspaceId);
  const createThread = useCreateThread(workspaceId);
  const deleteThread = useDeleteThread(workspaceId);
  const ask = useAskAssistant(workspaceId);
  const askPinned = useAskTimeTravel(workspaceId);
  const indexWorkspace = useIndexWorkspace();
  const backfillVersions = useBackfillNoteVersions();

  // Empty string = answer from the live workspace. A date pins the question to
  // the workspace as it existed then.
  const [asOf, setAsOf] = useState("");
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const { data: serverMessages } = useThreadMessages(activeThreadId);
  // Declared before the render-adjust block below, which reads it.
  const isPending = ask.isPending || askPinned.isPending;
  // Optimistic bubbles for the in-flight exchange; derived away once the
  // server copy lands (see render-adjust block below).
  const [optimistic, setOptimistic] = useState<DisplayMessage[]>([]);
  const [question, setQuestion] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  // Monotonic id generator for optimistic bubbles (crypto.randomUUID is fine
  // in event handlers and avoids the purity-rule false positive on Date.now).
  const msgSeq = useRef(0);

  const persisted = useMemo(
    () =>
      (serverMessages ?? []).map<DisplayMessage>((m: ChatMessage) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        sources: m.sources ?? [],
        local: typeof m.model === "string" && m.model.startsWith("local"),
        // A persisted time-travel answer is identifiable from its own sources,
        // so a reloaded thread keeps its pinned-date badge without extra state.
        asOf: m.sources?.find((s) => s.as_of)?.as_of,
      })),
    [serverMessages]
  );

  // Drop optimistic bubbles once their server copies show up — adjust state
  // during render (the React-recommended pattern, no effect cascade). Skipped
  // while a request is in flight so a repeated identical question isn't
  // deduped against older history prematurely.
  if (optimistic.length > 0 && !isPending && serverMessages && serverMessages.length > 0) {
    const serverKeys = new Set(serverMessages.map((m) => `${m.role}:${m.content}`));
    const stillNeeded = optimistic.filter((m) => !m.pending && !serverKeys.has(`${m.role}:${m.content}`));
    if (stillNeeded.length !== optimistic.length) setOptimistic(stillNeeded);
  }

  const messages: DisplayMessage[] = useMemo(
    () => [...persisted, ...optimistic],
    [persisted, optimistic]
  );

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isPending]);

  const newThread = async () => {
    const thread = await createThread.mutateAsync(undefined);
    setActiveThreadId(thread.id);
    setOptimistic([]);
  };

  const selectThread = (id: string) => {
    setActiveThreadId(id);
    setOptimistic([]);
  };

  const removeThread = async (id: string) => {
    await deleteThread.mutateAsync(id);
    if (activeThreadId === id) {
      setActiveThreadId(null);
      setOptimistic([]);
    }
  };

  const nextMsgId = () => `m-${++msgSeq.current}`;

  const send = async (override?: string) => {
    const q = (override ?? question).trim();
    if (!q || isPending) return;
    setQuestion("");
    const userBubble: DisplayMessage = { id: nextMsgId(), role: "user", content: q };
    const pendingBubble: DisplayMessage = { id: nextMsgId(), role: "assistant", content: "", pending: true };
    setOptimistic([userBubble, pendingBubble]);
    try {
      const reply = asOf
        ? await askPinned.mutateAsync({ threadId: activeThreadId, question: q, asOf })
        : await ask.mutateAsync({ threadId: activeThreadId, question: q });
      setActiveThreadId(reply.thread_id);
      setOptimistic([
        userBubble,
        {
          id: nextMsgId(),
          role: "assistant",
          content: reply.answer,
          sources: reply.sources,
          local: reply.local,
          strategy: reply.strategy,
          asOf: reply.as_of,
          unpinned: reply.unpinned,
        },
      ]);
    } catch (err) {
      setOptimistic([userBubble]);
      toast.error((err as Error).message);
    }
  };

  if (isLoading) return <PageLoader label="Loading assistant…" />;
  if (!workspace) return null;

  return (
    <div className="mx-auto flex h-full w-full max-w-6xl flex-col px-6 py-5">
      <PageHeader
        icon={Sparkles}
        title="Assistant"
        className="mb-4"
        description={
          <>
            Ask questions across your notes, tasks, projects, and PDFs.
            {aiConfig?.configured
              ? " Answers cite the sources they came from."
              : " Local mode — no API key set, so answers are extracted from the closest notes with citations."}
          </>
        }
        actions={
          <div className="flex items-center gap-2">
          {/* Always offered (no API key needed): time travel needs history, and
              notes written before versioning started have none. */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              toast.promise(backfillVersions.mutateAsync(), {
                loading: "Seeding note history…",
                success: (r) => {
                  if (r.inserted === 0) return "Every note already has a history snapshot";
                  const backdated = r.backdated > 0 ? `, ${r.backdated} dated to their original creation` : "";
                  return `Snapshotted ${r.inserted} note${r.inserted === 1 ? "" : "s"}${backdated}`;
                },
                error: (err) => (err instanceof Error && err.message ? err.message : "Backfill failed"),
              });
            }}
            disabled={backfillVersions.isPending}
            title="Seed version snapshots so time-travel answers can reach further back"
          >
            <History className={cn("size-3.5", backfillVersions.isPending && "animate-pulse")} strokeWidth={1.75} />
            {backfillVersions.isPending ? "Seeding…" : "Seed history"}
          </Button>
          {aiConfig?.configured && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                toast.promise(indexWorkspace.mutateAsync(), {
                  loading: "Indexing workspace…",
                  success: (r) => {
                    if (r.skipped === "no-key") return "No embedding provider configured";
                    if (r.failed > 0)
                      return `Indexed ${r.indexed} chunk${r.indexed === 1 ? "" : "s"}, ${r.failed} failed${r.error ? `: ${r.error}` : ""}`;
                    return `Indexed ${r.indexed} chunk${r.indexed === 1 ? "" : "s"}`;
                  },
                  error: (err) =>
                    `Indexing failed${err instanceof Error && err.message ? `: ${err.message}` : ""}`,
                });
              }}
              disabled={indexWorkspace.isPending}
            >
              <RefreshCw className={cn("size-3.5", indexWorkspace.isPending && "animate-spin")} strokeWidth={1.75} />
              {indexWorkspace.isPending ? "Indexing…" : "Reindex"}
            </Button>
          )}
          <Button size="sm" onClick={() => void newThread()}>
            <Plus className="size-3.5" strokeWidth={1.75} />
            New chat
          </Button>
          </div>
        }
      />

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[240px_1fr]">
        {/* Thread sidebar */}
        <aside className="panel-inset min-h-0 overflow-y-auto">
          <p className="label-mono border-b border-border-subtle px-3 py-2">threads</p>
          <ul className="divide-y divide-border-subtle">
            {(threads ?? []).map((t) => (
              <li key={t.id} className="group relative flex items-center">
                <button
                  type="button"
                  onClick={() => selectThread(t.id)}
                  aria-current={activeThreadId === t.id ? "true" : undefined}
                  className={cn(
                    "flex min-w-0 flex-1 items-center gap-2 py-2.5 pr-2 pl-3.5 text-left transition-colors hover:bg-surface-hover",
                    activeThreadId === t.id && "bg-surface-hover"
                  )}
                >
                  {/* Active thread marked by a rail, like every other selection
                      in this product — not a filled pill. */}
                  <span
                    aria-hidden
                    className={cn(
                      "absolute inset-y-0 left-0 w-0.5 bg-accent transition-opacity",
                      activeThreadId === t.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="truncate text-sm text-foreground">{t.title}</span>
                </button>
                <button
                  type="button"
                  aria-label="Delete chat"
                  onClick={() => void removeThread(t.id)}
                  className="mr-1 hidden shrink-0 rounded p-1.5 text-faint transition-colors hover:bg-surface-hover hover:text-danger group-hover:block"
                >
                  <Trash2 className="size-3.5" strokeWidth={1.75} />
                </button>
              </li>
            ))}
            {(threads ?? []).length === 0 && (
              <li className="px-3 py-6 text-center text-sm text-faint">No chats yet</li>
            )}
          </ul>
        </aside>

        {/* Chat panel */}
        <div className="flex min-h-[420px] flex-col rounded-lg border border-default bg-surface">
          <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
            {messages.length === 0 ? (
              <div className="flex min-h-full flex-col items-center justify-center gap-6 py-2">
                <div className="w-full max-w-3xl">
                  <MemoryPanel workspaceId={workspace.id} compact />
                </div>
                <div className="flex flex-col items-center gap-3 text-center">
                  {/* Blueprint paper behind the empty state — engineering grid,
                      the same texture the landing hero uses. */}
                  <div
                    aria-hidden
                    className="bg-blueprint pointer-events-none absolute inset-0 -z-10 [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,black,transparent)]"
                  />
                  <p className="label-mono">retrieval-backed answers</p>
                  <h3 className="max-w-md font-serif-display text-[clamp(1.35rem,3vw,1.9rem)] leading-[1.12] font-normal tracking-[-0.015em] text-foreground">
                    Ask anything about your workspace.
                  </h3>
                  <p className="max-w-sm text-sm leading-relaxed text-secondary">
                    Every answer cites the notes it came from — open{" "}
                    <span className="figure-mono text-faint">sources</span> on any reply to see
                    exactly which passage was retrieved and how confident the match was.
                  </p>
                </div>
              </div>
            ) : (
              messages.map((m) => (
                <div key={m.id}>
                  <div
                    className={cn(
                      "max-w-[85%] rounded-lg px-4 py-2.5 text-sm leading-relaxed",
                      m.role === "user"
                        ? "ml-auto bg-accent text-accent-foreground"
                        : "mr-auto border border-border-subtle bg-base text-secondary"
                    )}
                  >
                    {m.role === "assistant" && (
                      <p className="mb-1.5 flex flex-wrap items-center gap-2">
                        <span className="label-mono">assistant</span>
                        {m.local && <span className="label-mono text-[10px]">local mode</span>}
                        {m.asOf && (
                          /* Mint is reserved for historical state, so the pinned
                             badge is the one place it appears in a chat bubble. */
                          <span className="figure-mono inline-flex items-center gap-1 border border-signal/40 bg-signal-muted px-1.5 py-0.5 text-[10px] text-signal">
                            <CalendarClock className="size-3" strokeWidth={1.75} />
                            as of {m.asOf}
                          </span>
                        )}
                      </p>
                    )}
                    {m.pending ? (
                      <span className="flex items-center gap-2 text-faint">
                        <Loader2 className="size-3.5 animate-spin" strokeWidth={1.75} />
                        Thinking…
                      </span>
                    ) : (
                      <p className="whitespace-pre-wrap">{m.content}</p>
                    )}
                  </div>

                  {m.role === "assistant" && m.sources && m.sources.length > 0 && (
                    <SourcesPanel
                      sources={m.sources}
                      strategy={m.strategy}
                      asOf={m.asOf}
                      unpinned={m.unpinned}
                    />
                  )}
                </div>
              ))
            )}
          </div>

          <div className="border-t border-border-subtle p-3">
            {/* Time travel. Note versions make it possible to ask what you believed
                on a past date; the assistant answers from that day's text and flags
                which cited notes have changed since. */}
            <div className="mb-2.5 flex flex-wrap items-center gap-2">
              {/* Time travel reads as a switch on the instrument: off is a quiet
                  mono label, on turns the whole row mint and reveals the dial. */}
              <button
                type="button"
                onClick={() =>
                  setAsOf((v) =>
                    v ? "" : isoDate(new Date(Date.now() - 14 * 24 * 3600 * 1000))
                  )
                }
                aria-pressed={Boolean(asOf)}
                className={cn(
                  "label-mono inline-flex items-center gap-1.5 border px-2 py-1 transition-colors",
                  asOf
                    ? "border-signal/50 bg-signal-muted text-signal"
                    : "border-border-subtle hover:border-border-default hover:text-secondary"
                )}
              >
                <CalendarClock className="size-3" strokeWidth={1.75} />
                {asOf ? "pinned" : "ask as of a date"}
              </button>

              {asOf && (
                <>
                  <label className="sr-only" htmlFor="as-of-date">
                    Answer as of date
                  </label>
                  <input
                    id="as-of-date"
                    type="date"
                    value={asOf}
                    max={isoDate(new Date())}
                    min={earliestPin()}
                    onChange={(e) => setAsOf(e.target.value)}
                    className="figure-mono rounded-md border border-signal/40 bg-base px-2 py-1 text-xs text-foreground outline-none focus:border-signal/60 focus:ring-2 focus:ring-signal/20"
                  />
                  <span className="text-[11px] text-faint">
                    Answered from note versions saved on or before this date.
                  </span>
                </>
              )}
            </div>

            <div className="mb-2.5 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="label-mono mr-1">try asking</span>
              {(asOf ? TIME_TRAVEL_QUESTIONS : SUGGESTED_QUESTIONS).map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => void send(q)}
                  disabled={isPending}
                  className="inline-flex max-w-[260px] items-center gap-1.5 border-b border-transparent pb-px text-xs text-secondary transition-colors hover:border-border-default hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="truncate">{q}</span>
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
                placeholder={
                  asOf ? `Ask what you believed as of ${asOf}…` : "Ask your workspace anything…"
                }
                className="min-w-0 flex-1 rounded-md border border-border-default bg-base px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-faint focus:border-accent/60 focus:ring-2 focus:ring-ring/30"
              />
              <Button size="icon" onClick={() => void send()} disabled={!question.trim() || isPending} aria-label="Send">
                <Send className="size-4" strokeWidth={1.75} />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
