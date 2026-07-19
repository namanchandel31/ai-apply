import { useEffect, useState } from "react";
import { HeroHeadline, HERO_LEAD } from "@/components/landing/HeroHeadline";
import { mindooScrollTo } from "@/hooks/useMindooScroll";
import { trackLandingCtaEngaged } from "@/lib/analytics/landing";
import "@/styles/mindoo.css";

export function MindooHeroSection() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const t1 = window.setTimeout(() => setReady(true), 80);
    return () => window.clearTimeout(t1);
  }, []);

  return (
    <section
      data-hero="section"
      className={`mindoo-hero${ready ? " mh-ready" : ""}`}
    >
      <div className="m-padding-global mh-hero-stack-wrap">
        <div className="m-container mh-hero-stack">
          <div className="mh-hero-intro">
            <HeroHeadline ready={ready} />
            <p data-hero="subheading" className="mh-hero-lead m-body-text">
              {HERO_LEAD}
            </p>
            <div className={`mh-hero-actions${ready ? " is-ready" : ""}`}>
              <button
                type="button"
                className="mh-hero-btn mh-hero-btn-primary"
                onClick={() => {
                  trackLandingCtaEngaged("hero_start_free", "#pricing");
                  mindooScrollTo("pricing");
                }}
              >
                Start applying for free
              </button>
              <p className="mh-hero-actions-note">No credit card required</p>
            </div>
          </div>

          <div className={`mh-hero-video-wrap${ready ? " is-ready" : ""}`}>
            <video
              className="mh-hero-video"
              autoPlay
              loop
              muted
              playsInline
              preload="metadata"
              aria-label="OneTap product demo"
            >
              <source src="/hero-demo.mp4" type="video/mp4" />
              <source src="/hero-demo.mov" type="video/quicktime" />
            </video>
          </div>
        </div>
      </div>
    </section>
  );
}
