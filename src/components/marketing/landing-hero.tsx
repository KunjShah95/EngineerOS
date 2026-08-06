"use client";

import { useRef } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  CheckSquare,
  FileText,
  FolderKanban,
  LayoutDashboard,
  Search,
  Terminal,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

import { Button } from "@/components/ui/button";
import { ShaderCanvas } from "@/components/marketing/shader-canvas";

const EASE: [number, number, number, number] = [0.21, 0.47, 0.32, 0.98];

export function LandingHero() {
  const prefersReducedMotion = useReducedMotion();
  const frameRef = useRef<HTMLDivElement>(null);

  const animate = prefersReducedMotion ? undefined : "show";

  const handleSpotlight = (e: React.MouseEvent) => {
    const el = frameRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--spot-x", `${e.clientX - rect.left}px`);
    el.style.setProperty("--spot-y", `${e.clientY - rect.top}px`);
    el.style.setProperty("--spot-opacity", "1");
  };

  const clearSpotlight = () => {
    frameRef.current?.style.setProperty("--spot-opacity", "0");
  };

  return (
    <section className="relative overflow-hidden pt-24 pb-16 md:pt-36 md:pb-24">
      {/* Shader canvas — fills the whole section */}
      <ShaderCanvas className="pointer-events-none absolute inset-0 -z-20 h-full w-full" />

      {/* Bottom fade — blends shader into the page content below */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-40 bg-gradient-to-t from-[var(--bg-base)] to-transparent"
      />

      {/* Subtle center darkening so text stays crisp */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 [mask-image:radial-gradient(ellipse_55%_60%_at_50%_30%,black,transparent)] bg-[rgba(8,10,18,0.45)]"
      />

      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <motion.div
          initial={animate ? "hidden" : false}
          animate={animate ? "show" : undefined}
          variants={{
            hidden: { opacity: 0, y: 16 },
            show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE } },
          }}
          className="mx-auto max-w-3xl text-center"
        >
          {/* Glass pill badge */}
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 font-mono text-[11px] tracking-widest text-secondary uppercase backdrop-blur-sm">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60 motion-reduce:animate-none motion-reduce:opacity-40" />
              <span className="relative inline-flex size-1.5 rounded-full bg-success" />
            </span>
            AI-native · Semantic search · Knowledge graph
          </span>

          <h1 className="mt-7 font-display text-[clamp(2.2rem,5.5vw,3.75rem)] font-semibold leading-[1.08] tracking-tight text-foreground">
            Notes, tasks, projects and an AI
            that understands all of it.{" "}
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage: "linear-gradient(135deg, #a5b4fc 0%, #818cf8 30%, #4f46e5 60%, #7c3aed 100%)",
              }}
            >
              One system.
            </span>
          </h1>

          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-secondary">
            EngineerOS is an AI-native workspace that captures everything — notes,
            tasks, projects, and daily entries — in one connected system. It uses
            semantic search to find what you need, an AI assistant with citations
            to source notes, and a knowledge graph that reveals hidden connections.
            All data lives in your own Supabase project.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/register" className="w-full sm:w-auto">
              <Button
                size="lg"
                className="w-full shadow-[0_0_32px_-6px_var(--accent)] sm:w-auto"
              >
                Get started
                <ArrowRight className="size-4" strokeWidth={1.75} />
              </Button>
            </Link>
            <Link href="/login" className="w-full sm:w-auto">
              <Button variant="secondary" size="lg" className="w-full border-white/10 bg-white/5 backdrop-blur-sm hover:bg-white/10 sm:w-auto">
                Log in
              </Button>
            </Link>
          </div>

          <p className="mt-4 font-mono text-[11px] tracking-wide text-faint uppercase">
            Free to start · Your data, in your own Supabase project
          </p>
        </motion.div>

        {/* Mockup — gradient border frame */}
        <motion.div
          initial={animate ? "hidden" : false}
          animate={animate ? "show" : undefined}
          variants={{
            hidden: { opacity: 0, y: 28, scale: 0.985 },
            show: {
              opacity: 1,
              y: 0,
              scale: 1,
              transition: { duration: 0.7, delay: 0.22, ease: EASE },
            },
          }}
          className="relative mx-auto mt-10 max-w-4xl md:mt-16"
        >
          {/* Gradient border wrapper — bright at top, fades out at bottom */}
          <div
            className="rounded-xl p-px"
            style={{
              background: "linear-gradient(180deg, rgba(79,70,229,0.55) 0%, rgba(124,58,237,0.20) 40%, rgba(79,70,229,0.04) 100%)",
            }}
          >
            <div
              ref={frameRef}
              onMouseMove={handleSpotlight}
              onMouseLeave={clearSpotlight}
              className="relative overflow-hidden rounded-xl bg-elevated shadow-[0_24px_80px_-24px_rgba(0,0,0,0.75)]"
            >
              {/* Spotlight overlay */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 z-10 transition-opacity duration-300"
                style={{
                  opacity: "var(--spot-opacity, 0)",
                  background:
                    "radial-gradient(560px circle at var(--spot-x, 50%) var(--spot-y, 50%), rgba(79,70,229,0.16), transparent 55%)",
                }}
              />

              <DashboardMockup />
            </div>
          </div>

          {/* Reflection glow beneath the frame */}
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-x-8 -bottom-10 -z-10 h-28 bg-gradient-to-t from-[rgba(79,70,229,0.12)] to-transparent blur-2xl"
          />
        </motion.div>
      </div>
    </section>
  );
}

