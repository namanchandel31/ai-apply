import { mindooScrollTo } from "@/hooks/useMindooScroll";

export function MindooCtaSection() {
  return (
    <section id="get-started" className="m-section m-cta">
      <div className="m-padding-global">
        <div className="m-container">
          <div data-reveal="" className="m-cta-card">
            <h2 className="m-cta-card-title">Stop drafting applications at 11pm.</h2>
            <p className="m-cta-card-sub m-body-text">
              Pick a plan and set up in three minutes.
            </p>
            <button
              type="button"
              className="m-cta-card-btn"
              onClick={() => mindooScrollTo("pricing")}
            >
              View plans →
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
