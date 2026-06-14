import { useEffect, useState } from "react";

export type HeroAnimPhase =
  | "idle"
  | "paste"
  | "generating"
  | "typing"
  | "complete"
  | "sending"
  | "sent"
  | "applied"
  | "reset";

const JD_TEXT =
  "Senior Software Engineer @ Stripe\n\nWe're looking for a senior engineer to join the Payments Infrastructure team. You'll build distributed systems handling millions of daily transactions…";

const EMAIL_BODY =
  "Hi Sarah, I came across the Senior Software Engineer role and wanted to reach out. My five years building payment systems maps directly to what you're looking for…";

const PHASE_MS: Partial<Record<HeroAnimPhase, number>> = {
  idle: 1200,
  paste: 400,
  generating: 2200,
  complete: 2200,
  sending: 700,
  sent: 1600,
  applied: 1900,
  reset: 300,
};

const APPLYING_MS = 1100;

const TYPING_MS = 12;

export function useHeroApplyAnimation(autoApply: boolean) {
  const [phase, setPhase] = useState<HeroAnimPhase>("idle");
  const [jdVisible, setJdVisible] = useState(false);
  const [bodyText, setBodyText] = useState("");
  const [matchScore, setMatchScore] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (reducedMotion) {
      setJdVisible(true);
      setMatchScore(87);
      if (autoApply) {
        setPhase("sent");
        setBodyText(EMAIL_BODY);
      } else {
        setPhase("applied");
        setBodyText("");
      }
      return;
    }

    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout>;

    const delay = (next: HeroAnimPhase, ms: number) => {
      timeout = setTimeout(() => runPhase(next), ms);
    };

    const runPhase = (next: HeroAnimPhase) => {
      if (cancelled) return;
      setPhase(next);

      if (next === "paste") {
        setJdVisible(true);
        delay("generating", PHASE_MS.paste ?? 400);
        return;
      }

      if (next === "generating") {
        if (autoApply) {
          delay("typing", PHASE_MS.generating ?? 2200);
        } else {
          delay("applied", APPLYING_MS);
        }
        return;
      }

      if (next === "typing") {
        let charIndex = 0;
        const tick = () => {
          if (cancelled) return;
          charIndex += 1;
          setBodyText(EMAIL_BODY.slice(0, charIndex));
          if (charIndex < EMAIL_BODY.length) {
            timeout = setTimeout(tick, TYPING_MS);
          } else {
            runPhase("complete");
          }
        };
        tick();
        return;
      }

      if (next === "complete") {
        let score = 0;
        const scoreTick = () => {
          if (cancelled) return;
          score += 3;
          if (score >= 87) {
            setMatchScore(87);
            if (autoApply) {
              delay("sending", 400);
            } else {
              delay("reset", PHASE_MS.complete ?? 2200);
            }
          } else {
            setMatchScore(score);
            timeout = setTimeout(scoreTick, 24);
          }
        };
        scoreTick();
        return;
      }

      if (next === "sending") {
        delay("sent", PHASE_MS.sending ?? 700);
        return;
      }

      if (next === "sent") {
        delay("reset", PHASE_MS.sent ?? 1600);
        return;
      }

      if (next === "applied") {
        setMatchScore(87);
        delay("reset", PHASE_MS.applied ?? 1900);
        return;
      }

      if (next === "reset") {
        setJdVisible(false);
        setBodyText("");
        setMatchScore(0);
        delay("idle", PHASE_MS.reset ?? 300);
        return;
      }

      if (next === "idle") {
        delay("paste", PHASE_MS.idle ?? 1200);
      }
    };

    setPhase("idle");
    setJdVisible(false);
    setBodyText("");
    setMatchScore(0);
    runPhase("idle");

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [reducedMotion, autoApply]);

  return {
    phase,
    jdText: jdVisible ? JD_TEXT : "",
    bodyText,
    matchScore,
    reducedMotion,
    autoApply,
  };
}
