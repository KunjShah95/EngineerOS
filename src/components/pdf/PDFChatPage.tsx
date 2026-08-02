"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  Bot,
  FileText,
  Loader2,
  MessageSquare,
  Send,
  Trash2,
  UploadCloud,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shell/EmptyState";
import { PageLoader } from "@/components/shell/PageLoader";
import {
  useDeletePdf,
  usePdfChat,
  usePdfDocuments,
  useUploadPdf,
} from "@/hooks/usePdfChat";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useAiConfig } from "@/hooks/useAiConfig";
import { cn } from "@/lib/utils";

interface Message {
  role: "user" | "assistant";
  content: string;
  local?: boolean;
}

export function PDFChatPage() {
  const { data: workspace, isLoading } = useWorkspace();
  const workspaceId = workspace?.id ?? null;

  const { data: aiConfig } = useAiConfig();
  const { data: documents, isLoading: docsLoading } = usePdfDocuments(workspaceId);
  const uploadPdf = useUploadPdf(workspaceId);
  const deletePdf = useDeletePdf(workspaceId);
  const chat = usePdfChat(null);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const activeDoc = documents?.find((d) => d.id === activeId) ?? null;

  const selectDocument = (id: string) => {
    setActiveId(id);
    setMessages([]);
    chat.reset();
  };

  const uploadFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Please choose a PDF file");
      return;
    }
    try {
      const doc = await uploadPdf.mutateAsync(file);
      setActiveId(doc.id);
      setMessages([]);
      toast.success("PDF uploaded — ask away");
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const send = async () => {
    const q = question.trim();
    if (!q || !activeId || chat.isPending) return;
    setMessages((prev) => [...prev, { role: "user", content: q }]);
    setQuestion("");
    try {
      const answer = await chat.mutateAsync(q);
      setMessages((prev) => [...prev, { role: "assistant", content: answer.answer, local: answer.local }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Failed to answer: ${(err as Error).message}` },
      ]);
    }
  };

  if (isLoading) return <PageLoader label="Loading PDF chat…" />;
  if (!workspace) return null;

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-6">
      <div className="mb-4">
        <h1 className="text-lg font-semibold">PDF chat</h1>
        <p className="text-sm text-faint">
          Upload a paper and ask questions about it.{" "}
          {aiConfig?.configured
            ? "GPT-4o answers from the document."
            : "Local mode — no OPENAI_API_KEY set, so answers quote the closest passage."}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
        {/* Upload + document list */}
        <div className="space-y-3">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const file = e.dataTransfer.files?.[0];
              if (file) void uploadFile(file);
            }}
            onClick={() => inputRef.current?.click()}
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-8 text-center transition-colors",
              dragging ? "border-accent bg-accent-muted/40" : "border-border-default hover:border-accent/50 hover:bg-surface-hover/50"
            )}
          >
            <UploadCloud className="size-6 text-faint" strokeWidth={1.5} />
            <p className="text-sm font-medium text-secondary">
              {uploadPdf.isPending ? "Processing…" : "Drop a PDF here"}
            </p>
            <p className="text-xs text-faint">or click to browse</p>
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void uploadFile(file);
                e.target.value = "";
              }}
            />
          </div>

          {docsLoading ? (
            <p className="flex items-center gap-2 text-sm text-faint">
              <Loader2 className="size-3.5 animate-spin" strokeWidth={1.75} />
              Loading documents…
            </p>
          ) : (
            <ul className="divide-y divide-border-subtle rounded-lg border border-border-subtle">
              {(documents ?? []).map((doc) => (
                <li key={doc.id}>
                  <button
                    type="button"
                    onClick={() => selectDocument(doc.id)}
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-surface-hover",
                      activeId === doc.id && "bg-accent-muted/50"
                    )}
                  >
                    <FileText className="size-4 shrink-0 text-accent" strokeWidth={1.75} />
                    <span className="min-w-0 flex-1 truncate text-sm text-foreground">{doc.title}</span>
                    <span className="shrink-0 font-mono text-[10px] text-faint">
                      {Math.round(doc.char_count / 1000)}k
                    </span>
                  </button>
                </li>
              ))}
              {(documents ?? []).length === 0 && (
                <li className="px-3 py-4 text-center text-sm text-faint">No documents yet</li>
              )}
            </ul>
          )}
        </div>

        {/* Chat panel */}
        <div className="flex min-h-[480px] flex-col rounded-lg border border-default bg-surface">
          {!activeDoc ? (
            <div className="flex flex-1 items-center justify-center p-8">
              <EmptyState
                icon={MessageSquare}
                title="Pick a document"
                description="Upload a PDF on the left, then ask questions about its contents."
              />
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2 border-b border-border-subtle px-4 py-3">
                <p className="flex min-w-0 items-center gap-2 text-sm font-medium text-foreground">
                  <FileText className="size-4 shrink-0 text-accent" strokeWidth={1.75} />
                  <span className="truncate">{activeDoc.title}</span>
                </p>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Delete document"
                  onClick={() => {
                    void deletePdf.mutateAsync({
                      id: activeDoc.id,
                      storagePath: activeDoc.storage_path,
                    });
                    setActiveId(null);
                    setMessages([]);
                  }}
                >
                  <Trash2 className="size-4 text-danger" strokeWidth={1.75} />
                </Button>
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto p-4">
                {messages.length === 0 && (
                  <p className="pt-8 text-center text-sm text-faint">
                    Ask anything about “{activeDoc.title}” — e.g. “What are the key findings?”
                  </p>
                )}
                {messages.map((m, i) => (
                  <div
                    key={i}
                    className={cn(
                      "max-w-[85%] rounded-lg px-4 py-2.5 text-sm leading-relaxed",
                      m.role === "user"
                        ? "ml-auto bg-accent text-accent-foreground"
                        : "mr-auto border border-border-subtle bg-base text-secondary"
                    )}
                  >
                    {m.role === "assistant" && (
                      <p className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold text-faint uppercase">
                        <Bot className="size-3" strokeWidth={1.75} />
                        EngineerOS{m.local ? " · local mode" : ""}
                      </p>
                    )}
                    <p className="whitespace-pre-wrap">{m.content}</p>
                  </div>
                ))}
                {chat.isPending && (
                  <div className="mr-auto flex items-center gap-2 rounded-lg border border-border-subtle bg-base px-4 py-2.5 text-sm text-faint">
                    <Loader2 className="size-3.5 animate-spin" strokeWidth={1.75} />
                    Reading the document…
                  </div>
                )}
              </div>

              <div className="flex gap-2 border-t border-border-subtle p-3">
                <input
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void send();
                  }}
                  placeholder="Ask about this PDF…"
                  className="min-w-0 flex-1 rounded-md border border-border-default bg-base px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-faint focus:border-accent/60 focus:ring-2 focus:ring-ring/30"
                />
                <Button size="icon" onClick={() => void send()} disabled={!question.trim() || chat.isPending} aria-label="Send">
                  <Send className="size-4" strokeWidth={1.75} />
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
