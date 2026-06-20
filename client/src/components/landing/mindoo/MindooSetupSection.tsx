import { SplitHeading } from "./shared";
import { SetupStepVisual, type SetupVisualVariant } from "./SetupStepVisual";

const SETUP_STEPS: ReadonlyArray<{
  title: string;
  body: string;
  gradient: string;
  visual: SetupVisualVariant;
}> = [
  {
    title: "Choose your plan",
    body: "Pick Bring your own AI and add an API key, or OneTap AI with hosted models included.",
    gradient: "linear-gradient(160deg, #dcfce7 0%, #f0fdf4 100%)",
    visual: "model",
  },
  {
    title: "Upload resume",
    body: "OneTap tailors every email from your experience.",
    gradient: "linear-gradient(160deg, #dbeafe 0%, #eff6ff 100%)",
    visual: "resume",
  },
  {
    title: "Connect Gmail",
    body: "Connect over SMTP with a Gmail app password. Send from your inbox.",
    gradient: "linear-gradient(160deg, #fce7f3 0%, #fdf2f8 100%)",
    visual: "smtp",
  },
];

export function MindooSetupSection() {
  return (
    <section id="how-it-works" className="m-section m-setup">
      <div className="m-padding-global">
        <div className="m-container">
          <div className="m-setup-inner">
            <SplitHeading
              className="m-h3 m-text-center m-setup-heading"
              tertiary="Set up in two minutes."
              primary="Every application after that takes seconds.."
            />

            <div className="m-setup-grid">
              {SETUP_STEPS.map((step) => (
                <article key={step.title} data-reveal="" className="m-setup-card">
                  <div
                    className="m-setup-visual-wrap"
                    style={{ background: step.gradient }}
                    aria-hidden
                  >
                    <SetupStepVisual variant={step.visual} />
                  </div>
                  <div className="m-setup-copy">
                    <h3 className="m-h5">{step.title}</h3>
                    <p className="m-body-text">{step.body}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
