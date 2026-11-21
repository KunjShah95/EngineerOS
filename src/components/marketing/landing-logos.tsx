const STACK = [
  "GitHub",
  "Supabase",
  "OpenAI",
  "Anthropic",
  "Gemini",
  "Mistral",
  "Groq",
];

/**
 * A quiet stack strip, not a wall of borrowed customer logos. There are no
 * customers to name, and there are no partner marks to borrow — so the line
 * states what actually connects and leaves it at that.
 */
export function LandingLogos() {
  return (
    <section
      aria-label="Integrations"
      className="border-y border-border-subtle bg-surface/40"
    >
      <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-3 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:gap-8 sm:px-6 lg:px-8">
        <p className="shrink-0 text-[12px] text-tertiary">
          Runs on the stack you already have
        </p>

        <ul className="flex flex-wrap items-center gap-x-6 gap-y-2">
          {STACK.map((name) => (
            <li
              key={name}
              className="text-[13px] font-medium tracking-[-0.01em] text-secondary"
            >
              {name}
            </li>
          ))}
        </ul>

        <p className="figure-mono shrink-0 text-[10px] text-faint">
          9 AI providers · optional
        </p>
      </div>
    </section>
  );
}
