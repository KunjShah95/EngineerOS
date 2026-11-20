"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, Menu, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import { BrandMark } from "@/components/brand/BrandMark";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { cn } from "@/lib/utils";

/**
 * Four destinations, in the order a visitor decides: what you teach, how it
 * connects, what it costs, and how to use it from an agent. Everything else
 * (blog, comparisons, legal) lives in the footer.
 */
const links = [
  { href: "/learn", label: "Learn" },
  { href: "/map", label: "Map" },
  { href: "/pricing", label: "Pricing" },
  { href: "/connect", label: "For agents" },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

export function MarketingNav() {
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  // The menu is open only for the route it was opened on, so navigating closes it.
  const [openAt, setOpenAt] = useState<string | null>(null);
  const mobileOpen = openAt === pathname;
  const setMobileOpen = (next: boolean | ((v: boolean) => boolean)) => {
    const value = typeof next === "function" ? next(mobileOpen) : next;
    setOpenAt(value ? pathname : null);
  };

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  const closeMobile = () => setMobileOpen(false);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenAt(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  return (
    <>
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-50 transition-all duration-200",
          scrolled
            ? "border-b border-border-subtle bg-base/80 backdrop-blur-md"
            : "border-b border-transparent bg-transparent"
        )}
      >
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center px-4 sm:px-6">
          <Link
            href="/"
            className="flex items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            aria-label="EngineerOS home"
          >
            {/* A prompt, not a logo blob. The product is a tool you type into,
                so the mark is the one glyph that says so — and it costs nothing
                where a gradient chip with a glow would. */}
            <BrandMark />
            <span className="text-sm font-semibold tracking-tight text-foreground">
              EngineerOS
            </span>
          </Link>

          <nav className="ml-10 hidden flex-1 items-center gap-1 md:flex" aria-label="Sections">
            {links.map((link) => {
              const active = isActive(pathname, link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative rounded-md px-3 py-2 text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                    active ? "text-foreground" : "text-secondary hover:text-foreground"
                  )}
                >
                  {link.label}
                  {active ? (
                    <span aria-hidden className="absolute inset-x-3 -bottom-px h-px bg-[color:var(--accent)]" />
                  ) : null}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-1.5">
            <ThemeToggle />
            <Link href="/login" className="hidden sm:block">
              <Button variant="ghost" size="sm">
                Log in
              </Button>
            </Link>
            <Link href="/register" className="hidden md:block">
              <Button size="sm">
                Start free
                <ArrowRight className="size-4" strokeWidth={1.75} />
              </Button>
            </Link>
            {/* Mobile hamburger */}
            <button
              className="flex size-9 items-center justify-center rounded-md text-secondary transition-colors hover:bg-surface-hover hover:text-foreground md:hidden"
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              onClick={() => setMobileOpen((v) => !v)}
            >
              {mobileOpen ? <X className="size-5" strokeWidth={1.75} /> : <Menu className="size-5" strokeWidth={1.75} />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile slide-down menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            key="mobile-nav"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="fixed inset-x-0 top-16 z-40 border-b border-border-subtle bg-base/95 px-4 pb-5 pt-4 shadow-xl backdrop-blur-md md:hidden"
          >
            <nav className="flex flex-col gap-1" aria-label="Mobile sections">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={closeMobile}
                  aria-current={isActive(pathname, link.href) ? "page" : undefined}
                  className={cn(
                    "rounded-md px-3 py-3 text-base transition-colors duration-150 hover:bg-surface-hover",
                    isActive(pathname, link.href) ? "text-foreground" : "text-secondary"
                  )}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
            <div className="mt-4 flex flex-col gap-2 border-t border-border-subtle pt-4">
              <Link href="/login" onClick={closeMobile}>
                <Button variant="secondary" size="sm" className="w-full">
                  Log in
                </Button>
              </Link>
              <Link href="/register" onClick={closeMobile}>
                <Button size="sm" className="w-full">
                  Start free
                  <ArrowRight className="size-4" strokeWidth={1.75} />
                </Button>
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
