"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, FileText, FolderKanban, Hash, CheckSquare, Loader2, Sparkles } from "lucide-react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { SemanticSearchGroup } from "@/components/search/SemanticSearchGroup";
import { useSearch } from "@/hooks/useSearch";
import { useSemanticSearch, type KeywordCorpusItem } from "@/hooks/useSemanticSearch";
import { useUiStore } from "@/lib/store/ui";
import { cn } from "@/lib/utils";

export function CommandPalette({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const open = useUiStore((s) => s.commandPaletteOpen);
  const setOpen = useUiStore((s) => s.setCommandPaletteOpen);
  const [query, setQuery] = useState("");
  const [semantic, setSemantic] = useState(false);

  // Debounce the query at 200ms so the "within 300ms perceived latency"
  // budget from UI_DEVELOPMENT_PLAN.md holds while typing.
  const [debouncedQuery, setDebouncedQuery] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 200);
    return () => clearTimeout(t);
  }, [query]);

  // Reset the query + semantic toggle each time the palette opens, using the
  // React-recommended "adjust state during render" pattern (no effect, no ref).
  const [wasOpen, setWasOpen] = useState(open);
  if (open && !wasOpen) {
    setWasOpen(true);
    setQuery("");
    setSemantic(false);
  } else if (!open && wasOpen) {
    setWasOpen(false);
  }

  const { data, isFetching } = useSearch(workspaceId, debouncedQuery);

  // Local corpus for the keyword fallback — reuse the same cached substring
  // results so Semantic stays functional without a live Supabase or API key.
  const corpus = useMemo<KeywordCorpusItem[]>(() => {
    if (!data) return [];
    const items: KeywordCorpusItem[] = [];
    for (const n of data.notes) {
      items.push({ entity_type: "note", entity_id: n.id, title: n.title, text: n.body_markdown });
    }
    for (const t of data.tasks) {
      items.push({ entity_type: "task", entity_id: t.id, title: t.title, text: t.description ?? "" });
    }
    return items;
  }, [data]);

  const semanticSearch = useSemanticSearch(semantic && debouncedQuery ? debouncedQuery : "", corpus);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(!open);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, setOpen]);

  const goto = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  const groupCount = useMemo(
    () =>
      (data?.notes.length ?? 0) +
      (data?.tasks.length ?? 0) +
      (data?.projects.length ?? 0) +
      (data?.tags.length ?? 0),
    [data]
  );

  const semanticCount = semantic ? semanticSearch.chunks.length : 0;
  const hasAnyResults = groupCount > 0 || semanticCount > 0;

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <div className="flex items-center gap-2 border-b border-default px-4 py-1.5">
        <button
          type="button"
          aria-pressed={semantic}
          onClick={() => setSemantic((v) => !v)}
          className={cn(
            "flex items-center gap-1.5 text-xs font-medium transition-colors",
            semantic ? "text-accent" : "text-faint hover:text-secondary"
          )}
        >
          <Sparkles className="size-3.5" strokeWidth={1.75} />
          Semantic
        </button>
        {semantic && semanticSearch.isPending && debouncedQuery.trim() !== "" && (
          <Loader2 className="size-3 animate-spin text-faint" strokeWidth={1.75} />
        )}
        {semantic && !semanticSearch.isPending && semanticSearch.chunks.length > 0 && (
          <span className="text-[10px] text-faint">
            {semanticSearch.mode === "embeddings" ? "vector" : "local"} · {semanticSearch.chunks.length}
          </span>
        )}
        {semantic && !semanticSearch.isPending && debouncedQuery.trim() !== "" && semanticSearch.chunks.length === 0 && (
          <span className="text-[10px] text-faint">no semantic matches</span>
        )}
      </div>
      <CommandInput
        placeholder="Search notes, tasks, projects, tags…"
        value={query}
        onValueChange={setQuery}
        autoFocus
      />
      <CommandList>
        {debouncedQuery.trim() === "" ? (
          <CommandEmpty>Type to search across your workspace.</CommandEmpty>
        ) : isFetching && !hasAnyResults ? (
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-secondary">
            <Loader2 className="size-4 animate-spin" strokeWidth={1.75} />
            Searching…
          </div>
        ) : !hasAnyResults ? (
          <CommandEmpty>No results for “{debouncedQuery}”.</CommandEmpty>
        ) : (
          <>
            {semantic && semanticSearch.chunks.length > 0 && (
              <SemanticSearchGroup
                chunks={semanticSearch.chunks}
                mode={semanticSearch.mode}
                onSelect={goto}
              />
            )}

            {data && data.notes.length > 0 && (
              <CommandGroup heading="Notes">
                {data.notes.map((note) => (
                  <CommandItem key={note.id} value={`note:${note.title}`} onSelect={() => goto(`/notes/${note.id}`)}>
                    <FileText className="size-4 text-secondary" strokeWidth={1.75} />
                    <span className="line-clamp-1">{note.title}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {data && data.tasks.length > 0 && (
              <CommandGroup heading="Tasks">
                {data.tasks.map((task) => (
                  <CommandItem key={task.id} value={`task:${task.title}`} onSelect={() => goto(`/tasks?task=${task.id}`)}>
                    <CheckSquare className="size-4 text-secondary" strokeWidth={1.75} />
                    <span className="line-clamp-1">{task.title}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {data && data.projects.length > 0 && (
              <CommandGroup heading="Projects">
                {data.projects.map((project) => (
                  <CommandItem key={project.id} value={`project:${project.name}`} onSelect={() => goto(`/projects/${project.id}`)}>
                    <FolderKanban className="size-4 text-secondary" strokeWidth={1.75} />
                    <span className="line-clamp-1">{project.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {data && data.tags.length > 0 && (
              <CommandGroup heading="Tags">
                {data.tags.map((tag) => (
                  <CommandItem key={tag.id} value={`tag:${tag.name}`} onSelect={() => goto(`/notes?tag=${tag.name}`)}>
                    <Hash className="size-4 text-secondary" strokeWidth={1.75} />
                    <span className="line-clamp-1">#{tag.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            <CommandGroup heading="Go to">
              <CommandItem onSelect={() => goto("/dashboard")}>
                <CalendarDays className={cn("size-4 text-secondary")} strokeWidth={1.75} />
                Dashboard
              </CommandItem>
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
