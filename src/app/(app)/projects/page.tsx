"use client";

import { useRouter } from "next/navigation";
import { FolderKanban, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shell/EmptyState";
import { PageLoader } from "@/components/shell/PageLoader";
import { ProjectCard } from "@/components/project/ProjectCard";
import { ProjectForm } from "@/components/project/ProjectForm";
import { useProjects } from "@/hooks/useProjects";
import { useWorkspace } from "@/hooks/useWorkspace";

export default function ProjectsPage() {
  const router = useRouter();
  const { data: workspace } = useWorkspace();
  const { data: projects, isLoading, isError } = useProjects(workspace?.id ?? null);

  if (!workspace) return <PageLoader label="Loading workspace…" />;

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="mb-6 flex items-center justify-between">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-36" />
          ))}
        </div>
      </div>
    );
  }

  if (isError || !projects || projects.length === 0) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-default px-6 py-4">
          <h1 className="text-lg font-semibold">Projects</h1>
          <ProjectForm
            workspaceId={workspace.id}
            trigger={
              <Button size="sm">
                <Plus className="size-4" strokeWidth={1.75} />
                New Project
              </Button>
            }
            onCreated={(id) => router.push(`/projects/${id}`)}
          />
        </div>
        <div className="flex-1">
          <EmptyState
            icon={FolderKanban}
            title="No projects yet"
            description="Projects group your notes and tasks around a body of work. Create your first one to get started."
          />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Projects</h1>
          <p className="text-sm text-secondary">
            {projects.length} {projects.length === 1 ? "project" : "projects"} in your workspace
          </p>
        </div>
        <ProjectForm
          workspaceId={workspace.id}
          trigger={
            <Button size="sm">
              <Plus className="size-4" strokeWidth={1.75} />
              New Project
            </Button>
          }
          onCreated={(id) => router.push(`/projects/${id}`)}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>
    </div>
  );
}
