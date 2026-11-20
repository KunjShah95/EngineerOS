import { MarketingShell } from "@/components/marketing/marketing-shell";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
  title: "Terms of Service",
  description: "The terms for using EngineerOS: the free lessons, the public API and paid workspace plans.",
  path: "/terms",
});

const UPDATED = "2026-11-20";

const SECTIONS: { h: string; p: string[] }[] = [
  { h: "Using EngineerOS", p: ["EngineerOS provides free lessons, a knowledge map, a public read-only API and MCP server, and a workspace for notes, tasks and projects. By using it you agree to these terms."] },
  { h: "Your content", p: ["You own what you put in your workspace. You give us only the permission needed to store it and show it back to you. Where a workspace uses your own Supabase project, your data lives in that project."] },
  { h: "Acceptable use", p: ["Do not abuse the service, attempt to bypass rate limits or plan limits, or use it to break the law. The public API and MCP server are read-only and rate limited per client."] },
  { h: "Paid plans", p: ["Paid plans, their prices and their limits are described on the pricing page. The price and billing terms you are shown when you subscribe are the ones that apply to you."] },
  { h: "Lesson content", p: ["Lessons are educational and provided as is. They are not professional advice, and you are responsible for how you apply them in your own systems."] },
  { h: "Changes and contact", p: ["We may update these terms and will change the date above when we do. Questions: open an issue at github.com/KunjShah95/engineeros."] },
];

export default function Page() {
  return (
    <MarketingShell>
      <article className="mx-auto w-full max-w-2xl px-4 py-20 sm:px-6 md:py-28">
        <p className="label-mono">Legal</p>
        <h1 className="mt-4 font-serif-display text-[clamp(2rem,4.5vw,3rem)] leading-[1.05] tracking-[-0.02em] text-foreground">
          Terms of Service
        </h1>
        <p className="figure-mono mt-3 text-[11px] text-faint">Last updated {UPDATED}</p>
        <div className="mt-10 space-y-9">
          {SECTIONS.map((s) => (
            <section key={s.h}>
              <h2 className="font-serif-display text-xl text-foreground">{s.h}</h2>
              {s.p.map((t) => (
                <p key={t} className="mt-3 text-[15px] leading-relaxed text-secondary">
                  {t}
                </p>
              ))}
            </section>
          ))}
        </div>
      </article>
    </MarketingShell>
  );
}
