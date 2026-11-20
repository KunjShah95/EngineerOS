import { cn } from "@/lib/utils";
import type { Level, TrackId } from "@/content/learn";

const LEVELS: Record<Level, { dots: number; label: string }> = {
  foundation: { dots: 1, label: "Foundation" },
  intermediate: { dots: 2, label: "Intermediate" },
  advanced: { dots: 3, label: "Advanced" },
};

export function LevelMark({ level, className }: { level: Level; className?: string }) {
  const { dots, label } = LEVELS[level];
  return (
    <span className={cn("inline-flex items-center gap-1.5 font-mono text-[10px] tracking-[0.12em] text-faint uppercase", className)}>
      <span aria-hidden className="flex gap-0.5">
        {[1, 2, 3].map((i) => (
          <span key={i} className={cn("size-1.5 rounded-full", i <= dots ? "bg-secondary" : "bg-border-subtle")} />
        ))}
      </span>
      {label}
    </span>
  );
}

export const TRACK_STYLE: Record<TrackId, { text: string; border: string; dot: string; fill: string }> = {
  "system-design": {
    text: "text-accent-hover",
    border: "border-accent-hover/50",
    dot: "bg-accent-hover",
    fill: "var(--accent-hover)",
  },
  "ai-engineering": {
    text: "text-warning",
    border: "border-warning/50",
    dot: "bg-warning",
    fill: "var(--warning)",
  },
  "rag-engineering": {
    text: "text-[color:var(--track-rag)]",
    border: "border-[color:var(--track-rag)]/50",
    dot: "bg-[color:var(--track-rag)]",
    fill: "var(--track-rag)",
  },
};

export function TrackTag({ track, label }: { track: TrackId; label: string }) {
  const s = TRACK_STYLE[track];
  return (
    <span className={cn("inline-flex items-center gap-1.5 font-mono text-[10px] tracking-[0.14em] uppercase", s.text)}>
      <span aria-hidden className={cn("size-1.5 rounded-full", s.dot)} />
      {label}
    </span>
  );
}
