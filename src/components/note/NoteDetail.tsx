"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  Download,
  Eye,
  FileText,
  History,
  Loader2,
  Pencil,
  Pin,
  PinOff,
  RefreshCw,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageLoader } from "@/components/shell/PageLoader";
import { EmptyState } from "@/components/shell/EmptyState";
import { MarkdownRenderer } from "@/components/note/MarkdownRenderer";
import { TagInput } from "@/components/note/TagInput";
import { useDeleteNote, useNote, useSetNoteTags, useUpdateNote } from "@/hooks/useNotes";
import { useProjects } from "@/hooks/useProjects";
import { useTags } from "@/hooks/useTags";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useDebouncedCallback } from "@/lib/use-debounced-callback";
import { useSyncedState } from "@/lib/use-synced-state";
import { cn, slugify } from "@/lib/utils";
import { useAiSummary, useGenerateSummary } from "@/hooks/useAiSummary";
import { useNoteVersions, useSaveNoteVersion } from "@/hooks/useNoteVersions";
import { VoiceRecorder } from "@/components/voice/VoiceRecorder";
import { VoiceNotesList } from "@/components/voice/VoiceNotesList";
import { BacklinksPanel } from "@/components/graph/BacklinksPanel";
import { useKnowledgeGraph } from "@/hooks/useKnowledgeGraph";
import { NoteAttachments } from "@/components/note/NoteAttachments";
import { VersionTimeline } from "@/components/note/VersionTimeline";
import {
  SlashCommandMenu,
  buildSlashRows,
  filterSlashCommands,
  type SlashCommand,
} from "@/components/note/SlashCommandMenu";

type EditorMode = "edit" | "preview";

