"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Building2, Check, ChevronsUpDown, Plus, Users } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UpgradeDialog } from "@/components/saas/UpgradeDialog";
import { useCreateWorkspace, useSwitchWorkspace, useWorkspaces } from "@/hooks/useWorkspace";
import { canCreateWorkspace, planDefinition } from "@/lib/saas/plans";
import { UpgradeRequiredError } from "@/hooks/useWorkspace";
import { cn } from "@/lib/utils";

/**
 * Which workspace am I in, and which one do I want?
 *
 * The identity row at the top of the sidebar used to be a static wordmark. It's
 * now the switcher, because that's where people look for it and because a
 * multi-workspace app that can't show its current workspace is how you end up
 * writing notes into the wrong life.
 *
 * The "new workspace" path goes through the API rather than a direct insert so
 * the plan's workspace limit is real. A refusal comes back as 402, which is
 * turned into the same upgrade dialog every other gated surface uses.
 */

/** Short human label for a membership role; null renders nothing. */
function roleLabel(role: string | null): string | null {
  if (role === "owner") return "Owner";
  if (role === "editor") return "Editor";
  if (role === "viewer") return "Viewer";
  return null;
}

export function WorkspaceSwitcher({ collapsed = false }: { collapsed?: boolean }) {
  const router = useRouter();
  const { workspaces, activeWorkspace, setActiveWorkspace, entitlements } = useWorkspaces();
  const switchWorkspace = useSwitchWorkspace();
  const createWorkspace = useCreateWorkspace();

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const atWorkspaceLimit = !canCreateWorkspace(entitlements, workspaces.length);
  const planName = activeWorkspace?.plan ? planDefinition(activeWorkspace.plan).name : null;

  const choose = (id: string) => {
    if (id === activeWorkspace?.id) return;
    setActiveWorkspace(id);
    switchWorkspace.mutate(id);
    // Content below changes entirely with the workspace, so take the user to a
    // surface that is meaningful in any workspace rather than leaving them on a
    // detail page from the previous one.
    router.push("/dashboard");
  };

  const submitCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (atWorkspaceLimit) {
      setCreateOpen(false);
      setUpgradeOpen(true);
      return;
    }
    try {
      const workspace = await createWorkspace.mutateAsync(trimmed);
      setActiveWorkspace(workspace.id);
      setCreateOpen(false);
      setName("");
      toast.success(`Created ${workspace.name}`);
      router.push("/dashboard");
    } catch (err) {
      if (err instanceof UpgradeRequiredError) {
        setCreateOpen(false);
        setUpgradeOpen(true);
        return;
      }
      toast.error(err instanceof Error ? err.message : "Could not create workspace");
    }
  };

  return (
    <>
      <div className={cn("shrink-0 p-2", collapsed && "px-1")}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={`Workspace: ${activeWorkspace?.name ?? "none"}. Switch workspace`}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg border border-border-subtle bg-surface px-2.5 py-2 text-left transition-colors duration-150 hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                collapsed && "justify-center px-0"
              )}
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-accent-muted text-accent">
                <Building2 className="size-3.5" strokeWidth={1.75} />
              </span>
              {!collapsed && (
                <>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {activeWorkspace?.name ?? "Workspace"}
                    </span>
                    {planName && (
                      <span className="block truncate text-[10px] uppercase tracking-wide text-faint">
                        {planName}
                      </span>
                    )}
                  </span>
                  <ChevronsUpDown className="size-3.5 shrink-0 text-faint" strokeWidth={1.75} />
                </>
              )}
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="start" className="w-60">
            <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-faint">
              Your workspaces
            </DropdownMenuLabel>
            {workspaces.map((workspace) => {
              const role = roleLabel(workspace.role);
              return (
                <DropdownMenuItem
                  key={workspace.id}
                  onSelect={() => choose(workspace.id)}
                  className="gap-2"
                >
                  <Check
                    className={cn(
                      "size-3.5 shrink-0 text-accent",
                      workspace.id === activeWorkspace?.id ? "opacity-100" : "opacity-0"
                    )}
                    strokeWidth={2}
                  />
                  <span className="min-w-0 flex-1 truncate">{workspace.name}</span>
                  {role && (
                    <span className="flex shrink-0 items-center gap-1 text-[10px] text-faint">
                      {role === "Owner" ? null : <Users className="size-2.5" strokeWidth={2} />}
                      {role}
                    </span>
                  )}
                </DropdownMenuItem>
              );
            })}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => {
                if (atWorkspaceLimit) {
                  setUpgradeOpen(true);
                  return;
                }
                setCreateOpen(true);
              }}
              className="gap-2"
            >
              <Plus className="size-3.5 shrink-0" strokeWidth={1.75} />
              New workspace
              {atWorkspaceLimit && (
                <span className="ml-auto text-[10px] font-semibold uppercase tracking-wide text-accent">
                  Upgrade
                </span>
              )}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>New workspace</DialogTitle>
            <DialogDescription>
              A workspace is a separate context — work, personal, a client. Notes,
              tasks and the AI assistant are scoped to it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="workspace-name-input">Name</Label>
            <Input
              id="workspace-name-input"
              value={name}
              autoFocus
              placeholder="Personal"
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void submitCreate();
              }}
            />
            {entitlements.limits.workspaces !== null && (
              <p className="text-xs text-faint">
                {workspaces.length} of {entitlements.limits.workspaces} used on your plan.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void submitCreate()} disabled={!name.trim() || createWorkspace.isPending}>
              {createWorkspace.isPending ? "Creating…" : "Create workspace"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <UpgradeDialog
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        reason={atWorkspaceLimit ? { kind: "workspaces", limit: entitlements.limits.workspaces ?? 0 } : null}
      />
    </>
  );
}
