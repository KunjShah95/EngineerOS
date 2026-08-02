"use client";

import {
  CalendarDays,
  CheckSquare,
  FileText,
  GitFork,
  Hash,
  Link2,
  MessageSquareText,
  Pin,
  Search,
  Sparkles,
  Workflow,
  Zap,
} from "lucide-react";

import { Reveal } from "@/components/marketing/reveal";
import { cn } from "@/lib/utils";

export function LandingFeatures() {
  return (
    <section id="features" className="relative py-28">
      <div className="mx-auto w-full max-w-6xl px-6">
        <Reveal className="text-center">
          <p className="font-mono text-[11px] tracking-widest text-accent uppercase">
            The model
          </p>
          <h2 className="mx-auto mt-4 max-w-2xl text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
            Six objects. Every artifact.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-secondary">
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

        {/* AI Layer */}
        <Reveal className="mt-20 text-center">
          <div className="flex items-center gap-4">
            <div className="h-px flex-1 bg-border-subtle" />
            <span className="font-mono text-[11px] tracking-widest text-accent uppercase">
              AI Layer
            </span>
            <div className="h-px flex-1 bg-border-subtle" />
          </div>
          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-secondary">
            Every note and task is indexed automatically. Ask questions in plain
            English, follow citations back to the source, and watch your
            knowledge graph grow as you write.
          </p>
        </Reveal>

        <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-6">
          <Reveal className="md:col-span-3" delay={0}>
            <FeatureCard
              icon={Search}
              iconClass="text-accent bg-accent-muted"
              title="Semantic search, not just keywords"
              body="Ask in plain English. The index finds the right note even when you don't remember the exact words."
              visual={<SemanticVisual />}
            />
          </Reveal>

          <Reveal className="md:col-span-3" delay={0.06}>
            <FeatureCard
              icon={MessageSquareText}
              iconClass="text-[#818cf8] bg-[#818cf8]/10"
              title="AI assistant with citations"
              body="Ask questions about your workspace and get grounded answers with links back to the exact notes they came from."
              visual={<AssistantVisual />}
            />
          </Reveal>

          <Reveal className="md:col-span-3" delay={0}>
            <FeatureCard
              icon={GitFork}
              iconClass="text-info bg-info/10"
              title="Knowledge graph"
              body="See how your notes connect via wikilinks and task links. Filter by project, drag nodes, and discover hidden relationships."
              visual={<GraphVisual />}
            />
          </Reveal>

          <Reveal className="md:col-span-3" delay={0.06}>
            <FeatureCard
              icon={Workflow}
              iconClass="text-success bg-success/10"
              title="Automation rules"
              body="Recurring tasks create themselves. Quick captures auto-triage by keyword. Yesterday's unfinished work rolls over to today."
              visual={<AutomationVisual />}
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

function SemanticVisual() {
  return (
    <div className="rounded-lg border border-border-subtle bg-base p-3 transition-colors duration-200 group-hover:border-accent/30">
      <div className="flex items-center gap-1.5 rounded border border-border-subtle bg-elevated px-2 py-1.5">
        <Sparkles className="size-2.5 text-accent" strokeWidth={1.75} />
        <span className="text-[9px] text-faint">how does auth work?</span>
        <span className="ml-auto h-2 w-px animate-pulse bg-accent" />
      </div>
      <div className="mt-2 space-y-1">
        {[
          { label: "Supabase auth setup notes", score: "0.94", kind: "note" },
          { label: "Auth middleware task", score: "0.87", kind: "task" },
          { label: "JWT refresh flow", score: "0.81", kind: "note" },
        ].map(({ label, score, kind }) => (
          <div key={label} className="flex items-center gap-1.5 rounded px-1.5 py-1 text-[9px] text-secondary transition-colors duration-150 group-hover:bg-surface-hover">
            {kind === "note"
              ? <FileText className="size-2.5 text-accent shrink-0" strokeWidth={1.75} />
              : <CheckSquare className="size-2.5 text-success shrink-0" strokeWidth={1.75} />
            }
            <span className="flex-1 truncate">{label}</span>
            <span className="font-mono text-[8px] text-faint">{score}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AssistantVisual() {
  return (
    <div className="space-y-2 rounded-lg border border-border-subtle bg-base p-3 transition-colors duration-200 group-hover:border-accent/30">
      <div className="flex justify-end">
        <span className="max-w-[80%] rounded-lg bg-accent-muted px-2 py-1.5 text-[9px] text-accent">
          How do I structure a new feature?
        </span>
      </div>
      <div className="flex items-start gap-1.5">
        <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded bg-gradient-to-br from-[#4f46e5] to-[#1e40af]">
          <Sparkles className="size-2.5 text-white" strokeWidth={2} />
        </span>
        <div className="rounded-lg border border-border-subtle bg-surface px-2 py-1.5 text-[9px] leading-relaxed text-foreground">
          Start with the data model, then the API route, then the hook…
          <div className="mt-1.5 flex items-center gap-1">
            <FileText className="size-2.5 text-accent" strokeWidth={1.75} />
            <span className="font-mono text-[8px] text-accent">Architecture notes</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function GraphVisual() {
  return (
    <div className="rounded-lg border border-border-subtle bg-base p-3 transition-colors duration-200 group-hover:border-accent/30">
      <svg viewBox="0 0 120 64" className="w-full" aria-hidden>
        {/* edges */}
        <line x1="60" y1="32" x2="22" y2="14" stroke="var(--border-default)" strokeWidth="1" />
        <line x1="60" y1="32" x2="98" y2="14" stroke="var(--border-default)" strokeWidth="1" />
        <line x1="60" y1="32" x2="22" y2="50" stroke="var(--border-default)" strokeWidth="1" />
        <line x1="60" y1="32" x2="98" y2="50" stroke="var(--border-default)" strokeWidth="1" className="transition-all duration-300 group-hover:stroke-accent/50" />
        <line x1="22" y1="14" x2="98" y2="14" stroke="var(--border-subtle)" strokeWidth="0.75" strokeDasharray="3 2" />
        {/* center node */}
        <circle cx="60" cy="32" r="6" fill="var(--accent)" opacity="0.9" />
        {/* leaf nodes */}
        <circle cx="22" cy="14" r="4" fill="var(--bg-elevated)" stroke="var(--border-default)" strokeWidth="1" />
        <circle cx="98" cy="14" r="4" fill="var(--bg-elevated)" stroke="var(--border-default)" strokeWidth="1" />
        <circle cx="22" cy="50" r="4" fill="var(--bg-elevated)" stroke="var(--border-default)" strokeWidth="1" />
        <circle cx="98" cy="50" r="4" fill="var(--bg-elevated)" stroke="var(--accent)" strokeWidth="1" className="transition-all duration-300 group-hover:fill-accent/20" />
        {/* labels */}
        <text x="60" y="32" textAnchor="middle" dominantBaseline="central" fontSize="4" fill="white" fontWeight="600">OS</text>
        <text x="22" y="14" textAnchor="middle" dominantBaseline="central" fontSize="3.5" fill="var(--text-secondary)">Auth</text>
        <text x="98" y="14" textAnchor="middle" dominantBaseline="central" fontSize="3.5" fill="var(--text-secondary)">API</text>
        <text x="22" y="50" textAnchor="middle" dominantBaseline="central" fontSize="3.5" fill="var(--text-secondary)">DB</text>
        <text x="98" y="50" textAnchor="middle" dominantBaseline="central" fontSize="3.5" fill="var(--text-accent)">Tasks</text>
      </svg>
      <div className="mt-1 flex gap-2 text-[8px] text-faint">
        <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-accent inline-block" />note link</span>
        <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-info inline-block" />task link</span>
        <span className="flex items-center gap-1"><span className="h-px w-3 border-t border-dashed border-border-default inline-block" />wikilink</span>
      </div>
    </div>
  );
}

function AutomationVisual() {
  return (
    <div className="space-y-2 rounded-lg border border-border-subtle bg-base p-3 transition-colors duration-200 group-hover:border-accent/30">
      {[
        { label: "Daily standup", cadence: "Daily", color: "bg-accent" },
        { label: "Weekly review", cadence: "Weekly", color: "bg-info" },
      ].map((rule) => (
        <div key={rule.label} className="flex items-center gap-2 rounded border border-border-subtle bg-surface px-2 py-1.5">
          <span className={cn("size-1.5 shrink-0 rounded-full", rule.color)} />
          <span className="flex-1 truncate text-[9px] text-foreground">{rule.label}</span>
          <span className="rounded bg-surface-hover px-1.5 py-0.5 font-mono text-[7px] text-faint">{rule.cadence}</span>
        </div>
      ))}
      <div className="flex items-center gap-1.5 rounded border border-dashed border-success/40 bg-success/5 px-2 py-1.5">
        <Zap className="size-2.5 shrink-0 text-success" strokeWidth={1.75} />
        <span className="text-[9px] text-success">2 tasks created · rollover done</span>
      </div>
    </div>
  );
}