export function NoteDetail({ noteId }: { noteId: string }) {
  const router = useRouter();
  const { data: workspace } = useWorkspace();
  const workspaceId = workspace?.id ?? null;

  const { data: note, isLoading } = useNote(noteId);
  // Title index for [[wikilinks]] in the rendered preview.
  const { data: graph } = useKnowledgeGraph(workspaceId);

  // Case-insensitive title → href lookup for wikilink rendering. Notes win
  // collisions (build order matches the knowledge graph's own index).
  const resolveWikilink = useMemo(() => {
    const byTitle = new Map<string, string>();
    for (const n of graph?.nodes ?? []) {
      const key = n.label.trim().toLowerCase();
      if (key && !byTitle.has(key)) byTitle.set(key, n.href);
    }
    return (title: string) => byTitle.get(title.trim().toLowerCase()) ?? null;
  }, [graph]);
  const { data: projects } = useProjects(workspaceId);
  const { data: tags } = useTags(workspaceId);
  const updateNote = useUpdateNote(noteId, workspaceId);
  const setNoteTags = useSetNoteTags(noteId, workspaceId);
  const deleteNote = useDeleteNote(noteId, workspaceId);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [slash, setSlash] = useState<{
    index: number;
    query: string;
    top: number;
    left: number;
  } | null>(null);
  const [slashHighlight, setSlashHighlight] = useState(0);

  const [mode, setMode] = useSyncedState<EditorMode>(
    note?.body_markdown ? "preview" : "edit"
  );
  const [title, setTitle] = useSyncedState(note?.title ?? "");
  const [body, setBody] = useSyncedState(note?.body_markdown ?? "");
  const [justSaved, setJustSaved] = useState(false);
  const [summaryExpanded, setSummaryExpanded] = useState(false);
  const [showVersions, setShowVersions] = useState(false);

  const { data: versions } = useNoteVersions(noteId);
  const saveVersion = useSaveNoteVersion(noteId, workspaceId);

  const tocItems = useMemo(() => {
    const regex = /^(#{1,4})\s+(.+)$/gm;
    const items: { level: number; text: string; slug: string }[] = [];
    let match;
    while ((match = regex.exec(body)) !== null) {
      const text = match[2].trim();
      items.push({ level: match[1].length, text, slug: slugify(text) });
    }
    return items;
  }, [body]);
  const showToc = tocItems.length >= 2;

  useEffect(() => {
    if (justSaved) {
      const t = setTimeout(() => setJustSaved(false), 1500);
      return () => clearTimeout(t);
    }
  }, [justSaved]);

  const saveTitle = useDebouncedCallback((value: string) => {
    updateNote.mutate({ title: value }, { onSuccess: () => setJustSaved(true) });
  }, 600);

  const saveBody = useDebouncedCallback((value: string) => {
    updateNote.mutate(
      { body_markdown: value },
      { onSuccess: () => setJustSaved(true), onError: () => toast.error("Failed to save note") }
    );
  }, 600);

  const { data: aiSummary } = useAiSummary(workspaceId, "note", noteId);
  const generateSummary = useGenerateSummary(workspaceId, "note", noteId);

  if (isLoading || !workspace) return <PageLoader label="Loading note…" />;

  if (!note) {
    return (
      <EmptyState
        icon={FileText}
        title="Note not found"
        description="It may have been deleted or the link is wrong."
      />
    );
  }

  const tagIds = (note.note_tags ?? []).map((nt) => nt.tag.id);
  const isSaving = updateNote.isPending;

  const handleDelete = async () => {
    await deleteNote.mutateAsync();
    toast.success("Note deleted");
    router.push("/notes");
  };

  // ---- Slash commands (type "/" at the start of a line) ----
  const applySlashCommand = (cmd: SlashCommand) => {
    if (!slash) return;
    const before = body.slice(0, slash.index);
    const after = body.slice(slash.index + 1 + slash.query.length);
    const next = before + cmd.template + after;
    setBody(next);
    saveBody(next);
    const caret = Math.max(0, Math.min(next.length, before.length + cmd.template.length + (cmd.caretOffset ?? 0)));
    requestAnimationFrame(() => {
      const ta = textareaRef.current;
      if (ta) {
        ta.focus();
        ta.setSelectionRange(caret, caret);
      }
    });
    setSlash(null);
    setSlashHighlight(0);
  };

  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const ta = e.currentTarget;

    // Open the menu when "/" is typed at the start of a line.
    if (!slash) {
      if (e.key === "/") {
        const caret = ta.selectionStart ?? 0;
        const before = ta.value.slice(0, caret);
        const lineStart = before.lastIndexOf("\n") + 1;
        if (before.slice(lineStart).trim() === "") {
          const pos = getCaretCoordinates(ta, caret);
          setSlash({ index: caret, query: "", top: pos.top, left: pos.left });
          // Start the highlight on the first actual command (row 0 is a group header).
          const first = buildSlashRows(filterSlashCommands("")).findIndex(
            (r) => r.type === "command"
          );
          setSlashHighlight(first === -1 ? 0 : first);
        }
      }
      return;
    }

    const rows = buildSlashRows(filterSlashCommands(slash.query));
    const commandRows = rows
      .map((r, i) => (r.type === "command" ? i : -1))
      .filter((i) => i >= 0);

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSlashHighlight((h) => {
          const idx = commandRows.indexOf(h);
          return idx === -1 ? commandRows[0] : commandRows[(idx + 1) % commandRows.length];
        });
        break;
      case "ArrowUp":
        e.preventDefault();
        setSlashHighlight((h) => {
          const idx = commandRows.indexOf(h);
          return idx === -1
            ? commandRows[commandRows.length - 1]
            : commandRows[(idx - 1 + commandRows.length) % commandRows.length];
        });
        break;
      case "Enter":
      case "Tab": {
        e.preventDefault();
        const row = rows[slashHighlight];
        if (row?.type === "command") applySlashCommand(row.command);
        break;
      }
      case "Escape":
        e.preventDefault();
        setSlash(null);
        break;
      case "Backspace":
        if (slash.query === "") {
          e.preventDefault();
          setSlash(null);
        }
        break;
      default:
        break;
    }
  };

  return (
    <div className={cn("mx-auto w-full px-6 py-6", showToc ? "max-w-5xl" : "max-w-3xl")}>
      <div className={cn(showToc && "flex gap-8 items-start")}>
      <div className={cn(showToc ? "flex-1 min-w-0 max-w-3xl" : "w-full")}>
      <div className="mb-4 flex items-center justify-between">
        <Link
          href="/notes"
          className="inline-flex items-center gap-1.5 text-sm text-secondary transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" strokeWidth={1.75} />
          Notes
        </Link>

        <div className="flex items-center gap-1">
          <span className="mr-1 inline-flex items-center gap-1.5 text-xs text-faint">
            {isSaving || justSaved ? (
              <>
                {isSaving ? (
                  <Loader2 className="size-3 animate-spin" strokeWidth={1.75} />
                ) : (
                  <Check className="size-3 text-success" strokeWidth={1.75} />
                )}
                {isSaving ? "Saving…" : "Saved"}
              </>
            ) : null}
          </span>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMode(mode === "edit" ? "preview" : "edit")}
            aria-label={mode === "edit" ? "Preview rendered markdown" : "Edit markdown"}
          >
            {mode === "edit" ? (
              <Eye className="size-4" strokeWidth={1.75} />
            ) : (
              <Pencil className="size-4" strokeWidth={1.75} />
            )}
            {mode === "edit" ? "Preview" : "Edit"}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() =>
              updateNote.mutate({ pinned: !note.pinned }, { onSuccess: () => setJustSaved(true) })
            }
            aria-label={note.pinned ? "Unpin note" : "Pin note"}
            title={note.pinned ? "Unpin" : "Pin"}
            className={cn(note.pinned && "text-accent")}
          >
            {note.pinned ? (
              <Pin className="size-4" strokeWidth={1.75} />
            ) : (
              <PinOff className="size-4" strokeWidth={1.75} />
            )}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              const blob = new Blob([`# ${note.title}\n\n${note.body_markdown}`], { type: "text/markdown" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `${note.title.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.md`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            aria-label="Export as markdown"
            title="Export .md"
          >
            <Download className="size-4" strokeWidth={1.75} />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              await saveVersion.mutateAsync({ title, body_markdown: body });
              toast.success("Version saved");
            }}
            disabled={saveVersion.isPending}
            title="Save version"
          >
            <History className="size-4" strokeWidth={1.75} />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowVersions((v) => !v)}
            title="Version history"
            className={cn(showVersions && "text-accent")}
          >
            {showVersions ? <ChevronDown className="size-4" strokeWidth={1.75} /> : <ChevronRight className="size-4" strokeWidth={1.75} />}
            History
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => void handleDelete()}
            aria-label="Delete note"
            className="text-danger hover:bg-danger/10 hover:text-danger"
          >
            <Trash2 className="size-4" strokeWidth={1.75} />
          </Button>
        </div>
      </div>

      <Input
        value={title}
        onChange={(e) => {
          setTitle(e.target.value);
          saveTitle(e.target.value);
        }}
        onBlur={() =>
          updateNote.mutate({ title }, { onSuccess: () => setJustSaved(true) })
        }
        placeholder="Untitled"
        aria-label="Note title"
        className="mb-4 h-auto border-none bg-transparent px-0 text-2xl font-semibold shadow-none focus-visible:ring-0 focus-visible:border-transparent placeholder:text-faint"
      />

      <div className="mb-6 flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-border-subtle pb-4 text-xs text-faint">
        <Select
          value={note.project_id ?? "none"}
          onValueChange={(v) =>
            updateNote.mutate({ project_id: v === "none" ? null : v }, { onSuccess: () => setJustSaved(true) })
          }
        >
          <SelectTrigger size="sm" className="h-7 text-xs" aria-label="Project">
            <SelectValue placeholder="No project" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No project</SelectItem>
            {(projects ?? []).map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <TagInput
          workspaceId={workspace.id}
          tagIds={tagIds}
          allTags={tags ?? []}
          onChange={(nextIds) => setNoteTags.mutate(nextIds)}
        />

        <span className="ml-auto">
          Updated {new Date(note.updated_at).toLocaleString()}
        </span>
      </div>

      {/* AI summary + voice notes live under the editor */}
      <div className="mb-6 space-y-4">
        {(aiSummary || summaryExpanded) && (
          <div className="rounded-lg border border-border-subtle bg-surface p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-accent uppercase">
                <Sparkles className="size-3.5" strokeWidth={1.75} />
                AI summary
              </p>
              <span className="font-mono text-[10px] text-faint">
                {aiSummary?.model === "local-extractive" ? "local mode" : aiSummary?.model ?? ""}
              </span>
            </div>
            {generateSummary.isPending && !aiSummary ? (
              <p className="flex items-center gap-2 text-sm text-faint">
                <Loader2 className="size-3.5 animate-spin" strokeWidth={1.75} />
                Summarizing…
              </p>
            ) : (
              <p className="text-sm leading-relaxed text-secondary">
                {aiSummary?.summary ?? generateSummary.data?.summary ?? ""}
              </p>
            )}
            <button
              type="button"
              onClick={() => generateSummary.mutate()}
              disabled={generateSummary.isPending}
              className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-accent transition-colors hover:text-accent-hover disabled:opacity-50"
            >
              <RefreshCw className="size-3" strokeWidth={1.75} />
              {aiSummary ? "Regenerate" : "Generate"}
            </button>
          </div>
        )}

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSummaryExpanded(true)}
            disabled={summaryExpanded || Boolean(aiSummary)}
          >
            <Sparkles className="size-3.5" strokeWidth={1.75} />
            Summarize with AI
          </Button>
          <VoiceRecorder workspaceId={workspace.id} noteId={noteId} compact />
        </div>

        <VoiceNotesList workspaceId={workspace.id} noteId={noteId} />
      </div>

      {/* Phase 9 — backlinks + wikilink graph panel */}
      <div className="mb-6">
        <BacklinksPanel noteId={noteId} />
      </div>

      {/* Sprint 2 — file attachments */}
      <div className="mb-6">
        <NoteAttachments noteId={note.id} workspaceId={workspace.id} />
      </div>

      {/* Version history — timeline + visual diff */}
      {showVersions && (
        <div className="mb-6">
          <VersionTimeline
            versions={versions ?? []}
            currentTitle={title}
            currentBody={body}
            onRestore={(v) => {
              setBody(v.body_markdown);
              setTitle(v.title);
              updateNote.mutate(
                { title: v.title, body_markdown: v.body_markdown },
                { onSuccess: () => toast.success("Version restored") }
              );
            }}
          />
        </div>
      )}

      {mode === "edit" ? (
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={body}
            onChange={(e) => {
              const value = e.target.value;
              setBody(value);
              saveBody(value);
              // Keep the slash query in sync with what was typed after "/".
              setSlash((prev) => {
                if (!prev) return prev;
                const caret = e.target.selectionStart ?? value.length;
                const query = value.slice(prev.index + 1, caret);
                if (query.includes("\n") || value[prev.index] !== "/") return null;
                return { ...prev, query };
              });
            }}
            onKeyDown={handleEditorKeyDown}
            onBlur={() => {
              setSlash(null);
              updateNote.mutate(
                { body_markdown: body },
                { onSuccess: () => setJustSaved(true), onError: () => toast.error("Failed to save note") }
              );
            }}
            placeholder={"Write in markdown… (type \"/\" for commands)"}
            aria-label="Note body (markdown)"
            className="field-sizing-content min-h-[50vh] w-full resize-y rounded-lg border border-border-subtle bg-transparent px-4 py-3 text-[15px] leading-7 text-foreground outline-none transition-colors duration-150 placeholder:text-faint focus:border-default focus:ring-2 focus:ring-ring/30"
          />
          {slash && (
            <SlashCommandMenu
              rows={buildSlashRows(filterSlashCommands(slash.query))}
              highlightIndex={slashHighlight}
              top={slash.top}
              left={slash.left}
              onMouseEnter={setSlashHighlight}
              onSelect={applySlashCommand}
            />
          )}
        </div>
      ) : body.trim() ? (
        <div className="rounded-lg border border-border-subtle bg-surface px-6 py-5">
          <MarkdownRenderer content={body} resolveWikilink={resolveWikilink} />
        </div>
      ) : (
        <EmptyState
          icon={FileText}
          title="Nothing written yet"
          description="Flip to edit mode and write your first markdown note."
        />
      )}
      </div>
      {showToc && (
        <aside className="hidden xl:block w-44 shrink-0 sticky top-6 self-start">
          <p className="mb-2 text-[11px] font-semibold tracking-wide text-faint uppercase">On this page</p>
          <nav className="space-y-0.5">
            {tocItems.map((item, i) => (
              <button
                key={i}
                type="button"
                onClick={() =>
                  document.getElementById(item.slug)?.scrollIntoView({ behavior: "smooth", block: "start" })
                }
                className={cn(
                  "block w-full text-left text-xs leading-5 text-secondary transition-colors hover:text-foreground truncate",
                  item.level === 1 && "font-semibold",
                  item.level === 3 && "pl-3",
                  item.level === 4 && "pl-6",
                )}
              >
                {item.text}
              </button>
            ))}
          </nav>
        </aside>
      )}
      </div>
    </div>
  );
}

