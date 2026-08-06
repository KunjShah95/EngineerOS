"use client";

import Link from "next/link";
import { Bell, Focus, Menu, Plus, Search, Settings } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { NotificationPanel } from "@/components/shell/NotificationPanel";
import { useProfile } from "@/hooks/useProfile";
import { useReminders } from "@/hooks/useAutomation";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useUiStore } from "@/lib/store/ui";
import { cn } from "@/lib/utils";

export function TopBar({ onOpenMobileNav }: { onOpenMobileNav: () => void }) {
  const setCommandPaletteOpen = useUiStore((s) => s.setCommandPaletteOpen);
  const setQuickCaptureOpen = useUiStore((s) => s.setQuickCaptureOpen);
  const focusMode = useUiStore((s) => s.focusMode);
  const toggleFocusMode = useUiStore((s) => s.toggleFocusMode);
  const notificationPanelOpen = useUiStore((s) => s.notificationPanelOpen);
  const setNotificationPanelOpen = useUiStore((s) => s.setNotificationPanelOpen);
  const { data: profile } = useProfile();
  const { data: workspace } = useWorkspace();
  const { data: reminders } = useReminders(workspace?.id ?? null);

  const unreadCount = (reminders ?? []).filter((r) => !r.read_at).length;

  const initials = (profile?.display_name || profile?.email || "?")
    .split(/[\s@]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-default bg-surface/80 px-4 backdrop-blur-md">
      <div className="flex min-w-0 items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={onOpenMobileNav}
          aria-label="Open navigation"
        >
          <Menu className="size-4" strokeWidth={1.75} />
        </Button>

        <button
          type="button"
          onClick={() => setCommandPaletteOpen(true)}
          className="group flex w-full min-w-0 max-w-72 flex-1 items-center gap-2 rounded-lg border border-default bg-base/50 px-3 py-1.5 text-sm text-secondary transition-all duration-200 hover:border-accent-muted hover:bg-base hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 sm:w-64 sm:flex-none"
        >
          <Search className="size-4 shrink-0" strokeWidth={1.75} />
          <span className="min-w-0 flex-1 truncate text-left">Search…</span>
          <kbd className="hidden rounded border border-border-subtle bg-elevated px-1.5 py-0.5 text-[10px] font-medium text-faint sm:block">
            ⌘K
          </kbd>
        </button>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setQuickCaptureOpen(true)}
          aria-label="Quick capture"
        >
          <Plus className="size-4" strokeWidth={1.75} />
          <span className="hidden lg:inline">Quick Capture</span>
        </Button>

        {/* Focus mode toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleFocusMode}
          aria-label={focusMode ? "Exit focus mode" : "Enter focus mode"}
          title={focusMode ? "Exit focus mode" : "Focus mode"}
          className={cn(focusMode && "text-accent")}
        >
          <Focus className="size-4" strokeWidth={1.75} />
        </Button>

        {/* Notification bell */}
        <div className="relative">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setNotificationPanelOpen(!notificationPanelOpen)}
            aria-label="Notifications"
            className={cn(notificationPanelOpen && "text-accent")}
          >
            <Bell className="size-4" strokeWidth={1.75} />
          </Button>
          {unreadCount > 0 && (
            <span className="pointer-events-none absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-accent text-[9px] font-bold text-accent-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
          <NotificationPanel />
        </div>

        <ThemeToggle />

        <Link
          href="/settings"
          aria-label="Settings"
          className="ml-0.5 flex items-center gap-2 rounded-md py-1 pl-1 pr-2 transition-colors duration-150 hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
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
