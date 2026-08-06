"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogIn, PanelLeftClose, PanelLeftOpen, Terminal, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { AppNav } from "@/components/shell/AppNav";
import { TopBar } from "@/components/shell/TopBar";
import { PageLoader } from "@/components/shell/PageLoader";
import { CommandPalette } from "@/components/search/CommandPalette";
import { QuickCaptureModal } from "@/components/quick-capture/QuickCaptureModal";
import { VoiceAgent } from "@/components/voice-agent/VoiceAgent";
import { SetupNotice } from "@/components/supabase/SetupNotice";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useAutoIndex } from "@/hooks/useAutoIndex";
import { useAutoAutomation } from "@/hooks/useAutoAutomation";
import { useProactiveNudges } from "@/hooks/useProactiveNudges";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { Button } from "@/components/ui/button";
import { useUiStore, getStoredSidebarCollapsed } from "@/lib/store/ui";
import { useKeyboardShortcuts, type ShortcutDef } from "@/hooks/useKeyboardShortcuts";
import { ShortcutsDialog } from "@/components/shell/ShortcutsDialog";
import { cn } from "@/lib/utils";

function SidebarHeader({
  collapsed,
  onToggle,
  className,
}: {
  collapsed: boolean;
  onToggle: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-14 shrink-0 items-center border-b border-default px-4",
        collapsed ? "justify-center" : "justify-between",
        className
      )}
    >
      <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-accent shadow-[0_0_16px_-6px_var(--accent)]">
        <Terminal className="size-4 text-white" strokeWidth={2} />
      </span>
      {!collapsed && (
        <span className="text-sm font-semibold tracking-tight text-foreground">EngineerOS</span>
      )}
      <Button
        variant="ghost"
        size="icon"
        onClick={onToggle}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className={cn("size-7 text-secondary hover:text-foreground", collapsed && "mt-1")}
      >
        {collapsed ? (
          <PanelLeftOpen className="size-4" strokeWidth={1.75} />
        ) : (
          <PanelLeftClose className="size-4" strokeWidth={1.75} />
        )}
      </Button>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: workspace, isLoading, isError } = useWorkspace();
  const router = useRouter();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [prevPathname, setPrevPathname] = useState(pathname);
  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const focusMode = useUiStore((s) => s.focusMode);
  const toggleFocusMode = useUiStore((s) => s.toggleFocusMode);

  // Hydrate the persisted collapsed state once on mount.
  useEffect(() => {
    useUiStore.setState({ sidebarCollapsed: getStoredSidebarCollapsed() });
  }, []);

  const setCommandPaletteOpen = useUiStore((s) => s.setCommandPaletteOpen);
  const setQuickCaptureOpen = useUiStore((s) => s.setQuickCaptureOpen);

  // Global keyboard shortcuts — the core of the keyboard-first workflow.
  const shortcuts: ShortcutDef[] = [
    {
      id: "shortcuts",
      group: "Actions",
      label: "Keyboard shortcuts",
      combo: "⌘/",
      key: "/",
      mod: true,
      handler: () => setShortcutsOpen((v) => !v),
    },
    {
      id: "new-note",
      group: "Actions",
      label: "New note",
      combo: "⌘N",
      key: "n",
      mod: true,
      handler: () => router.push("/notes?new=1"),
    },
    {
      id: "new-task",
      group: "Actions",
      label: "New task",
      combo: "⇧⌘N",
      key: "n",
      mod: true,
      shift: true,
      handler: () => router.push("/tasks?new=1"),
    },
    {
      id: "quick-capture",
      group: "Actions",
      label: "Quick capture",
      combo: "⌘G",
      key: "g",
      mod: true,
      handler: () => setQuickCaptureOpen(true),
    },
    {
      id: "focus-mode",
      group: "View",
      label: "Toggle focus mode",
      combo: "⇧⌘F",
      key: "f",
      mod: true,
      shift: true,
      handler: toggleFocusMode,
    },
    {
      id: "sidebar",
      group: "View",
      label: "Toggle sidebar",
      combo: "⌘B",
      key: "b",
      mod: true,
      handler: toggleSidebar,
    },
    {
      id: "nav-dashboard",
      group: "Navigate",
      label: "Go to Dashboard",
      combo: "⌘1",
      key: "1",
      mod: true,
      handler: () => router.push("/dashboard"),
    },
    {
      id: "nav-projects",
      group: "Navigate",
      label: "Go to Projects",
      combo: "⌘2",
      key: "2",
      mod: true,
      handler: () => router.push("/projects"),
    },
    {
      id: "nav-tasks",
      group: "Navigate",
      label: "Go to Tasks",
      combo: "⌘3",
      key: "3",
      mod: true,
      handler: () => router.push("/tasks"),
    },
    {
      id: "nav-calendar",
      group: "Navigate",
      label: "Go to Calendar",
      combo: "⌘4",
      key: "4",
      mod: true,
      handler: () => router.push("/calendar"),
    },
    {
      id: "nav-notes",
      group: "Navigate",
      label: "Go to Notes",
      combo: "⌘5",
      key: "5",
      mod: true,
      handler: () => router.push("/notes"),
    },
    {
      id: "nav-daily",
      group: "Navigate",
      label: "Go to Daily",
      combo: "⌘6",
      key: "6",
      mod: true,
      handler: () => router.push("/daily"),
    },
    {
      id: "nav-assistant",
      group: "Navigate",
      label: "Go to Assistant",
      combo: "⌘7",
      key: "7",
      mod: true,
      handler: () => router.push("/assistant"),
    },
    {
      id: "nav-settings",
      group: "Navigate",
      label: "Go to Settings",
      combo: "⌘8",
      key: "8",
      mod: true,
      handler: () => router.push("/settings"),
    },
    {
      id: "nav-graph",
      group: "Navigate",
      label: "Go to Knowledge Graph",
      combo: "⌘9",
      key: "9",
      mod: true,
      handler: () => router.push("/graph"),
    },
    {
      id: "search",
      group: "Actions",
      label: "Search / commands",
      combo: "⌘K",
      key: "k",
      mod: true,
      handler: () => setCommandPaletteOpen(true),
      allowInInput: true,
    },
  ];

  // ⌘K is owned by CommandPalette (toggle + Escape semantics); we keep it in
  // the list only so the help dialog documents it.
  useKeyboardShortcuts(shortcuts.filter((s) => s.id !== "search"));

  // Keep the embeddings index fresh in the background (silent, non-blocking).
  useAutoIndex(workspace?.id ?? null);
  // Phase 10 — evaluate automation rules + drain the job queue in the background.
  useAutoAutomation(workspace?.id ?? null);
  // Surface overdue tasks as a toast nudge on load.
  useProactiveNudges(workspace?.id ?? null);

  // Close the mobile drawer on navigation — adjust state during render (the
  // React-recommended pattern, no effect cascade).
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setMobileNavOpen(false);
  }

  // Lock body scroll + close on Escape while the mobile drawer is open.
  useEffect(() => {
    if (!mobileNavOpen) return;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileNavOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [mobileNavOpen]);

  if (!isSupabaseConfigured()) {
    return <SetupNotice />;
  }

  if (isLoading) {
    return (
      <div className="flex h-dvh bg-base text-foreground">
        <PageLoader label="Loading your workspace…" />
      </div>
    );
  }

  if (isError || !workspace) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-3 bg-base px-8 text-center text-foreground">
        <div className="rounded-md bg-accent-muted p-3">
          <LogIn className="size-6 text-accent" strokeWidth={1.75} />
        </div>
        <h3 className="text-sm font-medium">Sign in required</h3>
        <p className="max-w-sm text-sm text-faint">
          Your workspace hasn&apos;t loaded yet. Sign in to continue.
        </p>
        <Link href="/login" className="text-sm font-medium text-accent hover:text-accent-hover">
          Go to login
        </Link>
      </div>
    );
  }

  const drawer = (
    <div className="flex h-full w-64 flex-col bg-surface">
      <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-default pr-2 md:hidden">
        <SidebarHeader collapsed={false} onToggle={() => {}} className="flex-1 border-b-0 pl-4" />
        <Button
          variant="ghost"
          size="icon"
          aria-label="Close navigation"
          autoFocus
          onClick={() => setMobileNavOpen(false)}
        >
          <X className="size-4" strokeWidth={1.75} />
        </Button>
      </div>
      <AppNav />
    </div>
  );

  return (
    <div className="flex h-dvh overflow-hidden bg-base text-foreground">
      {/* Skip link for keyboard users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-md focus:bg-accent focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-accent-foreground"
      >
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden shrink-0 flex-col border-r border-default bg-surface transition-[width] duration-200 md:flex",
          focusMode ? "w-0 overflow-hidden border-0" : sidebarCollapsed ? "w-16" : "w-56"
        )}
      >
        <SidebarHeader collapsed={sidebarCollapsed} onToggle={toggleSidebar} />
        <AppNav collapsed={sidebarCollapsed} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onOpenMobileNav={() => setMobileNavOpen(true)} />
        <main
          id="main-content"
          tabIndex={-1}
          className="relative flex-1 overflow-y-auto focus:outline-none"
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileNavOpen && (
          <>
            <motion.div
              key="nav-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
              onClick={() => setMobileNavOpen(false)}
              aria-hidden
            />
            <motion.aside
              key="nav-drawer"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "tween", duration: 0.22, ease: "easeOut" }}
              className="fixed inset-y-0 left-0 z-50 w-64 border-r border-default shadow-2xl md:hidden"
              role="dialog"
              aria-modal="true"
              aria-label="Navigation"
            >
              {drawer}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <CommandPalette workspaceId={workspace.id} />
      <QuickCaptureModal workspaceId={workspace.id} />
      <VoiceAgent />
      <ShortcutsDialog
        open={shortcutsOpen}
        onOpenChange={setShortcutsOpen}
        shortcuts={shortcuts}
      />
    </div>
  );
}
