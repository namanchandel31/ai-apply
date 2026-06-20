import { useEffect, useState, type CSSProperties } from "react";

type Props = {
  ready: boolean;
};

export const HERO_LEAD = {
  line1: "Upload your resume once, connect to Gmail, and paste any job description.",
  line2:
    "One Tap generates a personalized application, sends it from your account, and tracks everything in one place.",
} as const;

const ROTATING_WORDS = ["apply", "track", "manage", "improve"] as const;
const LOOP_WORDS = [...ROTATING_WORDS, ROTATING_WORDS[0]];
const ROTATE_MS = 2800;
const ROTATE_TRANSITION_MS = 650;

function HeroRotatingWord() {
  const [index, setIndex] = useState(0);
  const [animate, setAnimate] = useState(true);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    const id = window.setInterval(() => {
      setIndex((current) => current + 1);
    }, ROTATE_MS);
    return () => window.clearInterval(id);
  }, [reduceMotion]);

  useEffect(() => {
    if (reduceMotion || index !== ROTATING_WORDS.length) return;

    const timeout = window.setTimeout(() => {
      setAnimate(false);
      setIndex(0);
    }, ROTATE_TRANSITION_MS);

    return () => window.clearTimeout(timeout);
  }, [index, reduceMotion]);

  useEffect(() => {
    if (animate) return;
    const id = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => setAnimate(true));
    });
    return () => window.cancelAnimationFrame(id);
  }, [animate]);

  return (
    <span className="mh-hero-rotate" aria-hidden="true">
      <span
        className={`mh-hero-rotate-track${animate ? "" : " is-instant"}`}
        style={
          reduceMotion
            ? undefined
            : ({ "--rotate-index": index } as CSSProperties)
        }
      >
        {LOOP_WORDS.map((word, i) => (
          <span key={`${word}-${i}`} className="mh-hero-rotate-word">
            {word}
          </span>
        ))}
      </span>
      <span className="sr-only">{ROTATING_WORDS.join(", ")}</span>
    </span>
  );
}

export function HeroHeadline({ ready }: Props) {
  return (
    <div className={`mh-hero-headline${ready ? " is-ready" : ""}`}>
      <h1 data-hero="heading" className="mh-h1-paper">
        <span className="sr-only">
          The fastest way to apply, track, manage, and improve your job applications.
        </span>
        <span className="mh-h1-line" aria-hidden="true">
          The fastest way to <HeroRotatingWord />
        </span>
        <span className="mh-h1-line" aria-hidden="true">
          your job applications.
        </span>
      </h1>
    </div>
  );
}
