import { ALL_TOPICS, SITE_URL, TRACKS } from "@/content/learn";

export const dynamic = "force-static";

/** The whole curriculum as plain text, generated from the same data the site and the MCP server read. */
export function GET() {
  const out: string[] = [
    "# EngineerOS — full curriculum",
    "",
    "> Trade-off-first lessons on system design, AI engineering and RAG engineering, with a prerequisite graph.",
    `> Live, structured access: MCP ${SITE_URL}/api/mcp · REST ${SITE_URL}/api/v1/topics · spec ${SITE_URL}/openapi.json`,
    "",
  ];
  for (const track of TRACKS) {
    out.push(`## ${track.title}`, "", track.description, "");
    for (const t of track.topics) {
      out.push(
        `### ${t.title}`,
        `${SITE_URL}/learn/${t.track}/${t.id}`,
        `level: ${t.level} · ${t.minutes} min${t.module ? ` · module: ${t.module}` : ""}`,
        `prerequisites: ${t.prerequisites.length ? t.prerequisites.join(", ") : "none"}`,
        "",
        t.summary,
        "",
        ...t.body.flatMap((p) => [p, ""]),
        "Key points:",
        ...t.keyPoints.map((k) => `- ${k}`),
        ""
      );
    }
  }
  out.push(`<!-- ${ALL_TOPICS.length} lessons -->`);
  return new Response(out.join("\n"), {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" },
  });
}
