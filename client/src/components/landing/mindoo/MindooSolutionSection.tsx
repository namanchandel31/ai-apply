import { SplitHeading } from "./shared";
import { ProductMockupMini } from "./ProductMockupMini";

const BENTO_FEATURES = [
  {
    id: "extension",
    tag: "Chrome extension",
    title: "Apply directly from LinkedIn",
    body: "One click on any job post — no copy-paste, no tab switching. Capture the role and queue your application while you keep browsing.",
    span: 2,
    variant: "extension" as const,
  },
  {
    id: "tracking",
    tag: "Dashboard",
    title: "Application tracking",
    body: "Every role, status, and follow-up in one place. Search, filter, and retry without losing context.",
    span: 1,
    variant: "track" as const,
  },
  {
    id: "personalize",
    tag: "AI outreach",
    title: "Personalized emails from your résumé",
    body: "AI reads the JD, scores fit, and drafts outreach that sounds like you — not a generic template.",
    span: 1,
    variant: "apply" as const,
  },
  {
    id: "gmail",
    tag: "Gmail",
    title: "Send from your own inbox",
    body: "Recruiters see your name and thread history — not a platform no-reply address.",
    span: 2,
    variant: "gmail" as const,
  },
] as const;

export function MindooSolutionSection() {
  return (
    <section id="solution" className="m-section m-solution">
      <div className="m-padding-global">
        <div className="m-bg-box m-solution-wrapper">
          <div className="m-solution-header">
            <SplitHeading
              className="m-h3 m-solution-headline"
              primary="Start where the pressure is highest."
            />
          </div>

          <div className="m-solution-bento">
            {BENTO_FEATURES.map((item) => (
              <article
                key={item.id}
                data-reveal=""
                className={`m-solution-bento-card${item.span === 2 ? " is-span-2" : ""}`}
              >
                <div className="m-solution-bento-copy">
                  <p className="m-text-caption m-solution-bento-tag">{item.tag}</p>
                  <h3 className="m-h5 m-solution-bento-title">{item.title}</h3>
                  <p className="m-body-secondary m-solution-bento-body">{item.body}</p>
                </div>
                <div className="m-solution-bento-visual">
                  <ProductMockupMini variant={item.variant} />
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
