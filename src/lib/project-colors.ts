// Project accent colors (hex) — used for cards, kanban chips, and timeline dots.
export const PROJECT_COLORS = [
  "#6366f1", // indigo
  "#3b82f6", // blue
  "#06b6d4", // cyan
  "#22c55e", // green
  "#eab308", // amber
  "#f97316", // orange
  "#ef4444", // red
  "#ec4899", // pink
  "#8b5cf6", // violet
  "#64748b", // slate
] as const;

export function projectColorStyle(color: string | null | undefined) {
  return color ? { backgroundColor: color } : undefined;
}
