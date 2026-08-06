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
  Code2,
  Scissors,
  FileText,
  FolderKanban,
  LayoutDashboard,
  Network,
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
} from "lucide-react";

import { useUiStore } from "@/lib/store/ui";
import { cn } from "@/lib/utils";

const NAV_GROUPS = [
  {
    label: "Core",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/projects", label: "Projects", icon: FolderKanban },
      { href: "/tasks", label: "Tasks", icon: CheckSquare },
      { href: "/calendar", label: "Calendar", icon: Calendar },
    ],
  },
  {
    label: "Knowledge",
    items: [
      { href: "/notes", label: "Notes", icon: FileText },
      { href: "/daily", label: "Daily", icon: CalendarDays },
      { href: "/code", label: "Code", icon: Code2 },
      { href: "/bookmarks", label: "Bookmarks", icon: Bookmark },
      { href: "/reading", label: "Reading", icon: BookOpenText },
      { href: "/architecture", label: "Architecture", icon: Network },
    ],
  },
  {
    label: "AI & Intelligence",
    items: [
      { href: "/assistant", label: "Assistant", icon: Sparkles },
      { href: "/mindmap", label: "Mind map", icon: Network },
      { href: "/graph", label: "Graph", icon: GitFork },
      { href: "/automation", label: "Automation", icon: Workflow },
      { href: "/pdf-chat", label: "PDF chat", icon: MessageSquareText },
      { href: "/voice", label: "Voice", icon: Mic },
    ],
  },
  {
    label: "Productivity",
    items: [
      { href: "/habits", label: "Habits", icon: TrendingUp },
      { href: "/goals", label: "Goals", icon: Target },
      { href: "/pomodoro", label: "Pomodoro", icon: Timer },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/snippets", label: "Snippets", icon: Scissors },
      { href: "/contacts", label: "Contacts", icon: Users },
      { href: "/meetings", label: "Meetings", icon: Users },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.04,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, x: -8 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.18 } },
};

export function AppNav({ collapsed = false }: { collapsed?: boolean }) {
  const pathname = usePathname();
  const setCommandPaletteOpen = useUiStore((s) => s.setCommandPaletteOpen);

  return (
    <nav
      className="flex flex-1 flex-col overflow-hidden"
      aria-label="Primary"
    >
      <div className="flex-1 overflow-y-auto p-3">
        <motion.div
          className="flex flex-col gap-6"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="flex flex-col gap-1">
              {!collapsed && (
                <span className="px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-faint">
                  {group.label}
                </span>
              )}
              <div className="flex flex-col gap-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <motion.div key={item.href} variants={itemVariants}>
                      <Link
                        href={item.href}
                        title={collapsed ? item.label : undefined}
                        className={cn(
                          "group relative flex items-center rounded-lg py-2 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                          collapsed ? "justify-center px-0" : "gap-2.5 px-3",
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
                })}
              </div>
            </div>
          ))}
        </motion.div>
      </div>

      <div className="shrink-0 border-t border-border-subtle p-3">
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          type="button"
          onClick={() => setCommandPaletteOpen(true)}
          aria-label="Search (⌘K)"
          title={collapsed ? "Search (⌘K)" : undefined}
          className={cn(
            "flex w-full items-center rounded-lg border border-border-subtle bg-base/50 text-sm font-medium text-secondary transition-all duration-150 hover:border-accent/30 hover:bg-base hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
            collapsed ? "justify-center gap-0 px-0 py-2" : "gap-2.5 px-3 py-2"
          )}
        >
          <Search className="size-4 shrink-0" strokeWidth={1.75} />
          {!collapsed && (
            <>
              Search
              <kbd className="ml-auto rounded border border-border-subtle bg-elevated px-1.5 py-0.5 text-[10px] font-medium text-faint">
                ⌘K
              </kbd>
            </>
          )}
        </motion.button>
      </div>
    </nav>
  );
}
