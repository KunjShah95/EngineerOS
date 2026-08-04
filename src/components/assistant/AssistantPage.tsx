"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Bot, FileText, Loader2, MessageSquareText, Plus, RefreshCw, Send, Sparkles, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shell/EmptyState";
import { PageLoader } from "@/components/shell/PageLoader";
import { PageHeader } from "@/components/shell/PageHeader";
import {
  useAskAssistant,
  useCreateThread,
  useDeleteThread,
  useIndexWorkspace,
  useThreadMessages,
  useThreads,
} from "@/hooks/useAssistant";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useAiConfig } from "@/hooks/useAiConfig";
import { cn } from "@/lib/utils";
import type { ChatMessage, ChatSource } from "@/types/database";

interface DisplayMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: ChatSource[];
  local?: boolean;
  pending?: boolean;
}

const SUGGESTED_QUESTIONS = [
  "What did I do last week?",
  "Summarize my open tasks",
  "What do my notes say about the auth migration?",
  "Any meetings or decisions I should follow up on?",
];

export function AssistantPage() {
  const { data: workspace, isLoading } = useWorkspace();
  const workspaceId = workspace?.id ?? null;

  const { data: aiConfig } = useAiConfig();
  const { data: threads } = useThreads(workspaceId);
  const createThread = useCreateThread(workspaceId);
  const deleteThread = useDeleteThread(workspaceId);
  const ask = useAskAssistant(workspaceId);
  const indexWorkspace = useIndexWorkspace();

  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const { data: serverMessages } = useThreadMessages(activeThreadId);
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
      })),
    [serverMessages]
  );

  // Drop optimistic bubbles once their server copies show up — adjust state
  // during render (the React-recommended pattern, no effect cascade). Skipped
  // while a request is in flight so a repeated identical question isn't
  // deduped against older history prematurely.
  if (optimistic.length > 0 && !ask.isPending && serverMessages && serverMessages.length > 0) {
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
  }, [messages, ask.isPending]);

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
    if (!q || ask.isPending) return;
    setQuestion("");
    const userBubble: DisplayMessage = { id: nextMsgId(), role: "user", content: q };
    const pendingBubble: DisplayMessage = { id: nextMsgId(), role: "assistant", content: "", pending: true };
    setOptimistic([userBubble, pendingBubble]);
    try {
      const reply = await ask.mutateAsync({ threadId: activeThreadId, question: q });
      setActiveThreadId(reply.thread_id);
      setOptimistic([
        userBubble,
        {
          id: nextMsgId(),
          role: "assistant",
          content: reply.answer,
          sources: reply.sources,
          local: reply.local,
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
        <aside className="min-h-0 overflow-y-auto rounded-lg border border-border-subtle bg-surface/40">
          <ul className="divide-y divide-border-subtle">
            {(threads ?? []).map((t) => (
              <li key={t.id} className="group flex items-center">
                <button
                  type="button"
                  onClick={() => selectThread(t.id)}
                  className={cn(
                    "flex min-w-0 flex-1 items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-surface-hover",
                    activeThreadId === t.id && "bg-accent-muted/50"
                  )}
                >
                  <MessageSquareText className="size-3.5 shrink-0 text-faint" strokeWidth={1.75} />
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
              <div className="flex h-full items-center justify-center">
                <EmptyState
                  icon={Bot}
                  title="Ask anything about your workspace"
                  description="Try “What did I work on last week?”, “Summarize my open tasks”, or “What do my notes say about the auth migration?”"
                />
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
                      <p className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold text-faint uppercase">
                        <Sparkles className="size-3" strokeWidth={1.75} />
                        Assistant{m.local ? " · local mode" : ""}
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
                    <div className="mr-auto mt-1 flex max-w-[85%] flex-wrap gap-1.5 pl-1">
                      {m.sources.slice(0, 5).map((s, i) => (
                        <Link
                          key={`${s.entity_id}-${i}`}
                          href={s.href}
                          className="inline-flex items-center gap-1 rounded-full border border-border-subtle bg-elevated px-2 py-0.5 text-[11px] text-secondary transition-colors hover:border-accent/50 hover:text-foreground"
                        >
                          <FileText className="size-3 text-faint" strokeWidth={1.75} />
                          <span className="max-w-[140px] truncate">{s.title}</span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          <div className="border-t border-border-subtle p-3">
            <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-[11px] font-medium text-faint uppercase">Try asking</span>
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => void send(q)}
                  disabled={ask.isPending}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-elevated px-2.5 py-1 text-xs text-secondary transition-colors hover:border-accent/50 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Sparkles className="size-3 text-faint" strokeWidth={1.75} />
                  <span className="max-w-[220px] truncate">{q}</span>
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
                placeholder="Ask your workspace anything…"
                className="min-w-0 flex-1 rounded-md border border-border-default bg-base px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-faint focus:border-accent/60 focus:ring-2 focus:ring-ring/30"
              />
              <Button size="icon" onClick={() => void send()} disabled={!question.trim() || ask.isPending} aria-label="Send">
                <Send className="size-4" strokeWidth={1.75} />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
