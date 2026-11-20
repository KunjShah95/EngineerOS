import { cn } from "@/lib/utils";

/** The product mark: a prompt. One glyph, used everywhere the logo appears. */
export function BrandMark({ size = "md", className }: { size?: "md" | "lg"; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "figure-mono flex shrink-0 items-center justify-center rounded border border-border-subtle bg-surface leading-none text-signal",
        size === "lg" ? "size-11 text-lg" : "size-7 text-[13px]",
        className
      )}
    >
      &gt;_
    </span>
  );
}
