import { ProblemBrowserBar } from "./ProblemBrowserBar";
import { SplitHeading } from "./shared";

export function MindooProblemSection() {
  return (
    <section id="problem" className="m-section m-problem">
      <div className="m-padding-global m-h-full">
        <div className="m-container m-h-full">
          <div className="m-problem-outer">
            <div className="m-problem-content">
              <SplitHeading
                className="m-h3 m-problem-heading"
                tertiary={'The challenge isn\u2019t clicking \u201cApply.\u201d'}
                primary="It's everything that surrounds it."
              />

              <p data-reveal="" className="m-problem-lead m-body-text">
                Every opportunity comes with its own set of repetitive tasks: reading through
                job descriptions, figuring out whether you&apos;re a good fit, tailoring your
                outreach, switching between AI tools, editing emails, and keeping track of what
                you&apos;ve already done.
              </p>

              <ProblemBrowserBar />

              <div className="m-problem-texts">
                <p data-reveal="" className="m-problem-p m-body-text">
                  As your job search grows, so does the overhead. More tabs, more context switching,
                  more copy-pasting, and more mental effort spent managing the process instead of
                  focusing on the opportunities themselves.
                </p>
                <p data-reveal="" className="m-problem-p m-problem-closing m-body-text">
                  One Tap brings application generation, sending, and tracking into a single
                  workflow.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
