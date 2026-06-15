type Props = {
  ready: boolean;
  autoApply: boolean;
  onAutoApplyChange: (value: boolean) => void;
};

/** Fixed outcome — the vision: more interviews, faster */
const LINE_ONE = ["Land", "more", "interviews,"];

/** The toggle is AutoApply — it only changes how involved you are */
const TAIL = {
  on: "hands-free.",
  off: "hands-on.",
} as const;

export const HERO_SUBHEAD = {
  on: "Apply from LinkedIn or any job post in one click. AI writes a personalized email from your résumé and sends it from your Gmail — automatically.",
  off: "Apply from LinkedIn or any job post in one click. AI writes a personalized email from your résumé for you to review, refine, and send from your Gmail.",
} as const;

export function HeroHeadline({ ready, autoApply, onAutoApplyChange }: Props) {
  return (
    <h1
      data-hero="heading"
      className={`mh-h1${ready ? " mh-h1-ready" : ""}`}
    >
      <span className="mh-h1-line">
        {LINE_ONE.map((word) => (
          <span key={word} className="mh-h1-word-static">
            {word}
          </span>
        ))}
      </span>

      <span className="mh-h1-line mh-h1-line-second">
        <button
          type="button"
          className={`mh-h1-toggle${autoApply ? " is-on" : ""}`}
          aria-pressed={autoApply}
          aria-label={autoApply ? "AutoApply on" : "AutoApply off"}
          onClick={() => onAutoApplyChange(!autoApply)}
        >
          <span className="mh-h1-toggle-track">
            <span className="mh-h1-toggle-thumb" />
          </span>
        </button>
        <span className="mh-h1-word-static mh-h1-line-tail">
          {autoApply ? TAIL.on : TAIL.off}
        </span>
      </span>
    </h1>
  );
}
