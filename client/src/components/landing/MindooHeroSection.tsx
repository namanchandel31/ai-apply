import { useEffect, useState } from "react";
import { HeroHeadline, HERO_SUBHEAD } from "@/components/landing/HeroHeadline";
import { HeroWaitlistInput } from "@/components/landing/HeroWaitlistInput";
import { HeroApplyAnimation } from "@/components/landing/HeroApplyAnimation";
import "@/styles/mindoo.css";

export function MindooHeroSection() {
  const [ready, setReady] = useState(false);
  const [autoApply, setAutoApply] = useState(true);

  useEffect(() => {
    const t1 = window.setTimeout(() => setReady(true), 80);
    return () => window.clearTimeout(t1);
  }, []);

  return (
    <section
      data-hero="section"
      className={`mindoo-hero${ready ? " mh-ready" : ""}`}
    >
      <div className="mh-padding-global mh-hero-split-wrap">
        <div className="mh-container mh-hero-split">
          <div className="mh-hero-left">
            <div className="mh-hero-copy">
              <div className="mh-heading-list">
                <HeroHeadline
                  ready={ready}
                  autoApply={autoApply}
                  onAutoApplyChange={setAutoApply}
                />
                <p data-hero="subheading" className="mh-subhead">
                  {autoApply ? HERO_SUBHEAD.on : HERO_SUBHEAD.off}
                </p>
              </div>

              <HeroWaitlistInput ready={ready} />
            </div>
          </div>

          <div className="mh-hero-right">
            <div className="mh-product-center">
              <HeroApplyAnimation autoApply={autoApply} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
