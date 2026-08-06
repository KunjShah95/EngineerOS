import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { cn, slugify } from "@/lib/utils";

function childrenText(children: React.ReactNode): string {
  if (typeof children === "string") return children;
  if (typeof children === "number") return String(children);
  if (Array.isArray(children)) return children.map(childrenText).join("");
  if (children && typeof children === "object" && "props" in (children as React.ReactElement)) {
    return childrenText(((children as React.ReactElement).props as { children?: React.ReactNode })?.children ?? "");
  }
  return "";
}

/**
 * Convert [[Some Title]] wikilink tokens into markdown links. Passed a
 * resolver (title → href) so the renderer stays presentational — the caller
 * supplies the title index built from the knowledge graph. Unresolved
 * wikilinks stay literal so nothing silently disappears.
 */
function renderWikilinks(content: string, resolve: (title: string) => string | null): string {
  return content.replace(/\[\[([^\[\]]+)\]\]/g, (match, title: string) => {
    const href = resolve(title.trim());
    if (!href) return match;
    return `[${title.trim()}](${href})`;
  });
}

const components: Parameters<typeof ReactMarkdown>[0]["components"] = {
  h1: ({ children }) => (
    <h1 id={slugify(childrenText(children))} className="mt-6 mb-2 text-2xl font-semibold text-foreground scroll-mt-4">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 id={slugify(childrenText(children))} className="mt-6 mb-2 text-xl font-semibold text-foreground scroll-mt-4">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 id={slugify(childrenText(children))} className="mt-6 mb-2 text-base font-semibold text-foreground scroll-mt-4">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 id={slugify(childrenText(children))} className="mt-5 mb-2 text-sm font-semibold text-foreground scroll-mt-4">{children}</h4>
  ),
  p: ({ children }) => <p className="my-3 leading-relaxed text-foreground">{children}</p>,
  ul: ({ children }) => (
    <ul className="my-3 list-disc space-y-1 pl-6 text-foreground">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="my-3 list-decimal space-y-1 pl-6 text-foreground">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-accent underline-offset-2 transition-colors hover:text-accent-hover hover:underline"
    >
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-4 border-l-2 border-accent/50 pl-4 text-secondary">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-6 border-border-subtle" />,
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  em: ({ children }) => <em className="text-foreground">{children}</em>,
  del: ({ children }) => <del className="text-faint">{children}</del>,
  code: ({ className, children, ...props }) => {
    const isBlock = /language-/.test(className ?? "");
    if (isBlock) {
      return (
        <code
          className={cn("font-mono text-[13px] leading-5", className)}
          {...props}
        >
          {children}
        </code>
      );
    }
    return (
      <code
        className="rounded bg-surface-hover px-1.5 py-0.5 font-mono text-[12.5px] text-foreground"
        {...props}
      >
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="my-4 overflow-x-auto rounded-lg border border-border-subtle bg-base p-4 font-mono text-[13px] leading-5">
      {children}
    </pre>
  ),
  table: ({ children }) => (
    <div className="my-4 overflow-x-auto">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="text-secondary">{children}</thead>,
  th: ({ children }) => (
    <th className="border-b border-border-default px-3 py-2 text-left font-medium">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border-b border-border-subtle px-3 py-2 align-top">{children}</td>
  ),
  img: ({ src, alt }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt ?? ""} className="my-4 max-w-full rounded-lg" />
  ),
  input: ({ checked, type }) =>
    type === "checkbox" ? (
      <input
        type="checkbox"
        checked={checked}
        readOnly
        disabled
        className="mr-2 inline-block align-middle accent-[var(--accent)]"
      />
    ) : null,
};

export function MarkdownRenderer({
  content,
  resolveWikilink,
}: {
  content: string;
  /** Optional title→href resolver for [[wikilinks]] (knowledge graph). */
  resolveWikilink?: (title: string) => string | null;
}) {
  const body = resolveWikilink ? renderWikilinks(content, resolveWikilink) : content;
  return (
    <div className="markdown text-sm">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {body}
      </ReactMarkdown>
    </div>
  );
}