/**
 * Measure the caret position inside a textarea using a hidden mirror node that
 * replicates its font/padding/width. Returns coordinates relative to the
 * textarea's top-left, used to anchor the slash-command menu.
 */
function getCaretCoordinates(
  textarea: HTMLTextAreaElement,
  index: number
): { top: number; left: number } {
  const cs = getComputedStyle(textarea);
  const mirror = document.createElement("div");
  mirror.style.cssText = [
    "position:absolute",
    "visibility:hidden",
    "white-space:pre-wrap",
    "word-wrap:break-word",
    `font:${cs.font}`,
    `padding-top:${cs.paddingTop}`,
    `padding-bottom:${cs.paddingBottom}`,
    `padding-left:${cs.paddingLeft}`,
    `padding-right:${cs.paddingRight}`,
    `border-top-width:${cs.borderTopWidth}`,
    `border-bottom-width:${cs.borderBottomWidth}`,
    `box-sizing:${cs.boxSizing}`,
    `width:${textarea.clientWidth}px`,
  ].join(";");
  const span = document.createElement("span");
  span.textContent = textarea.value.slice(0, index);
  mirror.appendChild(span);
  document.body.appendChild(mirror);
  const rect = span.getBoundingClientRect();
  document.body.removeChild(mirror);
  const taRect = textarea.getBoundingClientRect();
  return { top: rect.bottom - taRect.top, left: rect.left - taRect.left };
}
