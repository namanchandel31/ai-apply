import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { HeroHeadline, HERO_LEAD } from "@/components/landing/HeroHeadline";
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
              <span className="mh-hero-lead-line">{HERO_LEAD.line1}</span>
              <span className="mh-hero-lead-line">{HERO_LEAD.line2}</span>
            </p>
            <div className={`mh-hero-actions${ready ? " is-ready" : ""}`}>
              <Link to="/signup" className="mh-hero-btn mh-hero-btn-primary">
                Get Started for Free
              </Link>
              <Link to="/support" className="mh-hero-btn mh-hero-btn-secondary">
                Get a demo
              </Link>
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
