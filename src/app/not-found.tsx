import Link from "next/link";

import { BrandMark } from "@/components/brand/BrandMark";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center bg-base px-6 text-center text-foreground">
      <div
        aria-hidden
        className="bg-blueprint pointer-events-none absolute inset-0 -z-10 opacity-70 [mask-image:radial-gradient(ellipse_60%_60%_at_50%_40%,black,transparent)] [background-size:72px_72px]"
      />
      <BrandMark size="lg" />
      <p className="label-mono mt-8">Error 404</p>
      <h1 className="mt-3 font-serif-display text-[clamp(2rem,5vw,3.2rem)] leading-[1.05] tracking-[-0.02em]">
        That route <em className="font-light italic text-signal">isn&rsquo;t on the map.</em>
      </h1>
      <p className="mt-4 max-w-sm text-sm leading-relaxed text-secondary">
        The page you asked for doesn&rsquo;t exist, or it moved. Try the knowledge map, or head back to your workspace.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link href="/map">
          <Button size="lg">Open the map</Button>
        </Link>
        <Link href="/dashboard">
          <Button size="lg" variant="secondary">
            Go to dashboard
          </Button>
        </Link>
      </div>
    </main>
  );
}
