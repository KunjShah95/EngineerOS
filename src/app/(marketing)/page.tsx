import { MarketingNav } from "@/components/marketing/marketing-nav";
import { LandingHero } from "@/components/marketing/landing-hero";
import { LandingMetrics } from "@/components/marketing/landing-metrics";
import { LandingFeatures } from "@/components/marketing/landing-features";
import { LandingShowcase } from "@/components/marketing/landing-showcase";
import { LandingCta } from "@/components/marketing/landing-cta";
import { MarketingFooter } from "@/components/marketing/marketing-footer";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-base text-foreground">
      <MarketingNav />
      <main>
        <LandingHero />
        <LandingMetrics />
        <LandingFeatures />
        <LandingShowcase />
        <LandingCta />
      </main>
      <MarketingFooter />
    </div>
  );
}
