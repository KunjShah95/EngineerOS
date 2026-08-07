"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { Bell, Check, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useMarkReminderRead, useReminders } from "@/hooks/useAutomation";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useUiStore } from "@/lib/store/ui";
import { cn } from "@/lib/utils";

export function NotificationPanel() {
  const { data: workspace } = useWorkspace();
  const workspaceId = workspace?.id ?? null;
  const { data: reminders } = useReminders(workspaceId);
  const markRead = useMarkReminderRead(workspaceId);
  const open = useUiStore((s) => s.notificationPanelOpen);
  const setOpen = useUiStore((s) => s.setNotificationPanelOpen);
  const panelRef = useRef<HTMLDivElement>(null);

  const unread = (reminders ?? []).filter((r) => !r.read_at);
  const recent = (reminders ?? []).slice(0, 12);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    const onClickOut = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClickOut);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClickOut);
    };
  }, [open, setOpen]);

  if (!open) return null;

  return (
    <div
      ref={panelRef}
      className="absolute top-14 right-4 z-50 w-80 rounded-xl border border-default bg-popover shadow-2xl"
    >
      <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <Bell className="size-4 text-accent" strokeWidth={1.75} />
          Notifications
          {unread.length > 0 && (
            <span className="rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-bold text-accent-foreground">
              {unread.length}
            </span>
          )}
        </span>
        <div className="flex items-center gap-1">
          {unread.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => unread.forEach((r) => markRead.mutate(r.id))}
            >
              Mark all read
            </Button>
          )}
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded p-1 text-secondary hover:bg-surface-hover hover:text-foreground"
          >
            <X className="size-3.5" strokeWidth={1.75} />
          </button>
        </div>
      </div>

      <div className="max-h-96 overflow-y-auto">
        {recent.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-faint">
            No notifications yet.
          </div>
        ) : (
          recent.map((r) => (
            <div
              key={r.id}
              className={cn(
                "flex items-start gap-3 border-b border-border-subtle px-4 py-3 text-sm last:border-0",
                !r.read_at && "bg-accent-muted/20"
              )}
            >
              <Bell
                className={cn("mt-0.5 size-4 shrink-0", r.read_at ? "text-faint" : "text-accent")}
                strokeWidth={1.75}
              />
              <div className="min-w-0 flex-1">
                {r.task_id ? (
                  <Link
                    href={`/tasks?task=${r.task_id}`}
                    onClick={() => setOpen(false)}
                    className="truncate font-medium text-foreground hover:text-accent"
                  >
                    {r.title}
                  </Link>
                ) : r.event_id ? (
                  <Link
                    href={`/calendar?event=${r.event_id}`}
                    onClick={() => setOpen(false)}
                    className="truncate font-medium text-foreground hover:text-accent"
                  >
                    {r.title}
                  </Link>
                ) : (
                  <span className="truncate font-medium">{r.title}</span>
                )}
                <p className="mt-0.5 text-xs text-faint">
                  {new Date(r.fire_at).toLocaleString()}
                </p>
              </div>
              {!r.read_at && (
                <button
                  type="button"
                  onClick={() => markRead.mutate(r.id)}
                  aria-label="Mark read"
                  className="mt-0.5 rounded p-1 text-faint hover:bg-surface-hover hover:text-accent"
                >
                  <Check className="size-3.5" strokeWidth={1.75} />
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
