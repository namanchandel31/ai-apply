import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import {
  APPLY_WALKTHROUGH_STEPS,
  markApplyWalkthroughSeen,
  type ApplyWalkthroughStep,
} from "@/lib/applyWalkthrough";

const TOOLTIP_GAP = 12;
const SPOTLIGHT_PAD = 8;
const VIEWPORT_PAD = 16;

type Props = {
  active: boolean;
  onComplete: () => void;
};

type TooltipLayout = {
  top: number;
  left: number;
  maxWidth: number;
};

function measureTooltip(
  rect: DOMRect,
  placement: ApplyWalkthroughStep["placement"]
): TooltipLayout {
  const maxWidth = Math.min(320, window.innerWidth - VIEWPORT_PAD * 2);
  let top: number;
  if (placement === "bottom") {
    top = rect.bottom + SPOTLIGHT_PAD + TOOLTIP_GAP;
  } else {
    top = rect.top - SPOTLIGHT_PAD - TOOLTIP_GAP;
  }
  const left = Math.min(
    Math.max(VIEWPORT_PAD, rect.left + rect.width / 2 - maxWidth / 2),
    window.innerWidth - maxWidth - VIEWPORT_PAD
  );
  return { top, left, maxWidth };
}

export function ApplyWalkthrough({ active, onComplete }: Props) {
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [tooltipLayout, setTooltipLayout] = useState<TooltipLayout | null>(null);

  const step = APPLY_WALKTHROUGH_STEPS[stepIndex];
  const isLastStep = stepIndex === APPLY_WALKTHROUGH_STEPS.length - 1;

  const finish = useCallback(() => {
    markApplyWalkthroughSeen();
    onComplete();
  }, [onComplete]);

  const updateLayout = useCallback(() => {
    if (!active || !step) return;
    const el = document.querySelector(step.target);
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setTargetRect(rect);
    setTooltipLayout(measureTooltip(rect, step.placement));
  }, [active, step]);

  useLayoutEffect(() => {
    if (!active) {
      setStepIndex(0);
      setTargetRect(null);
      setTooltipLayout(null);
      return;
    }
    updateLayout();
  }, [active, stepIndex, updateLayout]);

  useEffect(() => {
    if (!active) return;
    const onChange = () => updateLayout();
    window.addEventListener("resize", onChange);
    window.addEventListener("scroll", onChange, true);
    return () => {
      window.removeEventListener("resize", onChange);
      window.removeEventListener("scroll", onChange, true);
    };
  }, [active, updateLayout]);

  useEffect(() => {
    if (!active) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [active, finish]);

  if (!active || !step || !targetRect || !tooltipLayout) return null;

  const spotlightStyle = {
    top: targetRect.top - SPOTLIGHT_PAD,
    left: targetRect.left - SPOTLIGHT_PAD,
    width: targetRect.width + SPOTLIGHT_PAD * 2,
    height: targetRect.height + SPOTLIGHT_PAD * 2,
  };

  const tooltipStyle =
    step.placement === "top"
      ? {
          top: tooltipLayout.top,
          left: tooltipLayout.left,
          maxWidth: tooltipLayout.maxWidth,
          transform: "translateY(-100%)",
        }
      : {
          top: tooltipLayout.top,
          left: tooltipLayout.left,
          maxWidth: tooltipLayout.maxWidth,
        };

  return createPortal(
    <div className="fixed inset-0 z-[10000]" role="presentation">
      <div className="absolute inset-0" aria-hidden />

      <div
        className="pointer-events-none absolute rounded-[10px] ring-2 ring-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)] transition-[top,left,width,height] duration-200"
        style={spotlightStyle}
        aria-hidden
      />

      <div
        className="absolute z-[10001] rounded-xl border border-border bg-white p-4 shadow-[var(--shadow-popup)]"
        style={tooltipStyle}
        role="dialog"
        aria-labelledby="apply-walkthrough-title"
        aria-describedby="apply-walkthrough-body"
      >
        <p className="text-xs font-medium text-muted-foreground">
          {stepIndex + 1} of {APPLY_WALKTHROUGH_STEPS.length}
        </p>
        <h2 id="apply-walkthrough-title" className="mt-1 text-base font-semibold text-foreground">
          {step.title}
        </h2>
        <p id="apply-walkthrough-body" className="mt-2 text-base text-muted-foreground">
          {step.body}
        </p>
        <div className="mt-4 flex items-center justify-between gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={finish}>
            Skip
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              if (isLastStep) {
                finish();
              } else {
                setStepIndex((i) => i + 1);
              }
            }}
          >
            {isLastStep ? "Got it" : "Next"}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
