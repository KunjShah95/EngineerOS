"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyBlock({ code, label }: { code: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard blocked: the text is still selectable in the block.
    }
  };

  return (
    <div className="overflow-hidden rounded-lg border border-border-subtle bg-elevated">
      <div className="flex items-center justify-between border-b border-border-subtle px-4 py-2">
        <span className="font-mono text-[10px] tracking-[0.16em] text-faint uppercase">{label}</span>
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1.5 rounded px-2 py-1 font-mono text-[11px] text-secondary transition-colors hover:bg-surface-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          aria-label={`Copy ${label}`}
        >
          {copied ? <Check className="size-3.5 text-signal" strokeWidth={2} /> : <Copy className="size-3.5" strokeWidth={1.75} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-[12px] leading-relaxed text-foreground" tabIndex={0}>
        <code>{code}</code>
      </pre>
      <span role="status" aria-live="polite" className="sr-only">
        {copied ? "Copied to clipboard" : ""}
      </span>
    </div>
  );
}
