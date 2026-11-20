"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  BookOpenText,
  Bookmark,
  Calendar,
  CalendarDays,
  CheckSquare,
  ChevronRight,
  Code2,
  Scissors,
  FileText,
  FolderKanban,
  LayoutDashboard,
  Network,
  Scale,
  Search,
  Settings,
  Sparkles,
  Target,
  Timer,
  TrendingUp,
  Users,
  MessageSquareText,
  Mic,
  GitFork,
  Workflow,
  SlidersHorizontal,
  Wrench,
} from "lucide-react";

import { useUiStore } from "@/lib/store/ui";
import { WorkspaceSwitcher } from "@/components/shell/WorkspaceSwitcher";
import { useModCombo } from "@/hooks/usePlatformShortcut";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

/**
 * Primary navigation.
 *
 * A first-time visitor used to be handed 22 destinations at once, including
 * "Architecture", "Snippets" and "Mind map" — a control panel, not an
 * invitation. The default view is now the handful of things that make sense on
 * day one, and the rest sits behind one persisted toggle.
 *
 * Collapsing is presentation, never permission. Every advanced route still works,
 * still has its keyboard shortcut, and is still findable from ⌘K; and someone who
 * has already finished onboarding defaults to the toggle being *on*, because
 * hiding tools they use daily would be a downgrade disguised as a simplification.
 *
 * Labels are the other half of this: `Daily` reads like a calendar app, `Journal`
 * reads like something to write in. Same route, clearer promise.
 */

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

/** What a new person recognises immediately: write, track, plan. */
const ESSENTIALS: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/notes", label: "Notes", icon: FileText },
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/daily", label: "Journal", icon: CalendarDays },
];

/** Collecting and asking — the two things that pull people back in. */
const LIBRARY: NavItem[] = [
  { href: "/assistant", label: "Ask AI", icon: Sparkles },
  { href: "/decisions", label: "Decisions", icon: Scale },
  { href: "/bookmarks", label: "Saved links", icon: Bookmark },
  { href: "/reading", label: "Reading list", icon: BookOpenText },
];

/**
 * Everything whose name assumes a context, or whose value only appears once
 * there's real data in the workspace. Hidden by default, never restricted.
 */
const ADVANCED: NavItem[] = [
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/goals", label: "Goals", icon: Target },
  { href: "/habits", label: "Habits", icon: TrendingUp },
  { href: "/automation", label: "Automations", icon: Workflow },
  { href: "/graph", label: "Knowledge graph", icon: GitFork },
  { href: "/mindmap", label: "Mind map", icon: Network },
  { href: "/architecture", label: "Design notes", icon: Network },
  { href: "/code", label: "Code", icon: Code2 },
  { href: "/snippets", label: "Snippets", icon: Scissors },
  { href: "/pdf-chat", label: "PDF chat", icon: MessageSquareText },
  { href: "/voice", label: "Voice notes", icon: Mic },
  { href: "/meetings", label: "Meetings", icon: Users },
  { href: "/contacts", label: "People", icon: Users },
  { href: "/pomodoro", label: "Focus timer", icon: Timer },
];

const ACCOUNT: NavItem[] = [{ href: "/settings", label: "Settings", icon: Settings }];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.04 } },
};

const itemVariants = {
  hidden: { opacity: 0, x: -8 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.18 } },
};

