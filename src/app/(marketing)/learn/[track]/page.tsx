import { notFound } from "next/navigation";

import { MarketingShell } from "@/components/marketing/marketing-shell";
import { TopicExplorer } from "@/components/learn/TopicExplorer";
import { TRACKS, getTrack } from "@/content/learn";
import { pageMeta } from "@/lib/seo";

type Params = Promise<{ track: string }>;

export const dynamicParams = false;

export function generateStaticParams() {
  return TRACKS.map((t) => ({ track: t.id }));
}

export async function generateMetadata({ params }: { params: Params }) {
  const track = getTrack((await params).track);
  if (!track) return {};
  return pageMeta({ title: `${track.title} track`, description: track.description, path: `/learn/${track.id}` });
}

export default async function TrackPage({ params }: { params: Params }) {
  const track = getTrack((await params).track);
  if (!track) notFound();

  return (
    <MarketingShell>
      <section className="mx-auto w-full max-w-6xl px-4 pt-14 pb-10 sm:px-6 md:pt-20">
        <p className="label-mono">Track</p>
        <h1 className="mt-5 font-serif-display text-[clamp(2.2rem,5vw,3.4rem)] leading-[1.02] tracking-[-0.02em] text-foreground">
          {track.title}
        </h1>
        <p className="mt-2 text-foreground/80">{track.tagline}</p>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-secondary">{track.description}</p>
      </section>
      <section className="mx-auto w-full max-w-6xl px-4 pb-24 sm:px-6">
        <TopicExplorer initialTrack={track.id} />
      </section>
    </MarketingShell>
  );
}
