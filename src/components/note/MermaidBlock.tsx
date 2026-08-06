"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";

import { useThemeStore } from "@/lib/store/theme";

/**
 * Renders a ```mermaid code block to an SVG on the client. Mermaid is loaded
 * lazily so the note editor bundle stays lean. Renders as a plain code block
 * when mermaid is unavailable or the diagram fails to parse.
 */
export function MermaidBlock({ code }: { code: string }) {
  const theme = useThemeStore((s) => s.theme);
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: theme === "dark" ? "dark" : "default",
          securityLevel: "strict",
          fontFamily: "var(--font-inter), Inter, ui-sans-serif, system-ui, sans-serif",
        });
        const id = `mmd-${Math.random().toString(36).slice(2)}`;
        const result = await mermaid.render(id, code);
        const svgText = typeof result === "string" ? result : result.svg;
        if (!cancelled) {
          setSvg(svgText);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code, theme]);

  if (error) {
    return (
      <div className="my-4 overflow-x-auto rounded-lg border border-danger/30 bg-danger/5 p-4">
        <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-danger">
          <AlertTriangle className="size-3.5" strokeWidth={1.75} />
          Couldn&apos;t render diagram
        </p>
        <pre className="overflow-x-auto font-mono text-[13px] leading-5 text-secondary">{code}</pre>
      </div>
    );
  }

  if (!svg) {
    return (
      <div className="my-4 flex h-24 items-center justify-center gap-2 rounded-lg border border-border-subtle bg-surface text-xs text-faint">
        <Loader2 className="size-3.5 animate-spin" strokeWidth={1.75} />
        Rendering diagram…
      </div>
    );
  }

  return (
    <div
      className="my-4 flex justify-center overflow-x-auto rounded-lg border border-border-subtle bg-surface px-4 py-3 [&_svg]:max-w-none"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
