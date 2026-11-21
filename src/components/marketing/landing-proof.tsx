import { ArrowLink, SectionShell } from "@/components/marketing/landing-primitives";

const ROWS = [
  {
    strategy: "keyword",
    r1: "82.5%",
    r3: "100.0%",
    mrr: "92.5%",
    note: "default without a key",
    highlight: true,
  },
  {
    strategy: "semantic",
    r1: "52.5%",
    r3: "85.0%",
    mrr: "72.2%",
  },
  {
    strategy: "hybrid · w=1.0",
    r1: "72.5%",
    r3: "97.5%",
    mrr: "86.7%",
  },
  {
    strategy: "hybrid · w=0.35",
    r1: "82.5%",
    r3: "100.0%",
    mrr: "92.5%",
  },
];

export function LandingProof() {
  return (
    <SectionShell id="proof">
      <div className="grid gap-12 lg:grid-cols-[0.92fr_1.08fr] lg:items-start lg:gap-16">
        <div>
          <h2 className="text-balance font-serif-display text-[clamp(2.1rem,4.5vw,3.5rem)] font-light leading-[1.02] tracking-[-0.03em] text-foreground">
            A saturated eval{" "}
            <em className="italic tracking-[-0.02em]">measures nothing.</em>
          </h2>

          <p className="mt-6 max-w-[52ch] text-[14px] leading-relaxed text-secondary">
            That line is from the retrieval ADR, and it is why the eval includes
            14 deliberate distractors. Twenty typed queries over 22 documents:
            topically adjacent notes that must not outrank the true answer.
          </p>
          <p className="mt-4 max-w-[52ch] text-[14px] leading-relaxed text-secondary">
            Keyword search finds the right note first 82.5% of the time. Adding
            a stand-in semantic leg did not beat it, so keyword remains the
            default when no API key is configured.
          </p>

          <div className="mt-6">
            <ArrowLink href="/blog/semantic-search-over-your-own-notes">
              Read the retrieval write-up
            </ArrowLink>
          </div>
        </div>

        <div>
          <div className="overflow-hidden rounded-lg border border-border-subtle bg-surface/40">
            <div className="flex items-center justify-between gap-4 border-b border-border-subtle px-4 py-3">
              <span className="label-mono">retrieval eval</span>
              <span className="figure-mono text-[10px] text-faint">
                20 queries · 22 docs
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] border-collapse text-left">
                <caption className="sr-only">
                  Retrieval quality by strategy: keyword, semantic, and two
                  hybrid fusion weights, measured by recall at 1, recall at 3,
                  and mean reciprocal rank.
                </caption>
                <thead>
                  <tr className="border-b border-border-subtle">
                    <th
                      scope="col"
                      className="py-2.5 pl-4 pr-3 font-mono text-[9px] font-normal uppercase tracking-[0.14em] text-faint"
                    >
                      strategy
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-2.5 text-right font-mono text-[9px] font-normal uppercase tracking-[0.14em] text-faint"
                    >
                      recall@1
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-2.5 text-right font-mono text-[9px] font-normal uppercase tracking-[0.14em] text-faint"
                    >
                      recall@3
                    </th>
                    <th
                      scope="col"
                      className="py-2.5 pl-3 pr-4 text-right font-mono text-[9px] font-normal uppercase tracking-[0.14em] text-faint"
                    >
                      mrr
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {ROWS.map((row) => (
                    <tr
                      key={row.strategy}
                      className={
                        row.highlight
                          ? "border-b border-border-subtle/70 bg-signal-muted/30"
                          : "border-b border-border-subtle/70"
                      }
                    >
                      <th
                        scope="row"
                        className="py-3.5 pl-4 pr-3 text-left font-normal"
                      >
                        <span className="flex items-center gap-2 text-[13px] text-foreground">
                          {row.highlight ? (
                            <span
                              aria-hidden
                              className="size-1.5 rounded-full bg-signal"
                            />
                          ) : null}
                          {row.strategy}
                        </span>
                        {row.note ? (
                          <span className="mt-0.5 block pl-3.5 text-[10px] text-tertiary">
                            {row.note}
                          </span>
                        ) : null}
                      </th>
                      <td className="figure-mono px-3 py-3.5 text-right text-[13px] text-secondary">
                        {row.r1}
                      </td>
                      <td className="figure-mono px-3 py-3.5 text-right text-[13px] text-foreground">
                        {row.r3}
                      </td>
                      <td className="figure-mono py-3.5 pl-3 pr-4 text-right text-[13px] text-secondary">
                        {row.mrr}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="border-t border-border-subtle px-4 py-3">
              <p className="text-[11px] leading-relaxed text-tertiary">
                <span className="figure-mono text-[10px] text-secondary">
                  npm run eval:retrieval
                </span>{" "}
                · no database, no API key · the measured floors are asserted in
                the test suite.
              </p>
            </div>
          </div>

          <div className="mt-6 border-l border-signal/60 pl-4">
            <p className="text-[13px] font-medium text-foreground">
              The honest reading
            </p>
            <p className="mt-1.5 max-w-[58ch] text-[13px] leading-relaxed text-secondary">
              The semantic leg is a local bag-of-words stand-in, not an embedding
              model. This eval cannot prove hybrid retrieval&rsquo;s value; it
              proves the floor. A tripwire test fails when a stronger embedder
              changes that — the answer is to raise the weight, not delete the
              test.
            </p>
          </div>
        </div>
      </div>
    </SectionShell>
  );
}
