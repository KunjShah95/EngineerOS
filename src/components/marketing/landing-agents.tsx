import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { CopyBlock } from "@/components/learn/CopyBlock";
import { Reveal } from "@/components/marketing/reveal";
import { SITE_URL } from "@/content/learn";

const SNIPPET = `from xai_sdk import Client
from xai_sdk.chat import user
from xai_sdk.tools import mcp

chat = Client().chat.create(
    model="grok-4.5",
    tools=[mcp(server_url="${SITE_URL}/api/mcp")],
)
chat.append(user("Plan my path to harness engineering."))
print(chat.sample().content)`;

const POINTS = [
  ["Public and read-only", "No keys, no accounts, nothing from any workspace. Safe to hand to any agent."],
  ["Stateless Streamable HTTP", "One URL. Works with xAI Remote MCP tools, Claude, Cursor and plain curl."],
  ["Same data as the site", "Search, full lessons, study paths and the whole graph, through one service."],
];

export function LandingAgents() {
  return (
    <section id="agents" className="py-16 md:py-28">
      <div className="mx-auto grid w-full max-w-6xl items-start gap-12 px-4 sm:px-6 lg:grid-cols-2">
        <Reveal>
          <p className="label-mono">For bots</p>
          <h2 className="mt-5 font-serif-display text-[clamp(1.9rem,4vw,2.75rem)] leading-[1.06] tracking-[-0.02em] text-foreground">
            Your agents get the <em className="font-light italic text-signal">same map.</em>
          </h2>
          <p className="mt-5 text-[15px] leading-relaxed text-secondary">
            A tutor bot, a code reviewer that explains why, a study planner. Point any of them at the MCP server and
            they can look things up instead of guessing.
          </p>
          <ul className="mt-7 space-y-4">
            {POINTS.map(([title, text]) => (
              <li key={title} className="border-l border-border-subtle pl-4">
                <p className="text-sm font-medium text-foreground">{title}</p>
                <p className="mt-1 text-sm leading-relaxed text-secondary">{text}</p>
              </li>
            ))}
          </ul>
          <Link
            href="/connect"
            className="mt-7 inline-flex items-center gap-1.5 text-sm text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            Connection guide <ArrowRight className="size-4" strokeWidth={1.75} />
          </Link>
        </Reveal>

        <Reveal delay={0.1}>
          <CopyBlock label="Grok via xAI Remote MCP" code={SNIPPET} />
        </Reveal>
      </div>
    </section>
  );
}
