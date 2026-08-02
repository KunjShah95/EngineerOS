"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Menu, Terminal, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

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
  const [mobileOpen, setMobileOpen] = useState(false);

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
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link
            href="/"
            className="flex items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            aria-label="EngineerOS home"
          >
            <span className="flex size-7 items-center justify-center rounded-md bg-gradient-to-br from-[#4f46e5] to-[#1e40af] text-white shadow-[0_0_20px_-6px_var(--accent)]">
              <Terminal className="size-4" strokeWidth={2} />
            </span>
            <span className="text-sm font-semibold tracking-tight text-foreground">
              EngineerOS
            </span>
          </Link>

          {/* Desktop nav */}
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
            <Link href="/register" className="hidden md:block">
              <Button size="sm">
                Get started
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
                <a
                  key={link.href}
                  href={link.href}
                  onClick={closeMobile}
                  className="rounded-md px-3 py-2.5 text-sm font-medium text-secondary transition-colors duration-150 hover:bg-surface-hover hover:text-foreground"
                >
                  {link.label}
                </a>
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
                  Get started
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
