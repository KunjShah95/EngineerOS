"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ExternalLink, GitFork, Loader2, RefreshCw, CheckSquare } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  fetchGitHubIssues,
  fetchGitHubRepos,
  useDisconnectIntegration,
  useIntegration,
} from "@/hooks/useIntegrations";
import { useCreateTask } from "@/hooks/useTasks";
import type { GitHubIssue, GitHubRepo } from "@/hooks/useIntegrations";
import { cn } from "@/lib/utils";

export function GitHubSection({ workspaceId }: { workspaceId: string }) {
  const { data: integration, isLoading } = useIntegration(workspaceId);
  const disconnect = useDisconnectIntegration(workspaceId);
  const createTask = useCreateTask(workspaceId);

  const [repos, setRepos] = useState<GitHubRepo[] | null>(null);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState<string>("");
  const [issues, setIssues] = useState<GitHubIssue[] | null>(null);
  const [loadingIssues, setLoadingIssues] = useState(false);
  const [importing, setImporting] = useState(false);

  const loadRepos = async () => {
    setLoadingRepos(true);
    try {
      const data = await fetchGitHubRepos();
      setRepos(data);
    } catch {
      toast.error("Couldn't load your repositories");
    } finally {
      setLoadingRepos(false);
    }
  };

  const loadIssues = async (repo: string) => {
    setSelectedRepo(repo);
    setIssues(null);
    setLoadingIssues(true);
    try {
      setIssues(await fetchGitHubIssues(repo));
    } catch {
      toast.error("Couldn't load issues for that repository");
    } finally {
      setLoadingIssues(false);
    }
  };

  const importIssues = async (selected: GitHubIssue[]) => {
    if (selected.length === 0 || !repos) return;
    setImporting(true);
    const repo = repos.find((r) => r.full_name === selectedRepo);
    try {
      for (const issue of selected) {
        await createTask.mutateAsync({
          title: issue.title,
          description: `Imported from GitHub · ${issue.html_url}\n\n${issue.body ?? ""}`.trim(),
          priority: "medium",
          source_url: issue.html_url,
        });
      }
      toast.success(`Imported ${selected.length} issue${selected.length > 1 ? "s" : ""}`);
      setIssues((prev) => prev?.filter((i) => !selected.includes(i)) ?? null);
      if (repo) {
        setRepos((prev) =>
          prev?.map((r) =>
            r.full_name === repo.full_name
              ? { ...r, open_issues_count: Math.max(0, r.open_issues_count - selected.length) }
              : r
          ) ?? null
        );
      }
    } catch {
      toast.error("Import failed — check your connection");
    } finally {
      setImporting(false);
    }
  };

  const [checked, setChecked] = useState<Set<number>>(new Set());
  const toggle = (n: number) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return next;
    });
  const selectedIssues = useMemo(() => (issues ?? []).filter((i) => checked.has(i.number)), [issues, checked]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-6 text-sm text-faint">
        <Loader2 className="size-4 animate-spin" strokeWidth={1.75} />
        Checking connection…
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "flex size-9 items-center justify-center rounded-lg",
              integration ? "bg-accent-muted text-accent" : "bg-surface-hover text-faint"
            )}
          >
            <GitFork className="size-4.5" strokeWidth={1.75} />
          </span>
          <div>
            <p className="text-sm font-medium text-foreground">GitHub</p>
            <p className="text-xs text-faint">
              {integration
                ? `Connected as ${integration.username}`
                : "Import issues as tasks from your repositories."}
            </p>
          </div>
        </div>

        {integration ? (
          <Button variant="outline" size="sm" onClick={() => void disconnect.mutateAsync()} disabled={disconnect.isPending}>
            {disconnect.isPending ? "Disconnecting…" : "Disconnect"}
          </Button>
        ) : (
          <Button size="sm" asChild>
            <a href="/api/auth/github">
              <GitFork className="size-4" strokeWidth={1.75} />
              Connect with GitHub
            </a>
          </Button>
        )}
      </div>

      {integration && (
        <div className="mt-5 space-y-4 border-t border-border-subtle pt-5">
          {!repos && (
            <Button variant="secondary" size="sm" onClick={() => void loadRepos()} disabled={loadingRepos}>
              {loadingRepos ? <Loader2 className="size-4 animate-spin" strokeWidth={1.75} /> : <RefreshCw className="size-4" strokeWidth={1.75} />}
              {loadingRepos ? "Loading repos…" : "Load repositories"}
            </Button>
          )}

          {repos && repos.length > 0 && (
            <div className="space-y-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-secondary">Repository</label>
                <Select value={selectedRepo} onValueChange={(v) => void loadIssues(v)}>
                  <SelectTrigger className="w-full max-w-sm">
                    <SelectValue placeholder="Pick a repository" />
                  </SelectTrigger>
                  <SelectContent>
                    {repos.map((r) => (
                      <SelectItem key={r.full_name} value={r.full_name}>
                        {r.full_name} · {r.open_issues_count} open
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {loadingIssues && (
                <p className="flex items-center gap-2 text-sm text-faint">
                  <Loader2 className="size-3.5 animate-spin" strokeWidth={1.75} />
                  Loading issues…
                </p>
              )}

              {issues && (
                <>
                  <ul className="divide-y divide-border-subtle rounded-lg border border-border-subtle">
                    {issues.length === 0 && (
                      <li className="px-4 py-3 text-sm text-faint">No open issues in this repository.</li>
                    )}
                    {issues.map((issue) => (
                      <li key={issue.number} className="flex items-center gap-3 px-4 py-2.5">
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={checked.has(issue.number)}
                          onClick={() => toggle(issue.number)}
                          className={cn(
                            "flex size-4 shrink-0 items-center justify-center rounded border transition-colors",
                            checked.has(issue.number)
                              ? "border-transparent bg-accent text-white"
                              : "border-border-default hover:border-accent/60"
                          )}
                        >
                          {checked.has(issue.number) && <CheckSquare className="size-3" strokeWidth={2} />}
                        </button>
                        <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                          #{issue.number} {issue.title}
                        </span>
                        <Link
                          href={issue.html_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-faint transition-colors hover:text-accent"
                          aria-label="Open issue on GitHub"
                        >
                          <ExternalLink className="size-3.5" strokeWidth={1.75} />
                        </Link>
                      </li>
                    ))}
                  </ul>
                  <Button
                    size="sm"
                    onClick={() => void importIssues(selectedIssues)}
                    disabled={selectedIssues.length === 0 || importing}
                  >
                    {importing ? <Loader2 className="size-4 animate-spin" strokeWidth={1.75} /> : null}
                    Import {selectedIssues.length > 0 ? `${selectedIssues.length} ` : ""}as task{selectedIssues.length === 1 ? "" : "s"}
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
