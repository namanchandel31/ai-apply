import { SplitHeading } from "./shared";
import { WaitlistForm } from "./WaitlistForm";

export function MindooCtaSection() {
  return (
    <section id="waitlist" className="m-section m-cta">
      <div className="m-spacing-xl" />
      <div className="m-padding-global">
        <div className="m-container">
          <div className="m-cta-inner">
            <SplitHeading
              className="m-h1 m-ch-18 m-text-center"
              primary="Because job searching is already stressful enough."
            />
            <p data-reveal="" className="m-cta-sub m-text-center">
              Create breathing room for your search,
              <br />
              without spending hours on every application.
            </p>

            <div data-reveal="" className="m-waitlist-card">
              <WaitlistForm />
            </div>

            <p data-reveal="" className="m-text-caption m-text-center">
              No spam. We&apos;ll only reach out when we&apos;re ready.
            </p>
          </div>
        </div>
      </div>
      <div className="m-spacing-xl" />
    </section>
  );
}
