import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { CompleteButton } from "@/components/learn/CompleteButton";
import { CopyBlock } from "@/components/learn/CopyBlock";
import { LevelMark, TrackTag } from "@/components/learn/ui";
import { MarketingShell } from "@/components/marketing/marketing-shell";
import { ALL_TOPICS, SITE_URL, getTopic, getTrack, topicUrl } from "@/content/learn";
import { unlocks } from "@/lib/learn/graph";
import { pageMeta } from "@/lib/seo";

type Params = Promise<{ track: string; topic: string }>;

export const dynamicParams = false;

export function generateStaticParams() {
  return ALL_TOPICS.map((t) => ({ track: t.track, topic: t.id }));
}

export async function generateMetadata({ params }: { params: Params }) {
  const { track, topic: id } = await params;
  const topic = getTopic(id);
  if (!topic || topic.track !== track) return {};
  return pageMeta({ title: topic.title, description: topic.summary, path: `/learn/${topic.track}/${topic.id}` });
}

export default async function TopicPage({ params }: { params: Params }) {
  const { track: trackId, topic: id } = await params;
  const topic = getTopic(id);
  const track = getTrack(trackId);
  if (!topic || !track || topic.track !== track.id) notFound();

  const prerequisites = topic.prerequisites.map((p) => getTopic(p)).filter((t) => !!t);
  const next = unlocks(topic.id);
  const siblings = track.topics;
  const idx = siblings.findIndex((t) => t.id === topic.id);
  const prev = siblings[idx - 1];
  const following = siblings[idx + 1];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: topic.title,
    description: topic.summary,
    url: topicUrl(topic),
    inLanguage: "en",
    proficiencyLevel: topic.level,
    timeRequired: `PT${topic.minutes}M`,
    keywords: topic.tags.join(", "),
    isPartOf: { "@type": "Course", name: `${track.title} · EngineerOS`, url: `${SITE_URL}/learn/${track.id}` },
    publisher: { "@type": "Organization", name: "EngineerOS", url: SITE_URL },
  };

  return (
    <MarketingShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <article className="mx-auto w-full max-w-3xl px-4 pt-12 pb-24 sm:px-6 md:pt-16">
        <nav aria-label="Breadcrumb" className="font-mono text-[11px] text-faint">
          <Link href="/learn" className="hover:text-foreground">Learn</Link>
          <span aria-hidden> / </span>
          <Link href={`/learn/${track.id}`} className="hover:text-foreground">{track.title}</Link>
        </nav>

        <header className="mt-6">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <TrackTag track={topic.track} label={track.title} />
            <LevelMark level={topic.level} />
            <span className="font-mono text-[10px] text-faint">{topic.minutes} min</span>
            {topic.module ? (
              <span className="font-mono text-[10px] tracking-[0.12em] text-faint uppercase">Module · {topic.module}</span>
            ) : null}
          </div>
          <h1 className="mt-4 font-serif-display text-[clamp(2rem,4.5vw,3rem)] leading-[1.05] tracking-[-0.02em] text-foreground">
            {topic.title}
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-secondary">{topic.summary}</p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <CompleteButton id={topic.id} />
            <Link href="/map" className="text-sm text-secondary underline-offset-4 hover:text-foreground hover:underline">
              See it on the map
            </Link>
          </div>
        </header>

        {prerequisites.length > 0 ? (
          <aside className="mt-8 rounded-lg border border-border-subtle bg-surface p-4 text-sm">
            <p className="label-mono">Read first</p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {prerequisites.map((p) => (
                <li key={p!.id}>
                  <Link
                    href={`/learn/${p!.track}/${p!.id}`}
                    className="inline-block rounded-full border border-border-subtle px-3 py-1 text-secondary transition-colors hover:border-default hover:text-foreground"
                  >
                    {p!.title}
                  </Link>
                </li>
              ))}
            </ul>
          </aside>
        ) : null}

        <div className="mt-10 space-y-5 text-[16px] leading-[1.75] text-foreground/90">
          {topic.body.map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>

        <section className="mt-12" aria-labelledby="key-points">
          <h2 id="key-points" className="label-mono">Key points</h2>
          <ul className="mt-4 space-y-3">
            {topic.keyPoints.map((k) => (
              <li key={k} className="flex gap-3 text-[15px] leading-relaxed text-foreground/90">
                <span aria-hidden className="mt-2.5 size-1.5 shrink-0 rounded-full bg-signal" />
                {k}
              </li>
            ))}
          </ul>
        </section>

        {topic.tradeoffs && topic.tradeoffs.length > 0 ? (
          <section className="mt-12" aria-labelledby="tradeoffs">
            <h2 id="tradeoffs" className="label-mono">Trade-offs</h2>
            <div className="mt-4 overflow-x-auto rounded-lg border border-border-subtle">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead className="bg-surface text-faint">
                  <tr>
                    <th scope="col" className="px-4 py-2.5 font-mono text-[10px] tracking-[0.14em] uppercase">Choice</th>
                    <th scope="col" className="px-4 py-2.5 font-mono text-[10px] tracking-[0.14em] uppercase">You gain</th>
                    <th scope="col" className="px-4 py-2.5 font-mono text-[10px] tracking-[0.14em] uppercase">You pay</th>
                  </tr>
                </thead>
                <tbody>
                  {topic.tradeoffs.map((t) => (
                    <tr key={t.choice} className="border-t border-border-subtle align-top">
                      <th scope="row" className="px-4 py-3 font-medium text-foreground">{t.choice}</th>
                      <td className="px-4 py-3 text-secondary">{t.upside}</td>
                      <td className="px-4 py-3 text-secondary">{t.cost}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        <section className="mt-12" aria-labelledby="practice">
          <h2 id="practice" className="label-mono">Answer these out loud</h2>
          <ol className="mt-4 space-y-4">
            {topic.practice.map((q, i) => (
              <li key={q} className="flex gap-3 text-[15px] leading-relaxed text-foreground/90">
                <span className="figure-mono mt-0.5 w-5 shrink-0 text-right text-[12px] text-faint">{i + 1}</span>
                {q}
              </li>
            ))}
          </ol>
        </section>

        {topic.lab ? (
          <section className="mt-12 rounded-lg border border-signal/40 bg-signal-muted/40 p-5" aria-labelledby="lab">
            <h2 id="lab" className="font-mono text-[10px] tracking-[0.16em] text-signal uppercase">Build it</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-foreground/90">{topic.lab}</p>
          </section>
        ) : null}

        <section className="mt-12" aria-labelledby="agents">
          <h2 id="agents" className="label-mono">Use this from an agent</h2>
          <p className="mt-2 mb-3 text-sm text-secondary">
            Any MCP client, including Grok, can read this lesson. See{" "}
            <Link href="/connect" className="text-foreground underline underline-offset-4">how to connect</Link>.
          </p>
          <CopyBlock label="REST" code={`curl ${SITE_URL}/api/v1/topics/${topic.id}`} />
        </section>

        {next.length > 0 ? (
          <section className="mt-12" aria-labelledby="unlocks">
            <h2 id="unlocks" className="label-mono">This unlocks</h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {next.map((n) => (
                <li key={n.id}>
                  <Link
                    href={`/learn/${n.track}/${n.id}`}
                    className="inline-block rounded-full border border-border-subtle px-3 py-1 text-sm text-secondary transition-colors hover:border-default hover:text-foreground"
                  >
                    {n.title}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <nav aria-label="Previous and next in track" className="mt-14 grid gap-3 border-t border-border-subtle pt-6 sm:grid-cols-2">
          {prev ? (
            <Link href={`/learn/${prev.track}/${prev.id}`} className="group rounded-lg border border-border-subtle p-4 transition-colors hover:border-default">
              <span className="inline-flex items-center gap-1 font-mono text-[10px] tracking-[0.14em] text-faint uppercase">
                <ArrowLeft className="size-3" /> Previous
              </span>
              <span className="mt-1 block text-sm text-foreground">{prev.title}</span>
            </Link>
          ) : <span />}
          {following ? (
            <Link href={`/learn/${following.track}/${following.id}`} className="group rounded-lg border border-border-subtle p-4 text-right transition-colors hover:border-default sm:col-start-2">
              <span className="inline-flex items-center gap-1 font-mono text-[10px] tracking-[0.14em] text-faint uppercase">
                Next <ArrowRight className="size-3" />
              </span>
              <span className="mt-1 block text-sm text-foreground">{following.title}</span>
            </Link>
          ) : null}
        </nav>
      </article>
    </MarketingShell>
  );
}
