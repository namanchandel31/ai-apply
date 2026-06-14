import { SplitHeading } from "./shared";

export function MindooProblemSection() {
  return (
    <section id="problem" className="m-section m-problem">
      <div className="m-padding-global m-h-full">
        <div className="m-container m-h-full">
          <div className="m-problem-outer">
            <div className="m-problem-content">
              <SplitHeading
                className="m-h3 m-ch-22"
                tertiary="The applying isn't the problem."
                primary="The problem is what happens before and after."
              />

              <div className="m-problem-texts">
                <p data-reveal="" className="m-problem-p">
                  Before every application comes research, resume tailoring, and deciding
                  whether a role is worth pursuing.
                </p>
                <p data-reveal="" className="m-problem-p">
                  After every application, the workload only grows. Follow-ups need to be sent,
                  interviews need preparation, recruiter conversations need context, and deadlines
                  need to be tracked. Important details become scattered across emails, notes,
                  documents, job boards, and calendars.
                </p>
                <p data-reveal="" className="m-problem-p">
                  The application is just one click. The rest is where the pressure builds.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
