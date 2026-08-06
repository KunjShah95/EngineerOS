"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check, Code2, Copy, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/shell/PageHeader";
import { EmptyState } from "@/components/shell/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { useWorkspace } from "@/hooks/useWorkspace";
import {
  useSnippets,
  useCreateSnippet,
  useUpdateSnippet,
  useDeleteSnippet,
} from "@/hooks/useSnippets";
import { useDebouncedCallback } from "@/lib/use-debounced-callback";
import { useSyncedState } from "@/lib/use-synced-state";
import { cn } from "@/lib/utils";
import type { Snippet } from "@/types/database";

const LANGUAGES = [
  "plaintext", "javascript", "typescript", "python", "bash", "shell",
  "sql", "json", "yaml", "html", "css", "scss", "rust", "go",
  "java", "c", "cpp", "csharp", "ruby", "php", "swift", "kotlin",
  "markdown", "regex", "dockerfile",
];

export function SnippetsPage() {
  const { data: workspace } = useWorkspace();
  const workspaceId = workspace?.id ?? null;

  const { data: snippets, isLoading } = useSnippets(workspaceId);
  const createSnippet = useCreateSnippet(workspaceId);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = (snippets ?? []).find((s) => s.id === selectedId) ?? null;

  const handleNew = async () => {
    const s = await createSnippet.mutateAsync({});
    setSelectedId(s.id);
    toast.success("Snippet created");
  };

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <aside className="flex w-64 shrink-0 flex-col border-r border-default">
        <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
          <span className="text-sm font-semibold">Snippets</span>
          <Button size="icon" variant="ghost" onClick={() => void handleNew()} disabled={createSnippet.isPending}>
            <Plus className="size-4" strokeWidth={1.75} />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {isLoading ? (
            <div className="space-y-1.5">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}
            </div>
          ) : (snippets ?? []).length === 0 ? (
            <p className="px-2 py-4 text-center text-xs text-faint">No snippets yet.</p>
          ) : (
            <div className="space-y-0.5">
              {(snippets ?? []).map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSelectedId(s.id)}
                  className={cn(
                    "w-full rounded-lg px-3 py-2 text-left text-sm transition-colors duration-150",
                    selectedId === s.id
                      ? "bg-accent-muted/60 text-foreground"
                      : "text-secondary hover:bg-surface-hover hover:text-foreground"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Code2 className="size-3.5 shrink-0 text-secondary" strokeWidth={1.75} />
                    <span className="min-w-0 flex-1 truncate font-medium">{s.title}</span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5 pl-5">
                    <span className="text-[10px] text-faint">{s.language}</span>
                    {s.tags.slice(0, 2).map((t) => (
                      <Badge key={t} variant="outline" className="h-3.5 px-1 text-[9px]">{t}</Badge>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </aside>

      {/* Editor */}
      <div className="flex-1 overflow-y-auto">
        {selected ? (
          <SnippetEditor
            key={selected.id}
            snippet={selected}
            workspaceId={workspaceId}
            onDelete={() => setSelectedId(null)}
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <EmptyState
              icon={Code2}
              title="No snippet selected"
              description="Pick one from the sidebar or create a new snippet."
              actionLabel="New Snippet"
              onAction={() => void handleNew()}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function SnippetEditor({
  snippet,
  workspaceId,
  onDelete,
}: {
  snippet: Snippet;
  workspaceId: string | null;
  onDelete: () => void;
}) {
  const updateSnippet = useUpdateSnippet(workspaceId);
  const deleteSnippet = useDeleteSnippet(workspaceId);
  const [copied, setCopied] = useState(false);

  const [title, setTitle] = useSyncedState(snippet.title);
  const [body, setBody] = useSyncedState(snippet.body);
  const [language, setLanguage] = useSyncedState(snippet.language);
  const [tagsRaw, setTagsRaw] = useSyncedState(snippet.tags.join(", "));

  const save = useDebouncedCallback((patch: Parameters<typeof updateSnippet.mutate>[0]["patch"]) => {
    updateSnippet.mutate({ id: snippet.id, patch });
  }, 600);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(body);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleDelete = async () => {
    await deleteSnippet.mutateAsync(snippet.id);
    toast.success("Snippet deleted");
    onDelete();
  };

  return (
    <div className="mx-auto max-w-3xl p-6 space-y-5">
      <PageHeader
        icon={Code2}
        title=""
        description=""
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => void handleCopy()}>
              {copied ? <Check className="size-4 text-success" strokeWidth={1.75} /> : <Copy className="size-4" strokeWidth={1.75} />}
              {copied ? "Copied!" : "Copy"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-danger hover:bg-danger/10 hover:text-danger"
              onClick={() => void handleDelete()}
            >
              <Trash2 className="size-4" strokeWidth={1.75} />
              Delete
            </Button>
          </div>
        }
      />

      <div className="space-y-1.5">
        <Label htmlFor="snippet-title">Title</Label>
        <Input
          id="snippet-title"
          value={title}
          onChange={(e) => { setTitle(e.target.value); save({ title: e.target.value }); }}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Language</Label>
          <Select
            value={language}
            onValueChange={(v) => { setLanguage(v); save({ language: v }); }}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map((l) => (
                <SelectItem key={l} value={l}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="snippet-tags">Tags (comma-separated)</Label>
          <Input
            id="snippet-tags"
            value={tagsRaw}
            onChange={(e) => {
              setTagsRaw(e.target.value);
              save({ tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) });
            }}
            placeholder="react, hooks, utility…"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="snippet-body">Code</Label>
        <textarea
          id="snippet-body"
          value={body}
          onChange={(e) => { setBody(e.target.value); save({ body: e.target.value }); }}
          spellCheck={false}
          rows={20}
          className="field-sizing-content min-h-[300px] w-full resize-y rounded-lg border border-border-subtle bg-base px-4 py-3 font-mono text-sm leading-relaxed text-foreground outline-none placeholder:text-faint focus:border-default focus:ring-2 focus:ring-ring/30"
          placeholder="Paste or type your snippet here…"
        />
      </div>
    </div>
  );
}
