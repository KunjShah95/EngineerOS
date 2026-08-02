import Link from "next/link";
import { Terminal } from "lucide-react";

const productLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/projects", label: "Projects" },
  { href: "/notes", label: "Notes" },
  { href: "/tasks", label: "Tasks" },
  { href: "/daily", label: "Daily" },
  { href: "/settings", label: "Settings" },
];

const sections = [
  { href: "#features", label: "Features" },
  { href: "#product", label: "Product" },
  { href: "#cta", label: "Get started" },
];

export function MarketingFooter() {
  return (
    <footer className="border-t border-border-subtle bg-surface/40">
      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 md:py-14">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <Link href="/" className="flex items-center gap-2.5" aria-label="EngineerOS home">
              <span className="flex size-7 items-center justify-center rounded-md bg-gradient-to-br from-[#4f46e5] to-[#1e40af] text-white">
                <Terminal className="size-4" strokeWidth={2} />
              </span>
              <span className="text-sm font-semibold tracking-tight text-foreground">
                EngineerOS
              </span>
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-secondary">
              An AI-native workspace for engineers, researchers, and builders.
              Notes, tasks, projects, and daily notes in one connected system.
            </p>
          </div>

          <div>
            <p className="mb-3 font-mono text-[10px] tracking-widest text-faint uppercase">
              Product
            </p>
            <ul className="space-y-2">
              {productLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-secondary transition-colors duration-150 hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="mb-3 font-mono text-[10px] tracking-widest text-faint uppercase">
              Project
            </p>
            <ul className="space-y-2">
              {sections.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="text-sm text-secondary transition-colors duration-150 hover:text-foreground"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
              <li>
                <span className="inline-flex items-center gap-2 text-sm text-secondary">
                  <span className="relative flex size-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
                    <span className="relative inline-flex size-1.5 rounded-full bg-success" />
                  </span>
                  All systems operational
                </span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-border-subtle pt-6 sm:flex-row">
          <p className="text-xs text-faint">© 2026 EngineerOS</p>
          <p className="font-mono text-[10px] tracking-wide text-faint uppercase">
            Built with Next.js · Supabase · Inter
          </p>
        </div>
      </div>
    </footer>
  );
}
