"use client";

import { useMemo, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Pin, Plus } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/shell/EmptyState";
import { useCreateResource, useResources } from "@/hooks/useResources";
import { useProjects } from "@/hooks/useProjects";
import { useWorkspace } from "@/hooks/useWorkspace";
import { getResourceKindMeta, READING_STATUS_LABELS } from "@/lib/resource-kind";
import { projectColorStyle } from "@/lib/project-colors";
import { cn } from "@/lib/utils";
import type { ResourceKind, ResourceWithRelations } from "@/types/database";

function snippet(body: string): string {
  return body
    .replace(/[#*`>_~\[\]()!-]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 140);
}

export function ResourceList({
  kind,
  icon,
  title,
  emptyDescription,
}: {
  kind: ResourceKind;
  icon: typeof Pin;
  title: string;
  emptyDescription: string;
}) {
  const meta = getResourceKindMeta(kind);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: workspace } = useWorkspace();
  const workspaceId = workspace?.id ?? null;

  const { data: projects } = useProjects(workspaceId);
  const projectFilter = searchParams.get("project") ?? "all";

  const { data: resources, isLoading } = useResources(
    workspaceId,
    kind,
    projectFilter === "all" ? null : { projectId: projectFilter }
  );

  const createResource = useCreateResource(workspaceId, kind);

  const filtered = useMemo(() => resources ?? [], [resources]);

  const setProject = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") params.delete("project");
    else params.set("project", value);
    router.replace(`/${kind}?${params.toString()}`);
  };

  const newResource = async () => {
    const resource = await createResource.mutateAsync({});
    router.push(`/${kind}/${resource.id}`);
  };

  const EmptyIcon = icon;

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold">{title}</h1>
          <p className="text-sm text-secondary">
            {filtered.length} {filtered.length === 1 ? "item" : "items"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Select value={projectFilter} onValueChange={setProject}>
            <SelectTrigger size="sm" aria-label="Filter by project" className="min-w-36">
              <SelectValue placeholder="All projects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All projects</SelectItem>
              {(projects ?? []).map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button size="sm" onClick={() => void newResource()} disabled={createResource.isPending}>
            <Plus className="size-4" strokeWidth={1.75} />
            New
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={EmptyIcon}
          title={projectFilter !== "all" ? "No matching items" : `No ${meta.plural.toLowerCase()} yet`}
          description={
            projectFilter !== "all"
              ? "Try clearing the filter, or create a new item."
              : emptyDescription
          }
          actionLabel={projectFilter !== "all" ? undefined : "New"}
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((resource) => (
            <ResourceRow key={resource.id} kind={kind} resource={resource} />
          ))}
        </div>
      )}
    </div>
  );
}

function ResourceRow({ kind, resource }: { kind: ResourceKind; resource: ResourceWithRelations }) {
  const tagsList = resource.resource_tags.map((rt) => rt.tag);
  const m = resource.metadata;

  return (
    <Link
      href={`/${kind}/${resource.id}`}
      className={cn(
        "group flex items-start justify-between gap-4 rounded-lg border border-default bg-surface p-4 transition-colors duration-150",
        "hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {resource.pinned ? (
            <Pin className="size-3.5 shrink-0 text-accent" strokeWidth={1.75} />
          ) : null}
          <h3 className="truncate text-sm font-medium text-foreground">{resource.title}</h3>
        </div>

        {snippet(resource.body_markdown) ? (
          <p className="mt-1 line-clamp-2 text-sm text-secondary">{snippet(resource.body_markdown)}</p>
        ) : m.language || m.url ? null : (
          <p className="mt-1 text-sm text-faint">No content yet.</p>
        )}

        <ResourceChips resource={resource} />

        {(resource.project || tagsList.length > 0) && (
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            {resource.project ? (
              <span className="inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 text-[11px] font-medium text-secondary">
                <span
                  className="size-2 rounded-full"
                  style={projectColorStyle(resource.project.color)}
                  aria-hidden
                />
                {resource.project.name}
              </span>
            ) : null}
            {tagsList.map((tag) => (
              <span
                key={tag.id}
                className="rounded px-1.5 py-0.5 text-[11px] font-medium text-accent"
                style={tag.color ? { backgroundColor: tag.color, color: "#fff" } : undefined}
              >
                #{tag.name}
              </span>
            ))}
          </div>
        )}
      </div>

      <span className="shrink-0 text-xs text-faint">
        {formatDistanceToNow(new Date(resource.updated_at), { addSuffix: true })}
      </span>
    </Link>
  );
}

function ResourceChips({ resource }: { resource: ResourceWithRelations }) {
  const m = resource.metadata;
  const chips: ReactNode[] = [];

  if (m.url) {
    chips.push(
      <a
        key="url"
        href={m.url}
        target="_blank"
        rel="noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="rounded px-1.5 py-0.5 text-[11px] font-medium text-accent underline-offset-2 hover:underline"
      >
        ↗ {m.url}
      </a>
    );
  }
  if (m.language) {
    chips.push(
      <span key="lang" className="rounded px-1.5 py-0.5 text-[11px] font-medium text-secondary">
        {m.language}
      </span>
    );
  }
  if (m.read_status) {
    chips.push(
      <span key="status" className="rounded px-1.5 py-0.5 text-[11px] font-medium text-accent">
        {READING_STATUS_LABELS[m.read_status]}
      </span>
    );
  }
  if (m.meeting_date) {
    chips.push(
      <span key="date" className="rounded px-1.5 py-0.5 text-[11px] font-medium text-secondary">
        {new Date(m.meeting_date).toLocaleDateString()}
      </span>
    );
  }

  if (chips.length === 0) return null;
  return <div className="mt-1.5 flex flex-wrap items-center gap-2">{chips}</div>;
}