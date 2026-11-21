import {
  SectionIntro,
  SectionShell,
} from "@/components/marketing/landing-primitives";

const CAPABILITIES = [
  {
    label: "Notes, tasks, and projects in one schema",
    engineeros: "Yes",
    notion: "Partial",
    obsidian: "No",
    linear: "No",
  },
  {
    label: "Semantic search over your own writing",
    engineeros: "Yes",
    notion: "Partial",
    obsidian: "Partial",
    linear: "No",
  },
  {
    label: "AI answers with source citations",
    engineeros: "Yes",
    notion: "Partial",
    obsidian: "Partial",
    linear: "No",
  },
  {
    label: "Questions pinned to a past date",
    engineeros: "Yes",
    notion: "No",
    obsidian: "No",
    linear: "No",
  },
  {
    label: "Knowledge graph from your links",
    engineeros: "Yes",
    notion: "No",
    obsidian: "Yes",
    linear: "No",
  },
  {
    label: "Self-hosted data",
    engineeros: "Yes",
    notion: "No",
    obsidian: "Yes",
    linear: "No",
  },
  {
    label: "Free to start",
    engineeros: "Yes",
    notion: "Yes",
    obsidian: "Yes",
    linear: "Yes",
  },
];

function Value({ value, ours = false }: { value: string; ours?: boolean }) {
  return (
    <span
      className={
        value === "Yes"
          ? ours
            ? "text-[13px] font-medium text-foreground"
            : "text-[13px] text-foreground"
          : value === "Partial"
            ? "text-[13px] text-secondary"
            : "text-[13px] text-faint"
      }
    >
      {value}
    </span>
  );
}

export function LandingComparison() {
  return (
    <SectionShell id="compare">
      <SectionIntro
        title="Where it fits."
        body="Not a replacement for a tool you love. A replacement for the tab-switching between four of them."
      />

      <div className="mt-10 overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse">
          <caption className="sr-only">
            Capability comparison between EngineerOS, Notion, Obsidian, and
            Linear, as of October 2026.
          </caption>
          <thead>
            <tr className="border-b border-border-default">
              <th
                scope="col"
                className="pb-3 pr-4 text-left font-mono text-[9px] font-normal uppercase tracking-[0.14em] text-faint"
              >
                capability
              </th>
              <th
                scope="col"
                className="w-[18%] border-x border-border-subtle bg-accent-muted/30 px-4 pb-3 text-left font-mono text-[9px] font-normal uppercase tracking-[0.14em] text-accent"
              >
                EngineerOS
              </th>
              <th
                scope="col"
                className="w-[14%] px-4 pb-3 text-left font-mono text-[9px] font-normal uppercase tracking-[0.14em] text-faint"
              >
                Notion
              </th>
              <th
                scope="col"
                className="w-[14%] px-4 pb-3 text-left font-mono text-[9px] font-normal uppercase tracking-[0.14em] text-faint"
              >
                Obsidian
              </th>
              <th
                scope="col"
                className="w-[14%] pl-4 pb-3 text-left font-mono text-[9px] font-normal uppercase tracking-[0.14em] text-faint"
              >
                Linear
              </th>
            </tr>
          </thead>
          <tbody>
            {CAPABILITIES.map((capability) => (
              <tr
                key={capability.label}
                className="border-b border-border-subtle/70"
              >
                <th
                  scope="row"
                  className="py-3.5 pr-4 text-left text-[13px] font-normal text-secondary"
                >
                  {capability.label}
                </th>
                <td className="border-x border-border-subtle bg-accent-muted/30 px-4 py-3.5">
                  <Value value={capability.engineeros} ours />
                </td>
                <td className="px-4 py-3.5">
                  <Value value={capability.notion} />
                </td>
                <td className="px-4 py-3.5">
                  <Value value={capability.obsidian} />
                </td>
                <td className="py-3.5 pl-4">
                  <Value value={capability.linear} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-5 flex flex-col justify-between gap-4 border-t border-border-subtle pt-5 md:flex-row md:items-start md:gap-12">
        <p className="max-w-[62ch] text-[12px] leading-relaxed text-tertiary">
          Partial means a plugin, an add-on, or a different product in the same
          suite. Capabilities as of October 2026; they change.
        </p>
        <p className="max-w-[42ch] text-[12px] leading-relaxed text-tertiary md:text-right">
          If Obsidian already holds your graph and you do not need tasks, keep
          it. EngineerOS is for when the graph, the board, and the answer need to
          be the same system.
        </p>
      </div>
    </SectionShell>
  );
}
