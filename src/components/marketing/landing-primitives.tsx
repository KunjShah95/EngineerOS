import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "figure-mono flex size-7 shrink-0 items-center justify-center rounded-md border border-border-subtle bg-surface text-[13px] leading-none text-signal",
        className
      )}
    >
      <span aria-hidden>&gt;_</span>
    </span>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="text-sm font-semibold tracking-[-0.01em] text-foreground">
        EngineerOS
      </span>
    </span>
  );
}

export function SectionShell({
  id,
  children,
  className,
  bordered = false,
  wide = false,
}: {
  id?: string;
  children: React.ReactNode;
  className?: string;
  bordered?: boolean;
  wide?: boolean;
}) {
  return (
    <section
      id={id}
      className={cn(
        "relative py-20 md:py-28",
        bordered && "border-y border-border-subtle",
        className
      )}
    >
      <div
        className={cn(
          "mx-auto w-full px-5 sm:px-6 lg:px-8",
          wide ? "max-w-[1320px]" : "max-w-[1180px]"
        )}
      >
        {children}
      </div>
    </section>
  );
}

export function SectionIntro({
  title,
  body,
  align = "split",
  className,
}: {
  title: React.ReactNode;
  body?: React.ReactNode;
  align?: "split" | "center";
  className?: string;
}) {
  if (align === "center") {
    return (
      <div className={cn("mx-auto max-w-3xl text-center", className)}>
        <h2 className="text-balance text-[clamp(2rem,4vw,3.25rem)] font-semibold leading-[1.04] tracking-[-0.035em] text-foreground">
          {title}
        </h2>
        {body ? (
          <p className="mx-auto mt-5 max-w-[52ch] text-[15px] leading-relaxed text-secondary md:text-base">
            {body}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "grid gap-5 md:grid-cols-12 md:items-end md:gap-8",
        className
      )}
    >
      <h2 className="text-balance text-[clamp(2rem,4vw,3.25rem)] font-semibold leading-[1.04] tracking-[-0.035em] text-foreground md:col-span-7">
        {title}
      </h2>
      {body ? (
        <p className="max-w-[46ch] text-[15px] leading-relaxed text-secondary md:col-span-5 md:justify-self-end md:text-base">
          {body}
        </p>
      ) : null}
    </div>
  );
}

export function ArrowLink({
  href,
  children,
  external = false,
  className,
}: {
  href: string;
  children: React.ReactNode;
  external?: boolean;
  className?: string;
}) {
  const classes = cn(
    "group inline-flex items-center gap-1.5 rounded-sm text-sm font-medium text-foreground underline-offset-4 transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
    className
  );
  const inner = (
    <>
      {children}
      <ArrowUpRight
        aria-hidden
        className="size-3.5 text-faint transition-transform duration-150 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
        strokeWidth={1.75}
      />
    </>
  );

  return external ? (
    <a href={href} target="_blank" rel="noreferrer" className={classes}>
      {inner}
    </a>
  ) : (
    <Link href={href} className={classes}>
      {inner}
    </Link>
  );
}
