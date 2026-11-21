import { MarketingNav } from "@/components/marketing/marketing-nav";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { ProductTour } from "@/components/tour/product-tour";

export const metadata = {
  title: "Tour — EngineerOS",
  description:
    "Try the EngineerOS daily loop without an account: plan today, focus on one task, roll unfinished work forward, and write the daily note.",
  alternates: { canonical: "/tour" },
  openGraph: {
    title: "Tour — EngineerOS",
    description: "Try the daily loop in your browser. No account needed.",
    type: "website",
  },
};

export default function TourPage() {
  return (
    <div className="min-h-screen bg-base text-foreground">
      <MarketingNav />
      <main className="py-14 md:py-20">
        <ProductTour />
      </main>
      <MarketingFooter />
    </div>
  );
}
