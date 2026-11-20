import Link from "next/link";

import { CopyBlock } from "@/components/learn/CopyBlock";
import { MarketingShell } from "@/components/marketing/marketing-shell";
import { SITE_URL } from "@/content/learn";
import { listToolSummaries } from "@/lib/mcp/server";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
  title: "Connect your bots: MCP server and API",
  description:
    "Use EngineerOS from Grok, Claude, Cursor or your own agents through a public, read-only MCP server and REST API.",
  path: "/connect",
});

const MCP_URL = `${SITE_URL}/api/mcp`;

const GROK_SDK = `import os
from xai_sdk import Client
from xai_sdk.chat import user
from xai_sdk.tools import mcp

client = Client(api_key=os.getenv("XAI_API_KEY"))
chat = client.chat.create(
    model="grok-4.5",  # any current Grok model
    tools=[mcp(server_url="${MCP_URL}")],
)
chat.append(user("Plan my path to harness engineering and summarise step one."))
print(chat.sample().content)`;

const GROK_RESPONSES = `curl https://api.x.ai/v1/responses \\
  -H "Authorization: Bearer $XAI_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "grok-4.5",
    "input": "What should I learn before agent-loop? Use the EngineerOS tools.",
    "tools": [{
      "type": "mcp",
      "server_label": "engineeros",
      "server_url": "${MCP_URL}"
    }]
  }'`;

const CLAUDE = `claude mcp add --transport http engineeros ${MCP_URL}`;

const CURSOR = `{
  "mcpServers": {
    "engineeros": { "url": "${MCP_URL}" }
  }
}`;

const RAW = `curl -s ${MCP_URL} \\
  -H "Content-Type: application/json" \\
  -H "Accept: application/json, text/event-stream" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call",
       "params":{"name":"search_topics","arguments":{"query":"rate limiting"}}}'`;

const REST = `curl "${SITE_URL}/api/v1/topics?q=prompt+injection"
curl "${SITE_URL}/api/v1/topics/agent-loop"
curl "${SITE_URL}/api/v1/path?to=harness-engineering"
curl "${SITE_URL}/api/v1/path?completed=llm-fundamentals,caching"
curl "${SITE_URL}/api/v1/map"`;

export default function ConnectPage() {
  const tools = listToolSummaries();
  return (
    <MarketingShell>
      <section className="mx-auto w-full max-w-4xl px-4 pt-14 pb-24 sm:px-6 md:pt-20">
        <p className="label-mono">Connect</p>
        <h1 className="mt-5 max-w-3xl font-serif-display text-[clamp(2.2rem,5vw,3.6rem)] leading-[1.02] tracking-[-0.02em] text-foreground">
          Let your bots read the map.
        </h1>
        <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-secondary">
          EngineerOS runs a public, read-only{" "}
          <abbr title="Model Context Protocol">MCP</abbr> server. Point Grok, Claude, Cursor or your own agent at one
          URL and it can search lessons, read them, and plan study paths over the same graph you see on the{" "}
          <Link href="/map" className="text-foreground underline underline-offset-4">map</Link>.
        </p>

        <div className="mt-8">
          <CopyBlock label="MCP server URL (Streamable HTTP)" code={MCP_URL} />
        </div>

        <h2 className="mt-14 font-serif-display text-2xl tracking-[-0.01em] text-foreground">Grok (xAI)</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-secondary">
          xAI&rsquo;s API supports Remote MCP tools: you hand it a public server URL and xAI&rsquo;s side makes the
          calls. That is why this server is public and stateless. The{" "}
          <code className="font-mono text-[12px] text-foreground">require_approval</code> option is not supported by
          xAI, which is fine here because every tool is read-only.
        </p>
        <div className="mt-4 space-y-4">
          <CopyBlock label="xAI SDK (Python)" code={GROK_SDK} />
          <CopyBlock label="Responses API" code={GROK_RESPONSES} />
        </div>

        <h2 className="mt-14 font-serif-display text-2xl tracking-[-0.01em] text-foreground">Claude, Cursor and others</h2>
        <div className="mt-4 space-y-4">
          <CopyBlock label="Claude Code" code={CLAUDE} />
          <CopyBlock label=".cursor/mcp.json" code={CURSOR} />
          <CopyBlock label="Raw JSON-RPC" code={RAW} />
        </div>

        <h2 className="mt-14 font-serif-display text-2xl tracking-[-0.01em] text-foreground">Tools</h2>
        <dl className="mt-4 divide-y divide-border-subtle rounded-lg border border-border-subtle">
          {tools.map((t) => (
            <div key={t.name} className="grid gap-1 p-4 sm:grid-cols-[200px_1fr] sm:gap-6">
              <dt className="font-mono text-[13px] text-signal">{t.name}</dt>
              <dd className="text-sm leading-relaxed text-secondary">{t.description}</dd>
            </div>
          ))}
        </dl>

        <h2 className="mt-14 font-serif-display text-2xl tracking-[-0.01em] text-foreground">Plain REST</h2>
        <p className="mt-2 text-sm text-secondary">Same data, no protocol. CORS is open for browsers.</p>
        <div className="mt-4">
          <CopyBlock label="REST" code={REST} />
        </div>

        <h2 className="mt-14 font-serif-display text-2xl tracking-[-0.01em] text-foreground">Limits and trust</h2>
        <ul className="mt-4 space-y-3 text-sm leading-relaxed text-secondary">
          <li>Read-only and unauthenticated. It serves public lessons and nothing from any workspace.</li>
          <li>Rate limited per client with a burst allowance. Over the limit you get HTTP 429 and a Retry-After header.</li>
          <li>Stateless: no sessions, no streaming. Each POST is answered on its own.</li>
          <li>Treat tool output as untrusted text, as you would for any MCP server you do not run yourself.</li>
        </ul>
      </section>
    </MarketingShell>
  );
}
