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
  FileText,
  FolderKanban,
  LayoutDashboard,
  Network,
  Search,
  Settings,
  Sparkles,
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
    label: "System",
    items: [
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

export function AppNav() {
  const pathname = usePathname();
  const setCommandPaletteOpen = useUiStore((s) => s.setCommandPaletteOpen);

  return (
    <nav
      className="flex flex-1 flex-col gap-6 p-3"
      aria-label="Primary"
    >
      <motion.div
        className="flex flex-col gap-6"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="flex flex-col gap-1">
            <span className="px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-faint">
              {group.label}
            </span>
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <motion.div key={item.href} variants={itemVariants}>
                    <Link
                      href={item.href}
                      className={cn(
                        "group relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
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
                      {item.label}
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          </div>
        ))}
      </motion.div>

      <div className="mt-auto pt-4 border-t border-border-subtle">
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          type="button"
          onClick={() => setCommandPaletteOpen(true)}
          aria-label="Search (⌘K)"
          className="flex w-full items-center gap-2.5 rounded-lg border border-border-subtle bg-base/50 px-3 py-2 text-sm font-medium text-secondary transition-all duration-150 hover:border-accent/30 hover:bg-base hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          <Search className="size-4 shrink-0" strokeWidth={1.75} />
          Search
          <kbd className="ml-auto rounded border border-border-subtle bg-elevated px-1.5 py-0.5 text-[10px] font-medium text-faint">
            ⌘K
          </kbd>
        </motion.button>
      </div>
    </nav>
  );
}
