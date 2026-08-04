"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  Eye,
  Loader2,
  Pencil,
  Pin,
  PinOff,
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
import { KindFields } from "@/components/resource/KindFields";
import { getResourceKindMeta } from "@/lib/resource-kind";
import {
  useDeleteResource,
  useResource,
  useSetResourceTags,
  useUpdateResource,
} from "@/hooks/useResources";
import { useProjects } from "@/hooks/useProjects";
import { useTags } from "@/hooks/useTags";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useDebouncedCallback } from "@/lib/use-debounced-callback";
import { useSyncedState } from "@/lib/use-synced-state";
import { cn } from "@/lib/utils";
import type { ResourceKind } from "@/types/database";

type EditorMode = "edit" | "preview";

export function ResourceDetail({
  resourceId,
  kind,
}: {
  resourceId: string;
  kind: ResourceKind;
}) {
  const meta = getResourceKindMeta(kind);
  const router = useRouter();
  const { data: workspace } = useWorkspace();
  const workspaceId = workspace?.id ?? null;

  const { data: resource, isLoading } = useResource(resourceId);
  const { data: projects } = useProjects(workspaceId);
  const { data: tags } = useTags(workspaceId);
  const updateResource = useUpdateResource(resourceId, workspaceId);
  const setResourceTags = useSetResourceTags(resourceId, workspaceId);
  const deleteResource = useDeleteResource(resourceId, workspaceId);

  const [mode, setMode] = useSyncedState<EditorMode>(
    resource?.body_markdown ? "preview" : "edit"
  );
  const [title, setTitle] = useSyncedState(resource?.title ?? "");
  const [body, setBody] = useSyncedState(resource?.body_markdown ?? "");
  const [metadata, setMetadata] = useSyncedState(resource?.metadata ?? {});
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    if (justSaved) {
      const t = setTimeout(() => setJustSaved(false), 1500);
      return () => clearTimeout(t);
    }
  }, [justSaved]);

  const saveTitle = useDebouncedCallback((value: string) => {
    updateResource.mutate({ title: value }, { onSuccess: () => setJustSaved(true) });
  }, 600);

  const saveBody = useDebouncedCallback((value: string) => {
    updateResource.mutate(
      { body_markdown: value },
      { onSuccess: () => setJustSaved(true), onError: () => toast.error("Failed to save") }
    );
  }, 600);

  const saveMetadata = useDebouncedCallback((value: typeof metadata) => {
    updateResource.mutate(
      { metadata: value },
      { onSuccess: () => setJustSaved(true), onError: () => toast.error("Failed to save") }
    );
  }, 600);

  if (isLoading || !workspace) return <PageLoader label="Loading…" />;

  if (!resource) {
    return (
      <EmptyState
        icon={meta.icon}
        title="Not found"
        description="It may have been deleted or the link is wrong."
      />
    );
  }

  const tagIds = (resource.resource_tags ?? []).map((rt) => rt.tag.id);
  const isSaving = updateResource.isPending;

  const handleDelete = async () => {
    await deleteResource.mutateAsync();
    toast.success("Deleted");
    router.push(`/${meta.path}`);
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-6">
      <div className="mb-4 flex items-center justify-between">
        <Link
          href={`/${meta.path}`}
          className="inline-flex items-center gap-1.5 text-sm text-secondary transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" strokeWidth={1.75} />
          {meta.plural}
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
              updateResource.mutate({ pinned: !resource.pinned }, { onSuccess: () => setJustSaved(true) })
            }
            aria-label={resource.pinned ? "Unpin" : "Pin"}
            title={resource.pinned ? "Unpin" : "Pin"}
            className={cn(resource.pinned && "text-accent")}
          >
            {resource.pinned ? (
              <Pin className="size-4" strokeWidth={1.75} />
            ) : (
              <PinOff className="size-4" strokeWidth={1.75} />
            )}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => void handleDelete()}
            aria-label="Delete"
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
          updateResource.mutate({ title }, { onSuccess: () => setJustSaved(true) })
        }
        placeholder="Untitled"
        aria-label="Title"
        className="mb-4 h-auto border-none bg-transparent px-0 text-2xl font-semibold shadow-none focus-visible:ring-0 focus-visible:border-transparent placeholder:text-faint"
      />

      <div className="mb-4 rounded-lg border border-border-subtle bg-surface p-4">
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-faint uppercase tracking-wide">
          <meta.icon className="size-4" strokeWidth={1.75} />
          {meta.label} fields
        </div>
        <KindFields
          kind={kind}
          metadata={metadata}
          onChange={(patch) => {
            const next = { ...metadata, ...patch };
            setMetadata(next);
            saveMetadata(next);
          }}
        />
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-border-subtle pb-4 text-xs text-faint">
        <Select
          value={resource.project_id ?? "none"}
          onValueChange={(v) =>
            updateResource.mutate({ project_id: v === "none" ? null : v }, { onSuccess: () => setJustSaved(true) })
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
          onChange={(nextIds) => setResourceTags.mutate(nextIds)}
        />

        <span className="ml-auto">
          Updated {new Date(resource.updated_at).toLocaleString()}
        </span>
      </div>

      {mode === "edit" ? (
        <textarea
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            saveBody(e.target.value);
          }}
          onBlur={() =>
            updateResource.mutate(
              { body_markdown: body },
              { onSuccess: () => setJustSaved(true), onError: () => toast.error("Failed to save") }
            )
          }
          placeholder="Write in markdown…"
          aria-label="Body (markdown)"
          className="field-sizing-content min-h-[50vh] w-full resize-y rounded-lg border border-border-subtle bg-transparent px-4 py-3 text-sm leading-relaxed text-foreground outline-none transition-colors duration-150 placeholder:text-faint focus:border-default focus:ring-2 focus:ring-ring/30"
        />
      ) : body.trim() ? (
        <div className="rounded-lg border border-border-subtle bg-surface px-6 py-4">
          <MarkdownRenderer content={body} />
        </div>
      ) : (
        <EmptyState
          icon={meta.icon}
          title="Nothing written yet"
          description="Flip to edit mode and write your first markdown body."
        />
      )}
    </div>
  );
}