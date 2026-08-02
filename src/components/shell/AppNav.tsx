"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
  Users,
  MessageSquareText,
} from "lucide-react";

import { useUiStore } from "@/lib/store/ui";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/notes", label: "Notes", icon: FileText },
  { href: "/daily", label: "Daily", icon: CalendarDays },
  { href: "/code", label: "Code", icon: Code2 },
  { href: "/bookmarks", label: "Bookmarks", icon: Bookmark },
  { href: "/reading", label: "Reading", icon: BookOpenText },
  { href: "/architecture", label: "Architecture", icon: Network },
  { href: "/meetings", label: "Meetings", icon: Users },
  { href: "/mindmap", label: "Mind map", icon: Network },
  { href: "/pdf-chat", label: "PDF chat", icon: MessageSquareText },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppNav() {
  const pathname = usePathname();
  const setCommandPaletteOpen = useUiStore((s) => s.setCommandPaletteOpen);

  return (
    <nav className="flex flex-1 flex-col gap-1 p-3" aria-label="Primary">
      {navItems.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-secondary transition-colors duration-150 hover:bg-surface-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
              active && "bg-surface-hover text-foreground"
            )}
          >
            <Icon className="size-4 shrink-0" strokeWidth={1.75} />
            {item.label}
          </Link>
        );
      })}

      <button
        type="button"
        onClick={() => setCommandPaletteOpen(true)}
        aria-label="Search (⌘K)"
        className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-secondary transition-colors duration-150 hover:bg-surface-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      >
        <Search className="size-4 shrink-0" strokeWidth={1.75} />
        Search
        <kbd className="ml-auto rounded border border-border-subtle bg-elevated px-1.5 py-0.5 text-[10px] font-medium text-faint">
          ⌘K
        </kbd>
      </button>
    </nav>
  );
}