function DashboardMockup() {
  return (
    <div className="relative">
      {/* Window chrome */}
      <div className="flex items-center gap-2 border-b border-border-subtle bg-surface/60 px-4 py-2.5">
        <span className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-danger/70" />
          <span className="size-2.5 rounded-full bg-warning/70" />
          <span className="size-2.5 rounded-full bg-success/70" />
        </span>
        <span className="mx-auto rounded-md border border-border-subtle bg-base px-3 py-1 font-mono text-[10px] text-faint">
          engineeros.app/dashboard
        </span>
        <span className="w-10" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[148px_1fr]">
        {/* Mini sidebar */}
        <div className="hidden flex-col border-r border-border-subtle bg-surface/40 p-3 sm:flex">
          <div className="mb-4 flex items-center gap-1.5 px-1">
            <span className="flex size-4 items-center justify-center rounded bg-gradient-to-br from-[#4f46e5] to-[#7c3aed]">
              <Terminal className="size-2.5 text-white" strokeWidth={2} />
            </span>
            <span className="text-[10px] font-semibold text-foreground">EngineerOS</span>
          </div>
          {[
            { icon: LayoutDashboard, label: "Dashboard", active: true },
            { icon: FolderKanban, label: "Projects" },
            { icon: CheckSquare, label: "Tasks" },
            { icon: FileText, label: "Notes" },
            { icon: CalendarDays, label: "Daily" },
          ].map(({ icon: Icon, label, active }) => (
            <span
              key={label}
              className={
                "mb-0.5 flex items-center gap-1.5 rounded px-1.5 py-1 text-[10px] " +
                (active
                  ? "bg-surface-hover font-medium text-foreground"
                  : "text-faint")
              }
            >
              <Icon className="size-3" strokeWidth={1.75} />
              {label}
            </span>
          ))}
          <div className="mt-auto flex items-center gap-1.5 rounded px-1.5 py-1 text-[10px] text-faint">
            <span className="flex size-4 items-center justify-center rounded-full bg-accent-muted text-[8px] font-semibold text-accent">
              JD
            </span>
            jordan@engineeros.app
          </div>
        </div>

        {/* Main pane */}
        <div className="space-y-3 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-foreground">Good morning</p>
              <p className="font-mono text-[9px] text-faint">MON · AUG 3</p>
            </div>
            <span className="flex items-center gap-1 rounded border border-border-subtle bg-base px-2 py-1 font-mono text-[9px] text-faint">
              <Search className="size-2.5" strokeWidth={1.75} />
              SEARCH
              <span className="ml-1 rounded bg-surface-hover px-1">⌘K</span>
            </span>
          </div>

          <div className="rounded-lg border border-border-subtle bg-surface p-2.5">
            <p className="mb-1.5 text-[9px] font-semibold tracking-wide text-faint uppercase">
              Today&apos;s focus
            </p>
            <div className="space-y-1.5">
              {[
                { bar: "bg-danger", title: "Finish kanban drag and drop", due: "TODAY" },
                { bar: "bg-warning", title: "Ship onboarding flow", due: "TODAY" },
                { bar: "bg-warning", title: "Review PR #142", due: "FRI" },
              ].map((task) => (
                <div key={task.title} className="flex items-center gap-2">
                  <span className={"h-4 w-0.5 shrink-0 rounded-full " + task.bar} />
                  <span className="flex-1 truncate text-[10px] text-foreground">{task.title}</span>
                  <span className="font-mono text-[8px] text-faint">{task.due}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-border-subtle bg-surface p-2.5">
              <p className="mb-1.5 text-[9px] font-semibold tracking-wide text-faint uppercase">
                Today&apos;s tasks
              </p>
              <div className="space-y-1.5">
                {[
                  { done: true, label: "Ship kanban" },
                  { done: false, label: "Write daily note" },
                ].map((t) => (
                  <div key={t.label} className="flex items-center gap-1.5">
                    <span
                      className={
                        "flex size-3 items-center justify-center rounded-[3px] border " +
                        (t.done
                          ? "border-transparent bg-accent text-white"
                          : "border-border-default")
                      }
                    >
                      {t.done ? (
                        <svg viewBox="0 0 12 12" className="size-2" fill="none">
                          <path d="M2.5 6.5 5 9l4.5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                      ) : null}
                    </span>
                    <span
                      className={
                        "truncate text-[10px] " + (t.done ? "text-faint line-through" : "text-foreground")
                      }
                    >
                      {t.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-border-subtle bg-surface p-2.5">
              <p className="mb-1.5 text-[9px] font-semibold tracking-wide text-faint uppercase">
                Project progress
              </p>
              <div className="space-y-2">
                {[
                  { name: "EngineerOS", color: "bg-accent", pct: "62%", w: "62%" },
                  { name: "Portfolio", color: "bg-[#818cf8]", pct: "35%", w: "35%" },
                ].map((p) => (
                  <div key={p.name}>
                    <div className="mb-1 flex items-center justify-between text-[9px]">
                      <span className="text-foreground">{p.name}</span>
                      <span className="font-mono text-faint">{p.pct}</span>
                    </div>
                    <div className="h-1 overflow-hidden rounded-full bg-surface-hover">
                      <div className={"h-full rounded-full " + p.color} style={{ width: p.w }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
