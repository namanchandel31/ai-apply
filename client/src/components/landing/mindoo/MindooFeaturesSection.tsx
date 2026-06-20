import { mindooScrollTo } from "@/hooks/useMindooScroll";
import { SplitHeading } from "./shared";

const FEATURES = [
  {
    name: "Apply agent",
    desc: "Parses job descriptions, scores resume fit, and drafts outreach automatically in the background.",
    cta: "See Apply",
    color: "#0059FF",
  },
  {
    name: "Personalization agent",
    desc: "Matches your skills to role requirements and writes emails that sound like you, not a template.",
    cta: "See Personalize",
    color: "#4AC957",
  },
  {
    name: "Gmail agent",
    desc: "Sends from your own inbox so recruiters see your name, not a platform no-reply address.",
    cta: "See Gmail",
    color: "#E594C4",
  },
  {
    name: "Tracking agent",
    desc: "Real-time status on every application. Search, filter, and retry without losing history.",
    cta: "See Tracking",
    color: "#FFB020",
  },
  {
    name: "Auto-send agent",
    desc: "Turn on auto-send and applications fire as you paste. Review mode keeps you in control.",
    cta: "See Auto-send",
    color: "#9B59B6",
  },
];

export function MindooFeaturesSection() {
  return (
    <section id="features" className="m-section m-features">
      <div className="m-spacing-xhuge" />
      <div className="m-padding-global">
        <div className="m-container">
          <SplitHeading
            className="m-h3 m-ch-18 m-text-center"
            tertiary="You don't need everything on day one."
            primary="Add automation as your search needs it."
          />
          <p data-reveal="" className="m-features-sub">
            OneTap is the only apply platform that lets you run the full workflow (draft,
            send, and track) inside one clean, governed system.
          </p>
        </div>
      </div>

      <div data-reveal="" className="m-features-scroll">
        <div className="m-features-track">
          {FEATURES.map((f) => (
            <article key={f.name} className="m-feature-card">
              <div
                className="m-feature-icon"
                style={{ backgroundColor: `${f.color}20`, color: f.color }}
                aria-hidden
              >
                ◆
              </div>
              <div className="m-feature-body">
                <h3 className="m-h6">{f.name}</h3>
                <p className="m-text-small">{f.desc}</p>
              </div>
              <button
                type="button"
                className="m-btn m-btn-primary m-feature-cta"
                onClick={() => mindooScrollTo("pricing")}
              >
                {f.cta}
              </button>
            </article>
          ))}
        </div>
      </div>

      <div className="m-spacing-xhuge" />
    </section>
  );
}
