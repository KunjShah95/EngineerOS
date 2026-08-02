"use client";

import {
  CalendarDays,
  CheckSquare,
  FileText,
  Hash,
  Link2,
  Pin,
  Search,
  Zap,
} from "lucide-react";

import { Reveal } from "@/components/marketing/reveal";
import { cn } from "@/lib/utils";

export function LandingFeatures() {
  return (
    <section id="features" className="relative py-28">
      <div className="mx-auto w-full max-w-6xl px-6">
        <Reveal>
          <p className="font-mono text-[11px] tracking-widest text-accent uppercase">
            The model
          </p>
          <h2 className="mt-4 max-w-2xl text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
            Six objects. Every artifact.
          </h2>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-secondary">
            EngineerOS is built on six core objects: User, Workspace, Project,
            Task, Note, and Daily Note. Everything else is derived from them,
            so nothing ever lives in a dead end.
          </p>
        </Reveal>

        <div className="mt-14 grid grid-cols-1 gap-4 md:grid-cols-6">
          <Reveal className="md:col-span-4" delay={0}>
            <FeatureCard
              icon={FileText}
              iconClass="text-accent bg-accent-muted"
              title="Notes that read like documents"
              body="Markdown in, rendered pages out. Headings, code blocks, tables, and task lists all styled the way your docs deserve."
              visual={<NotesVisual />}
            />
          </Reveal>

          <Reveal className="md:col-span-2" delay={0.06}>
            <FeatureCard
              icon={Search}
              iconClass="text-info bg-info/10"
              title="Search everything with Cmd K"
              body="Notes, tasks, projects, and tags in one palette. Type, hit Enter, move on."
              visual={<SearchVisual />}
            />
          </Reveal>

          <Reveal className="md:col-span-2" delay={0}>
            <FeatureCard
              icon={CheckSquare}
              iconClass="text-success bg-success/10"
              title="A kanban that keeps up"
              body="Drag cards between Backlog, Todo, In Progress, and Done. Positions persist, priorities stay visible."
              visual={<KanbanVisual />}
            />
          </Reveal>

          <Reveal className="md:col-span-2" delay={0.06}>
            <FeatureCard
              icon={CalendarDays}
              iconClass="text-warning bg-warning/10"
              title="A daily note that shows up"
              body="One note per day, auto-created on first visit. Morning goals, journal, wins, and problems, in a fixed order."
              visual={<DailyVisual />}
            />
          </Reveal>

          <Reveal className="md:col-span-2" delay={0.12}>
            <FeatureCard
              icon={Zap}
              iconClass="text-[#818cf8] bg-[#818cf8]/10"
              title="Projects that hold it together"
              body="Tasks, notes, timeline, and resources under one roof, with progress you can see at a glance."
              visual={<ProjectsVisual />}
            />
          </Reveal>

          <Reveal className="md:col-span-3" delay={0}>
            <FeatureCard
              icon={Zap}
              iconClass="text-accent bg-accent-muted"
              title="Capture before it evaporates"
              body="One dialog, two keystrokes. It becomes a note, a task, or sits in the inbox until you triage it."
              visual={<CaptureVisual />}
            />
          </Reveal>

          <Reveal className="md:col-span-3" delay={0.06}>
            <FeatureCard
              icon={Link2}
              iconClass="text-info bg-info/10"
              title="Everything is linkable"
              body="Link a note to a task. File a note under a project. The graph is already there waiting for you."
              visual={<LinkVisual />}
            />
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function FeatureCard({
  icon: Icon,
  iconClass,
  title,
  body,
  visual,
}: {
  icon: typeof FileText;
  iconClass: string;
  title: string;
  body: string;
  visual: React.ReactNode;
}) {
  return (
    <div className="group flex h-full flex-col rounded-xl border border-border-subtle bg-surface p-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] transition-colors duration-200 hover:border-accent/40">
      <div className="mb-4 flex items-center gap-3">
        <span className={cn("flex size-8 items-center justify-center rounded-lg", iconClass)}>
          <Icon className="size-4" strokeWidth={1.75} />
        </span>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      <p className="mb-5 text-sm leading-relaxed text-secondary">{body}</p>
      <div className="mt-auto">{visual}</div>
    </div>
  );
}

/* ---- Mini visuals (one micro-interaction each) ---- */

function NotesVisual() {
  return (
    <div className="rounded-lg border border-border-subtle bg-base p-3.5 transition-colors duration-200 group-hover:border-accent/30">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold text-foreground">Architecture notes</p>
        <Pin className="size-3 text-accent" strokeWidth={1.75} />
      </div>
      <pre className="mt-2 overflow-hidden rounded border border-border-subtle bg-elevated p-2 font-mono text-[9px] leading-relaxed text-secondary">
        <span className="text-faint">{"{ "}</span>
        <span className="text-accent">supabase</span>
        <span className="text-faint">: </span>
        <span className="text-success">&quot;postgres&quot;</span>
        <span className="text-faint">{" }"}</span>
        <br />
        <span className="text-faint">{"{ "}</span>
        <span className="text-accent">frontend</span>
        <span className="text-faint">: </span>
        <span className="text-success">&quot;next.js&quot;</span>
        <span className="text-faint">{" }"}</span>
      </pre>
      <div className="mt-2 flex gap-1.5">
        <span className="rounded bg-accent-muted px-1.5 py-0.5 text-[8px] font-medium text-accent">#architecture</span>
        <span className="rounded bg-accent-muted px-1.5 py-0.5 text-[8px] font-medium text-accent">#stack</span>
      </div>
    </div>
  );
}

function SearchVisual() {
  return (
    <div className="rounded-lg border border-border-subtle bg-base p-3 transition-colors duration-200 group-hover:border-accent/30">
      <div className="flex items-center gap-1.5 rounded border border-border-subtle bg-elevated px-2 py-1.5">
        <Search className="size-2.5 text-faint" strokeWidth={1.75} />
        <span className="text-[9px] text-faint">api design</span>
        <span className="ml-auto h-2 w-px animate-pulse bg-accent" />
      </div>
      <div className="mt-2 space-y-1">
        {[
          { icon: FileText, label: "API design notes", tint: "text-accent" },
          { icon: CheckSquare, label: "Design the task API", tint: "text-success" },
        ].map(({ icon: Icon, label, tint }) => (
          <div
            key={label}
            className="flex items-center gap-1.5 rounded px-1.5 py-1 text-[9px] text-secondary transition-colors duration-150 group-hover:bg-surface-hover"
          >
            <Icon className={cn("size-2.5", tint)} strokeWidth={1.75} />
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}

function KanbanVisual() {
  return (
    <div className="grid grid-cols-4 gap-1.5 rounded-lg border border-border-subtle bg-base p-3 transition-colors duration-200 group-hover:border-accent/30">
      {[
        { label: "BACKLOG", count: 3 },
        { label: "TODO", count: 2 },
        { label: "DOING", count: 1 },
        { label: "DONE", count: 4 },
      ].map((col) => (
        <div key={col.label} className="min-w-0">
          <p className="mb-1 truncate text-[7px] font-semibold tracking-wide text-faint uppercase">
            {col.label}
          </p>
          <div className="space-y-1">
            {Array.from({ length: col.count }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-3 rounded border border-border-subtle bg-surface",
                  col.label === "DONE" && "bg-surface/50"
                )}
              />
            ))}
            {col.label === "DOING" ? (
              <div className="h-3 animate-pulse rounded border border-accent/50 bg-accent/20" />
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function DailyVisual() {
  return (
    <div className="rounded-lg border border-border-subtle bg-base p-3 transition-colors duration-200 group-hover:border-accent/30">
      <div className="flex items-center gap-1.5">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <span
            key={i}
            className={cn(
              "flex size-5 items-center justify-center rounded text-[8px] font-medium",
              i === 2
                ? "bg-accent text-white"
                : "bg-surface-hover text-faint"
            )}
          >
            {d}
          </span>
        ))}
      </div>
      <div className="mt-2 space-y-1">
        {["Morning goals", "Journal", "Learned"].map((s, i) => (
          <div
            key={s}
            className={cn(
              "flex items-center gap-1.5 rounded px-1.5 py-1 text-[9px]",
              i === 0 ? "bg-surface-hover text-foreground" : "text-faint"
            )}
          >
            <span className="size-1 rounded-full bg-accent" />
            {s}
          </div>
        ))}
      </div>
    </div>
  );
}

function ProjectsVisual() {
  return (
    <div className="space-y-2 rounded-lg border border-border-subtle bg-base p-3 transition-colors duration-200 group-hover:border-accent/30">
      {[
        { name: "EngineerOS", color: "bg-accent", w: "70%", pct: "70%" },
        { name: "Research", color: "bg-[#60a5fa]", w: "40%", pct: "40%" },
      ].map((p) => (
        <div key={p.name}>
          <div className="mb-1 flex items-center justify-between text-[9px]">
            <span className="text-foreground">{p.name}</span>
            <span className="font-mono text-faint">{p.pct}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-hover">
            <div
              className={cn("h-full rounded-full transition-all duration-300", p.color)}
              style={{ width: p.w }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function CaptureVisual() {
  return (
    <div className="rounded-lg border border-border-subtle bg-base p-3 transition-colors duration-200 group-hover:border-accent/30">
      <div className="flex items-center gap-1.5 rounded border border-border-subtle bg-elevated px-2 py-1.5">
        <Zap className="size-2.5 text-accent" strokeWidth={1.75} />
        <span className="text-[9px] text-faint">ship the landing redesign</span>
      </div>
      <div className="mt-2 flex gap-1.5">
        <span className="rounded bg-accent px-2 py-0.5 text-[8px] font-medium text-white">Note</span>
        <span className="rounded bg-surface-hover px-2 py-0.5 text-[8px] font-medium text-secondary transition-colors duration-150 group-hover:bg-accent group-hover:text-white">
          Task
        </span>
        <span className="rounded bg-surface-hover px-2 py-0.5 text-[8px] font-medium text-secondary transition-colors duration-150 group-hover:bg-accent group-hover:text-white">
          Inbox
        </span>
      </div>
    </div>
  );
}

function LinkVisual() {
  return (
    <div className="rounded-lg border border-border-subtle bg-base p-3 transition-colors duration-200 group-hover:border-accent/30">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 rounded border border-border-subtle bg-elevated px-2 py-1 text-[9px] text-foreground">
          <CheckSquare className="size-2.5 text-success" strokeWidth={1.75} />
          Ship kanban
        </div>
        <Link2 className="size-3 text-accent transition-transform duration-200 group-hover:rotate-45" strokeWidth={1.75} />
        <div className="flex items-center gap-1.5 rounded border border-border-subtle bg-elevated px-2 py-1 text-[9px] text-foreground">
          <FileText className="size-2.5 text-accent" strokeWidth={1.75} />
          Drag spec
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Hash className="size-3 text-faint" strokeWidth={1.75} />
        {["#mvp", "#dnd"].map((t) => (
          <span key={t} className="rounded bg-accent-muted px-1.5 py-0.5 text-[8px] font-medium text-accent">
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}
