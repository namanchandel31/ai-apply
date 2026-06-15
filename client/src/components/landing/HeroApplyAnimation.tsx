import { useHeroApplyAnimation } from "@/hooks/useHeroApplyAnimation";

const EMAIL_BODY =
  "Hi Sarah, I came across the Senior Software Engineer role and wanted to reach out. My five years building payment systems maps directly to what you're looking for…";

function GeneratingDots() {
  return (
    <span className="mh-anim-dots" aria-hidden>
      <span />
      <span />
      <span />
    </span>
  );
}

function AppliedCheck() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 13l4 4L19 7"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type Props = {
  autoApply: boolean;
};

export function HeroApplyAnimation({ autoApply }: Props) {
  const { phase, jdText, bodyText, matchScore } =
    useHeroApplyAnimation(autoApply);

  const isGenerating = phase === "generating";
  const isTyping = phase === "typing";
  const isComplete = phase === "complete";
  const isSending = phase === "sending";
  const isSent = phase === "sent";
  const isApplied = phase === "applied";
  const showEmail = isTyping || isComplete || isSending || isSent;
  const stillTyping = isTyping && bodyText.length < EMAIL_BODY.length;

  const isDone = autoApply ? isComplete || isSending || isSent : isApplied;

  const actionLabel = autoApply
    ? isSent
      ? "Sent"
      : isSending
        ? "Sending…"
        : isComplete
          ? "Auto-sending…"
          : isGenerating || isTyping
            ? "Generating…"
            : "AutoApply on"
    : isApplied
      ? "Applied"
      : isGenerating
        ? "Applying…"
        : "Hand-off on";

  return (
    <div
      className={`mh-apply-anim m-product-mockup${phase === "paste" ? " is-pasting" : ""}${isDone ? " is-complete" : ""}${isSent || isApplied ? " is-sent" : ""}${autoApply ? " is-auto" : " is-manual"}`}
      aria-label={
        autoApply
          ? "Demo: AutoApply on — paste a role and OneTap drafts the email preview"
          : "Demo: hand-off on — paste a role and OneTap applies for you automatically"
      }
    >
      <div className="m-product-grid">
        <div>
          <p className="m-mini-label">Job description</p>
          <div className={`mh-anim-jd-panel${jdText ? " has-content" : ""}`}>
            {!jdText && (
              <span className="mh-anim-placeholder">
                Add a role from LinkedIn, a job board, or anywhere…
              </span>
            )}
            {jdText && <p className="mh-anim-jd-text">{jdText}</p>}
            {!jdText && phase === "idle" && (
              <span className="mh-anim-cursor is-jd" aria-hidden />
            )}
            {phase === "paste" && <span className="mh-anim-paste-flash" aria-hidden />}
          </div>
        </div>

        <div>
          <p className="m-mini-label">{autoApply ? "Email preview" : "Status"}</p>
          <div className="mh-anim-email-panel">
            {autoApply ? (
              <>
                {isGenerating && (
                  <div className="mh-anim-skeleton" aria-hidden>
                    <div className="mh-anim-skeleton-line is-short" />
                    <div className="mh-anim-skeleton-line" />
                    <div className="mh-anim-skeleton-line" />
                    <div className="mh-anim-skeleton-line is-medium" />
                    <p className="mh-anim-status">
                      Preparing your application email
                      <GeneratingDots />
                    </p>
                  </div>
                )}

                {showEmail && (
                  <div className="mh-anim-email-content">
                    <p className="mh-anim-body">
                      {bodyText}
                      {stillTyping && (
                        <span className="mh-anim-cursor" aria-hidden />
                      )}
                    </p>
                  </div>
                )}

                {!isGenerating && !showEmail && (
                  <p className="mh-anim-email-empty m-mini-sub">
                    Your tailored email will appear here
                  </p>
                )}
              </>
            ) : isApplied ? (
              <div className="mh-anim-applied">
                <span className="mh-anim-applied-check">
                  <AppliedCheck />
                </span>
                <p className="mh-anim-applied-title">Applied successfully</p>
                <p className="m-mini-sub">OneTap handled this one for you</p>
              </div>
            ) : isGenerating ? (
              <div className="mh-anim-applying">
                <p className="mh-anim-status">
                  Submitting your application
                  <GeneratingDots />
                </p>
              </div>
            ) : (
              <p className="mh-anim-email-empty m-mini-sub">
                We'll apply the moment you add a role
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="m-product-status">
        <div className={`mh-anim-score-wrap${matchScore > 0 ? " is-visible" : ""}`}>
          <span className="m-mini-score is-lg">{matchScore || "—"}</span>
          <span className="m-mini-sub">Match score</span>
        </div>
        <span
          className={`m-mini-send is-dark mh-anim-send-btn${isComplete && autoApply ? " is-ready" : ""}${isSending ? " is-sending" : ""}${isSent || isApplied ? " is-sent-btn" : ""}`}
        >
          {actionLabel}
        </span>
      </div>
    </div>
  );
}
