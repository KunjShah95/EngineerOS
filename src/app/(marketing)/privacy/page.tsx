import { MarketingShell } from "@/components/marketing/marketing-shell";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
  title: "Privacy Policy",
  description: "What EngineerOS stores, where it lives, and what is not collected.",
  path: "/privacy",
});

const UPDATED = "2026-11-20";

const SECTIONS: { h: string; p: string[] }[] = [
  { h: "Learning without an account", p: ["Lessons, the map and the public API need no account. Your lesson progress is stored in your own browser and is not sent to us."] },
  { h: "Accounts and workspaces", p: ["If you create an account we store your email and the content you add to your workspace so the product can work. Authentication and storage are provided by Supabase."] },
  { h: "AI features", p: ["When you use the assistant, the text needed to answer your request is sent to the AI provider configured for your workspace. If you bring your own key, requests go to your provider account."] },
  { h: "Payments", p: ["EngineerOS does not store card details. Payment handling is described when you subscribe."] },
  { h: "Public API", p: ["Requests to the public API and MCP server are rate limited using your network address, which is held in memory for that purpose and not stored."] },
  { h: "Your choices", p: ["You can export your workspace content from settings, and you can ask for your account and data to be deleted by contacting us through github.com/KunjShah95/engineeros."] },
];

export default function Page() {
  return (
    <MarketingShell>
      <article className="mx-auto w-full max-w-2xl px-4 py-20 sm:px-6 md:py-28">
        <p className="label-mono">Legal</p>
        <h1 className="mt-4 font-serif-display text-[clamp(2rem,4.5vw,3rem)] leading-[1.05] tracking-[-0.02em] text-foreground">
          Privacy Policy
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
