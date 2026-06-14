import { useEffect, useRef } from "react";
import confetti from "canvas-confetti";

type Props = {
  active: boolean;
  onComplete?: () => void;
  durationMs?: number;
};

export function OnboardingConfetti({ active, onComplete, durationMs = 2800 }: Props) {
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (!active) return;

    const end = Date.now() + durationMs;

    const burst = () => {
      confetti({
        particleCount: 4,
        angle: 60,
        spread: 62,
        origin: { x: 0, y: 0.65 },
        zIndex: 9999,
      });
      confetti({
        particleCount: 4,
        angle: 120,
        spread: 62,
        origin: { x: 1, y: 0.65 },
        zIndex: 9999,
      });
    };

    burst();
    confetti({
      particleCount: 120,
      spread: 90,
      origin: { y: 0.55 },
      zIndex: 9999,
    });

    const interval = window.setInterval(() => {
      if (Date.now() > end) return;
      burst();
    }, 280);

    const completeTimer = window.setTimeout(() => {
      onCompleteRef.current?.();
    }, durationMs);

    return () => {
      window.clearInterval(interval);
      window.clearTimeout(completeTimer);
    };
  }, [active, durationMs]);

  return null;
}