function NavLink({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const pathname = usePathname();
  const Icon = item.icon;
  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
  return (
    <motion.div variants={itemVariants}>
      <Link
        href={item.href}
        title={collapsed ? item.label : undefined}
        aria-label={collapsed ? item.label : undefined}
        aria-current={active ? "page" : undefined}
        className={cn(
          "group relative flex items-center py-2 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
          collapsed ? "justify-center rounded-md px-0" : "gap-2.5 rounded-md px-3",
          active
            ? "bg-accent-muted/60 text-foreground"
            : "text-secondary hover:bg-surface-hover hover:text-foreground"
        )}
      >
        {/* Active indicator rail */}
        <span
          aria-hidden
          className={cn(
            "absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-accent transition-all duration-200",
            active ? "opacity-100" : "opacity-0 group-hover:opacity-40"
          )}
        />
        <Icon
          className={cn(
            "size-4 shrink-0 transition-colors duration-150",
            active ? "text-accent" : "text-secondary group-hover:text-foreground"
          )}
          strokeWidth={1.75}
        />
        {!collapsed && item.label}
      </Link>
    </motion.div>
  );
}

function NavGroup({
  label,
  items,
  collapsed,
}: {
  label?: string;
  items: NavItem[];
  collapsed: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      {label && !collapsed && (
        /* Mono micro-label, not uppercase Inter — group headers are metadata. */
        <span className="label-mono px-3">{label}</span>
      )}
      <div className="flex flex-col gap-0.5">
        {items.map((item) => (
          <NavLink key={item.href} item={item} collapsed={collapsed} />
        ))}
      </div>
    </div>
  );
}

export function AppNav({ collapsed = false }: { collapsed?: boolean }) {
  const setCommandPaletteOpen = useUiStore((s) => s.setCommandPaletteOpen);
  const advancedToolsOpen = useUiStore((s) => s.advancedToolsOpen);
  const toggleAdvancedTools = useUiStore((s) => s.toggleAdvancedTools);
  const searchShortcut = useModCombo("K");

  return (
    <nav className="flex flex-1 flex-col overflow-hidden" aria-label="Primary">
      <WorkspaceSwitcher collapsed={collapsed} />

      <div className="flex-1 overflow-y-auto p-3">
        <motion.div
          className="flex flex-col gap-6"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <NavGroup items={ESSENTIALS} collapsed={collapsed} />
          <NavGroup label="Library" items={LIBRARY} collapsed={collapsed} />
          {advancedToolsOpen && <NavGroup label="All tools" items={ADVANCED} collapsed={collapsed} />}

          {/* Progressive disclosure. Sits below the list it controls and above
              Settings, so the two always-reachable things frame the list. */}
          <button
            type="button"
            onClick={toggleAdvancedTools}
            aria-expanded={advancedToolsOpen}
            aria-label={advancedToolsOpen ? "Fewer tools" : `Show all ${ADVANCED.length} tools`}
            title={collapsed ? (advancedToolsOpen ? "Fewer tools" : "Show all tools") : undefined}
            className={cn(
              "flex items-center rounded-lg py-1.5 text-xs font-medium text-faint transition-colors duration-150 hover:bg-surface-hover hover:text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
              collapsed ? "justify-center px-0" : "gap-2 px-3"
            )}
          >
            {advancedToolsOpen ? (
              <SlidersHorizontal className="size-3.5 shrink-0" strokeWidth={1.75} />
            ) : (
              <Wrench className="size-3.5 shrink-0" strokeWidth={1.75} />
            )}
            {!collapsed && (
              <>
                <span className="flex-1 text-left">
                  {advancedToolsOpen ? "Fewer tools" : `Show all ${ADVANCED.length} tools`}
                </span>
                <ChevronRight
                  className={cn(
                    "size-3 shrink-0 transition-transform duration-150",
                    advancedToolsOpen && "rotate-90"
                  )}
                  strokeWidth={2}
                />
              </>
            )}
          </button>

          <NavGroup items={ACCOUNT} collapsed={collapsed} />
        </motion.div>
      </div>

      <div className="shrink-0 border-t border-border-subtle p-3">
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          type="button"
          onClick={() => setCommandPaletteOpen(true)}
          aria-label={`Search (${searchShortcut})`}
          title={collapsed ? `Search (${searchShortcut})` : undefined}
          className={cn(
            "flex w-full items-center border border-border-subtle bg-base/50 text-sm font-medium text-secondary transition-all duration-150 hover:border-accent/30 hover:bg-base hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
            collapsed ? "justify-center gap-0 rounded-md px-0 py-2" : "gap-2.5 rounded-md px-3 py-2"
          )}
        >
          <Search className="size-4 shrink-0" strokeWidth={1.75} />
          {!collapsed && (
            <>
              Search
              {/* Keycaps are mono and tabular so the column of them in the
                  shortcuts page and this one read the same. */}
              <kbd className="figure-mono ml-auto rounded border border-border-subtle bg-elevated px-1.5 py-0.5 text-[10px] text-faint">
                {searchShortcut}
              </kbd>
            </>
          )}
        </motion.button>
      </div>
    </nav>
  );
}
