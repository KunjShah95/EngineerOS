"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Terminal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { cn } from "@/lib/utils";

const links = [
  { href: "#features", label: "Features" },
  { href: "#product", label: "Product" },
  { href: "#cta", label: "Get started" },
];

export function MarketingNav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-200",
        scrolled
          ? "border-b border-border-subtle bg-base/80 backdrop-blur-md"
          : "border-b border-transparent bg-transparent"
      )}
    >
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
        <Link
          href="/"
          className="flex items-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 rounded-md"
          aria-label="EngineerOS home"
        >
          <span className="flex size-7 items-center justify-center rounded-md bg-gradient-to-br from-[#4f46e5] to-[#1e40af] text-white shadow-[0_0_20px_-6px_var(--accent)]">
            <Terminal className="size-4" strokeWidth={2} />
          </span>
          <span className="text-sm font-semibold tracking-tight text-foreground">
            EngineerOS
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Sections">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-secondary transition-colors duration-150 hover:bg-surface-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-1.5">
          <ThemeToggle />
          <Link href="/login" className="hidden sm:block">
            <Button variant="ghost" size="sm">
              Log in
            </Button>
          </Link>
          <Link href="/register">
            <Button size="sm">
              Get started
              <ArrowRight className="size-4" strokeWidth={1.75} />
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
