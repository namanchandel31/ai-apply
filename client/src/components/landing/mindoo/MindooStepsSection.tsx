import { ProductMockupFull } from "./ProductMockupMini";
import { SplitHeading } from "./shared";

const STEPS = [
  {
    title: "Before you apply.",
    body: "Connect your AI key, upload your resume, and link Gmail once. OneTap learns your profile and send channel, ready for every role you paste.",
    visual: "setup" as const,
  },
  {
    title: "During the search.",
    body: "Paste job descriptions as you find them. OneTap drafts tailored emails, calculates match scores, and queues sends while you keep browsing listings.",
    visual: "apply" as const,
  },
  {
    title: "After you send.",
    body: "Track every application in one dashboard. Retry failed sends, add missing contacts, and see what's working without spreadsheets or inbox archaeology.",
    visual: "track" as const,
  },
];

export function MindooStepsSection() {
  return (
    <section id="how-it-works" className="m-section m-steps">
      <div className="m-padding-global">
        <div className="m-container">
          <div className="m-steps-layout">
            <div className="m-steps-left">
              <div className="m-steps-sticky">
                <SplitHeading
                  className="m-h3 m-ch-14"
                  tertiary="From start to finish."
                  primary="A faster, more organized search."
                />
              </div>

              <div className="m-steps-scroll">
                {STEPS.map((step) => (
                  <div key={step.title} className="m-step-block">
                    <h3 className="m-h4">{step.title}</h3>
                    <p className="m-text-large">{step.body}</p>
                    <div className="m-steps-visual-mobile">
                      <ProductMockupFull />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="m-steps-right" aria-hidden>
              <div className="m-steps-visual-sticky">
                <ProductMockupFull />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
