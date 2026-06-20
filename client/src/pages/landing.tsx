import { MindooHeroSection } from "@/components/landing/MindooHeroSection";
import { MindooNav } from "@/components/landing/mindoo/MindooNav";
import { MindooProblemSection } from "@/components/landing/mindoo/MindooProblemSection";
import { MindooFeatureShowcaseSection } from "@/components/landing/mindoo/MindooFeatureShowcaseSection";
import { MindooSetupSection } from "@/components/landing/mindoo/MindooSetupSection";
import { MindooPricingSection } from "@/components/landing/mindoo/MindooPricingSection";
import { MindooFaqSection } from "@/components/landing/mindoo/MindooFaqSection";
import { MindooCtaSection } from "@/components/landing/mindoo/MindooCtaSection";
import { MindooFooter } from "@/components/landing/mindoo/MindooFooter";
import { useMindooScroll } from "@/hooks/useMindooScroll";
import { useMindooReveal } from "@/hooks/useMindooReveal";
import "@/styles/mindoo.css";

export function LandingPage() {
  useMindooScroll();
  useMindooReveal();

  return (
    <div className="mindoo-site">
      <MindooNav />
      <div className="mh-top-shell">
        <MindooHeroSection />
      </div>
      <main>
        <MindooProblemSection />
        <MindooFeatureShowcaseSection />
        <MindooSetupSection />
        <MindooPricingSection />
        <MindooFaqSection />
        <MindooCtaSection />
        <MindooFooter />
      </main>
    </div>
  );
}
