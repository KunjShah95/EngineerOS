"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Terminal } from "lucide-react";
import { useReducedMotion } from "motion/react";

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

/** Glyphs the scramble cycles through — box-drawing and shell punctuation. */
const GLYPHS = "▚▞░▒▓/\\|<>_-=+*#";

/**
 * Resolves text left-to-right, randomizing the unresolved tail.
 * Returns the visual string plus the trigger the link binds to.
 */
function useScramble(text: string) {
  const prefersReducedMotion = useReducedMotion();
  const [display, setDisplay] = useState(text);
  const timer = useRef<number | null>(null);

  const stop = () => {
    if (timer.current !== null) {
      window.clearInterval(timer.current);
      timer.current = null;
    }
  };

  // Clear any in-flight interval on unmount.
  useEffect(() => stop, []);

  const start = () => {
    if (prefersReducedMotion) return;
    stop();
    let resolved = 0;

    timer.current = window.setInterval(() => {
      setDisplay(
        text
          .split("")
          .map((ch, i) => {
            if (ch === " ") return " ";
            if (i < resolved) return ch;
            return GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
          })
          .join("")
      );

      resolved += 0.5;
      if (resolved >= text.length) {
        stop();
        setDisplay(text);
      }
    }, 28);
  };

  return { display, start };
}

function FooterLink({
  href,
  label,
  external,
}: {
  href: string;
  label: string;
  external?: boolean;
}) {
  const { display, start } = useScramble(label);

  const className =
    "inline-block font-mono text-[13px] text-secondary transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40";

  // Real label stays in the accessibility tree; only the visual layer scrambles.
  const inner = (
    <>
      <span className="sr-only">{label}</span>
      <span aria-hidden>{display}</span>
    </>
  );

  return external ? (
    <a href={href} className={className} onMouseEnter={start} onFocus={start}>
      {inner}
    </a>
  ) : (
    <Link href={href} className={className} onMouseEnter={start} onFocus={start}>
      {inner}
    </Link>
  );
}

export function MarketingFooter() {
  return (
    <footer className="relative overflow-hidden border-t border-border-subtle bg-surface/40">
      {/* Blueprint grid — same ground as the hero and the closing CTA */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_80%_90%_at_50%_0%,black,transparent)]"
        style={{
          backgroundImage:
            "linear-gradient(to right, color-mix(in oklab, var(--border-subtle) 70%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in oklab, var(--border-subtle) 70%, transparent) 1px, transparent 1px)",
          backgroundSize: "72px 72px",
        }}
      />

      <div className="relative mx-auto w-full max-w-6xl px-4 pt-10 sm:px-6 md:pt-14">
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
            <p className="mb-3 font-mono text-[10px] tracking-[0.18em] text-faint uppercase">
              Product
            </p>
            <ul className="space-y-2">
              {productLinks.map((link) => (
                <li key={link.href}>
                  <FooterLink href={link.href} label={link.label} />
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="mb-3 font-mono text-[10px] tracking-[0.18em] text-faint uppercase">
              Project
            </p>
            <ul className="space-y-2">
              {sections.map((link) => (
                <li key={link.href}>
                  <FooterLink href={link.href} label={link.label} external />
                </li>
              ))}
              <li className="pt-1">
                <span className="inline-flex items-center gap-2 font-mono text-[13px] text-secondary">
                  <span className="relative flex size-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60 motion-reduce:animate-none" />
                    <span className="relative inline-flex size-1.5 rounded-full bg-success" />
                  </span>
                  All systems operational
                </span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-border-subtle pt-6 sm:flex-row">
          <p className="flex items-center gap-1.5 font-mono text-[11px] text-faint">
            © 2026 EngineerOS
            <span
              aria-hidden
              className="inline-block h-3 w-[6px] bg-[color:var(--hero-mint)] motion-safe:animate-pulse"
            />
          </p>
          <p className="font-mono text-[10px] tracking-[0.14em] text-faint uppercase">
            Built with Next.js · Supabase · Tailwind
          </p>
        </div>

        {/* Wordmark anchoring the page, clipped by the bottom edge */}
        <p
          aria-hidden
          className="pointer-events-none mt-8 translate-y-[22%] select-none text-center font-serif-display text-[clamp(3.5rem,17vw,13rem)] leading-none tracking-[-0.045em] text-[color:color-mix(in_oklab,var(--text-primary)_7%,transparent)]"
        >
          EngineerOS
        </p>
      </div>
    </footer>
  );
}
