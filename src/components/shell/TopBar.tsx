"use client";

import Link from "next/link";
import { Plus, Search, Settings } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { useProfile } from "@/hooks/useProfile";
import { useUiStore } from "@/lib/store/ui";

export function TopBar() {
  const setCommandPaletteOpen = useUiStore((s) => s.setCommandPaletteOpen);
  const setQuickCaptureOpen = useUiStore((s) => s.setQuickCaptureOpen);
  const { data: profile } = useProfile();

  const initials = (profile?.display_name || profile?.email || "?")
    .split(/[\s@]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-default bg-surface px-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setCommandPaletteOpen(true)}
          className="group flex w-64 items-center gap-2 rounded-md border border-default bg-base px-3 py-1.5 text-sm text-secondary transition-colors duration-150 hover:border-border-subtle hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          <Search className="size-4 shrink-0" strokeWidth={1.75} />
          <span className="flex-1 text-left">Search…</span>
          <kbd className="rounded border border-border-subtle bg-elevated px-1.5 py-0.5 text-[10px] font-medium text-faint">
            ⌘K
          </kbd>
        </button>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setQuickCaptureOpen(true)}
          aria-label="Quick capture"
        >
          <Plus className="size-4" strokeWidth={1.75} />
          Quick Capture
        </Button>
        <ThemeToggle />

        <Link
          href="/settings"
          aria-label="Settings"
          className="ml-1 flex items-center gap-2 rounded-md py-1 pl-1 pr-2 transition-colors duration-150 hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          <Avatar size="sm">
            {profile?.avatar_url ? (
              <AvatarImage src={profile.avatar_url} alt="" />
            ) : null}
            <AvatarFallback>{initials || <Settings className="size-3" strokeWidth={1.75} />}</AvatarFallback>
          </Avatar>
          <span className="hidden max-w-28 truncate text-sm font-medium text-secondary xl:block">
            {profile?.display_name || profile?.email?.split("@")[0]}
          </span>
        </Link>
      </div>
    </header>
  );
}
