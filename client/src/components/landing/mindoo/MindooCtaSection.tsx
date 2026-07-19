import { mindooScrollTo } from "@/hooks/useMindooScroll";
import { trackLandingCtaEngaged } from "@/lib/analytics/landing";

export function MindooCtaSection() {
  return (
    <section id="get-started" className="m-section m-cta">
      <div className="m-padding-global">
        <div className="m-container">
          <div data-reveal="" className="m-cta-card">
            <h2 className="m-cta-card-title">
              Apply to more jobs.
              <br />
              Spend less time applying.
            </h2>
            <p className="m-cta-card-sub m-body-text">
              Set up OneTap once and let it write, send, and track every application.
            </p>
            <button
              type="button"
              className="m-cta-card-btn"
              onClick={() => {
                trackLandingCtaEngaged("hero_start_free", "#pricing");
                mindooScrollTo("pricing");
              }}
            >
              Start applying for free
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
