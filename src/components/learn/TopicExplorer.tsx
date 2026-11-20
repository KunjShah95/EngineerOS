"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check, Search } from "lucide-react";

import { ALL_TOPICS, TRACKS, type Level, type TrackId } from "@/content/learn";
import { searchTopics } from "@/lib/learn/search";
import { cn } from "@/lib/utils";
import { LevelMark, TrackTag } from "./ui";
import { useProgress } from "./use-progress";

const TRACK_LABEL = Object.fromEntries(TRACKS.map((t) => [t.id, t.title])) as Record<TrackId, string>;
const LEVEL_ORDER: Level[] = ["foundation", "intermediate", "advanced"];

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 font-mono text-[11px] tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
        active
          ? "border-foreground bg-foreground text-[color:var(--bg-base)]"
          : "border-border-subtle text-secondary hover:border-default hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

export function TopicExplorer({ initialTrack }: { initialTrack?: TrackId }) {
  const [query, setQuery] = useState("");
  const [track, setTrack] = useState<TrackId | "all">(initialTrack ?? "all");
  const [level, setLevel] = useState<Level | "all">("all");
  const { completed } = useProgress();

  const topics = useMemo(() => {
    const filters = {
      track: track === "all" ? undefined : track,
      level: level === "all" ? undefined : level,
    };
    if (query.trim().length >= 2) {
      const ids = searchTopics(query, { ...filters, limit: 25 }).map((h) => h.id);
      return ids.map((id) => ALL_TOPICS.find((t) => t.id === id)!).filter(Boolean);
    }
    const filtered = ALL_TOPICS.filter(
      (t) => (!filters.track || t.track === filters.track) && (!filters.level || t.level === filters.level)
    );
    // Inside one track, lessons are taught in a deliberate order. Keep it.
    if (filters.track) return filtered;
    return filtered.sort(
      (a, b) =>
        LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level) || a.title.localeCompare(b.title)
    );
  }, [query, track, level]);

  return (
    <div>
      <div className="flex flex-col gap-4">
        <label className="relative block">
          <span className="sr-only">Search topics</span>
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-faint" strokeWidth={1.75} />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search: rate limiting, RAG, idempotency, agents..."
            className="h-11 w-full rounded-lg border border-border-subtle bg-surface pr-3 pl-10 text-sm text-foreground placeholder:text-faint focus-visible:border-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          />
        </label>

        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filters">
          <Chip active={track === "all"} onClick={() => setTrack("all")}>All tracks</Chip>
          {TRACKS.map((t) => (
            <Chip key={t.id} active={track === t.id} onClick={() => setTrack(t.id)}>
              {t.title}
            </Chip>
          ))}
          <span aria-hidden className="mx-1 hidden h-4 w-px bg-border-subtle sm:block" />
          <Chip active={level === "all"} onClick={() => setLevel("all")}>Any level</Chip>
          {LEVEL_ORDER.map((l) => (
            <Chip key={l} active={level === l} onClick={() => setLevel(l)}>
              {l}
            </Chip>
          ))}
        </div>
      </div>

      <p className="figure-mono mt-6 text-[11px] tracking-wide text-faint" role="status" aria-live="polite">
        {topics.length} {topics.length === 1 ? "topic" : "topics"}
        {completed.size > 0 ? ` · ${completed.size} done` : ""}
      </p>

      {topics.length === 0 ? (
        <p className="mt-8 rounded-lg border border-dashed border-border-subtle p-8 text-center text-sm text-secondary">
          Nothing matches. Try a broader word like &ldquo;cache&rdquo; or &ldquo;agent&rdquo;.
        </p>
      ) : (
        <ul className="mt-3 grid gap-3 md:grid-cols-2">
          {topics.map((t) => {
            const done = completed.has(t.id);
            return (
              <li key={t.id}>
                <Link
                  href={`/learn/${t.track}/${t.id}`}
                  className="group flex h-full flex-col rounded-lg border border-border-subtle bg-surface p-5 transition-colors hover:border-default hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                >
                  <div className="flex items-center justify-between gap-3">
                    <TrackTag track={t.track} label={TRACK_LABEL[t.track]} />
                    {done ? (
                      <span className="inline-flex items-center gap-1 font-mono text-[10px] tracking-[0.12em] text-signal uppercase">
                        <Check className="size-3" strokeWidth={2.5} /> Done
                      </span>
                    ) : (
                      <span className="font-mono text-[10px] text-faint">{t.minutes} min</span>
                    )}
                  </div>
                  {t.module ? <p className="mt-3 font-mono text-[10px] tracking-[0.12em] text-faint uppercase">{t.module}</p> : null}
                  <h3 className={cn(t.module ? "mt-1" : "mt-3", "font-serif-display text-xl leading-snug tracking-[-0.01em] text-foreground")}>
                    {t.title}
                  </h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-secondary">{t.summary}</p>
                  <LevelMark level={t.level} className="mt-4" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
