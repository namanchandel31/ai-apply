import { MindooHeroSection } from "@/components/landing/MindooHeroSection";
import { MindooNav } from "@/components/landing/mindoo/MindooNav";
import { MindooProblemSection } from "@/components/landing/mindoo/MindooProblemSection";
import { MindooSolutionSection } from "@/components/landing/mindoo/MindooSolutionSection";
import { MindooStepsSection } from "@/components/landing/mindoo/MindooStepsSection";
import { MindooTrustSection } from "@/components/landing/mindoo/MindooTrustSection";
import { MindooCtaSection } from "@/components/landing/mindoo/MindooCtaSection";
import { useMindooScroll } from "@/hooks/useMindooScroll";
import { useMindooReveal } from "@/hooks/useMindooReveal";
import "@/styles/mindoo.css";

export function LandingPage() {
  useMindooScroll();
  useMindooReveal();

  return (
    <div className="mindoo-site">
      <div className="mh-top-shell">
        <MindooNav />
        <MindooHeroSection />
      </div>
      <main>
        <MindooProblemSection />
        <MindooSolutionSection />
        <MindooStepsSection />
        <MindooTrustSection />
        <MindooCtaSection />
      </main>
    </div>
  );
}
