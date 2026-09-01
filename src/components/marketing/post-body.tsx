import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Renders long-form post markdown with the marketing type system:
 * serif display for headings, sans for body, mono for code.
 */
export function PostBody({ markdown }: { markdown: string }) {
  return (
    <div className="mt-12 space-y-6">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h2: ({ children }) => (
            <h2 className="mt-14 font-serif-display text-[clamp(1.5rem,3vw,1.95rem)] font-normal leading-[1.15] tracking-[-0.015em] text-foreground">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mt-10 font-display text-lg font-semibold tracking-tight text-foreground">
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p className="text-[16.5px] leading-[1.75] text-secondary">{children}</p>
          ),
          ul: ({ children }) => (
            <ul className="space-y-2.5 pl-5 text-[16.5px] leading-[1.75] text-secondary marker:text-faint [&>li]:list-disc">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="space-y-2.5 pl-5 text-[16.5px] leading-[1.75] text-secondary marker:font-mono marker:text-faint [&>li]:list-decimal">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="pl-1.5">{children}</li>,
          strong: ({ children }) => (
            <strong className="font-semibold text-foreground">{children}</strong>
          ),
          em: ({ children }) => <em className="italic">{children}</em>,
          a: ({ href, children }) => (
            <a
              href={href}
              className="text-[color:var(--hero-mint)] underline decoration-[color:var(--hero-mint)]/30 underline-offset-2 transition-colors hover:decoration-[color:var(--hero-mint)]"
            >
              {children}
            </a>
          ),
          code: ({ children }) => (
            <code className="rounded border border-border-subtle bg-surface px-1.5 py-0.5 font-mono text-[0.85em] text-foreground">
              {children}
            </code>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-border-default pl-5 text-secondary italic">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="border-border-subtle" />,
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
