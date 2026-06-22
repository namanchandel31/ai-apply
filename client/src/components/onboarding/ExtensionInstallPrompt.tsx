import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ExternalLink, Loader2, Puzzle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OneTapBrand } from "@/components/OneTapLogomark";
import { LinkedInApplyVisual } from "@/components/onboarding/LinkedInApplyVisual";
import { CHROME_EXTENSION_URL } from "@/lib/extensionPrompt";
import { getSettingsExtensionUrl, pingExtension } from "@/lib/extensionBridge";
import {
  ONBOARDING_STEP_DESCRIPTION_CLASS,
  ONBOARDING_STEP_HEADLINE_CLASS,
  ONBOARDING_STEP_SECTION_CLASS,
} from "@/lib/onboardingFlow";
import { trackOnboardingEvent } from "@/lib/onboardingEvents";
import "@/styles/mindoo.css";

const BENEFITS = [
  "Detects job posts on LinkedIn automatically - no copy-paste",
  "Drafts a personalized email from your résumé in one click",
  "Keep browsing listings without switching tabs",
] as const;

type Props = {
  onContinue: () => void;
  onInstall?: () => void;
  /** When true, omits top branding — for use inside the onboarding card. */
  embedded?: boolean;
};

export function ExtensionInstallPrompt({ onContinue, onInstall, embedded = false }: Props) {
  const [awaitingInstall, setAwaitingInstall] = useState(false);
  const onInstallRef = useRef(onInstall);
  const settledRef = useRef(false);
  const checkingRef = useRef(false);

  useEffect(() => {
    onInstallRef.current = onInstall;
  }, [onInstall]);

  const settle = useCallback((installed: boolean) => {
    if (settledRef.current) return;
    settledRef.current = true;
    setAwaitingInstall(false);
    if (installed) {
      trackOnboardingEvent("extension_installed_detected");
      window.open(getSettingsExtensionUrl(), "_blank", "noopener,noreferrer");
    }
    onInstallRef.current?.();
  }, []);

  // Once the user has left for the Chrome Web Store, the onboarding tab is
  // hidden. When they come back we detect whether the extension is now
  // installed: if so we open the connect page and complete onboarding; either
  // way we never leave the page frozen on the install step.
  useEffect(() => {
    if (!awaitingInstall) return;
    let active = true;

    const detectOnReturn = async () => {
      if (!active || settledRef.current || checkingRef.current) return;
      if (document.visibilityState !== "visible") return;
      checkingRef.current = true;

      // The extension's service worker may need a moment to wake up, so retry
      // a few times before deciding it is not installed.
      for (let attempt = 0; attempt < 4 && active && !settledRef.current; attempt++) {
        try {
          await pingExtension();
          checkingRef.current = false;
          settle(true);
          return;
        } catch {
          await new Promise((resolve) => window.setTimeout(resolve, 800));
        }
      }

      checkingRef.current = false;
      if (!active || settledRef.current) return;
      settle(false);
    };

    document.addEventListener("visibilitychange", detectOnReturn);
    window.addEventListener("focus", detectOnReturn);

    return () => {
      active = false;
      document.removeEventListener("visibilitychange", detectOnReturn);
      window.removeEventListener("focus", detectOnReturn);
    };
  }, [awaitingInstall, settle]);

  const handleInstall = () => {
    if (awaitingInstall) return;
    trackOnboardingEvent("extension_install_clicked");
    settledRef.current = false;
    checkingRef.current = false;
    setAwaitingInstall(true);
    window.open(CHROME_EXTENSION_URL, "_blank", "noopener,noreferrer");
  };

  const handleManualContinue = () => {
    void (async () => {
      try {
        await pingExtension();
        settle(true);
      } catch {
        settle(false);
      }
    })();
  };

  const handleSkip = () => {
    trackOnboardingEvent("extension_prompt_skipped");
    onContinue();
  };

  const benefitsList = (
    <ul className={embedded ? "space-y-2" : "mt-8 space-y-3"}>
      {BENEFITS.map((benefit) => (
        <li
          key={benefit}
          className={
            embedded
              ? "flex items-start gap-2 text-base text-foreground"
              : "flex items-start gap-3 text-base text-foreground"
          }
        >
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
            <Check className="h-3 w-3" strokeWidth={2.5} aria-hidden />
          </span>
          {benefit}
        </li>
      ))}
    </ul>
  );

  const installButton = (
    <Button type="button" className="w-full" onClick={handleInstall} disabled={awaitingInstall}>
      {awaitingInstall ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      ) : (
        <Puzzle className="h-4 w-4" aria-hidden />
      )}
      {awaitingInstall ? "Waiting for installation…" : "Install Chrome Extension"}
      {!awaitingInstall ? <ExternalLink className="h-3.5 w-3.5 opacity-70" aria-hidden /> : null}
    </Button>
  );

  const waitingHint = awaitingInstall ? (
    <p className="text-center text-sm text-muted-foreground">
      Finish installing in the new tab, then come back here — we&apos;ll continue automatically.{" "}
      <button
        type="button"
        onClick={handleManualContinue}
        className="font-medium text-primary underline-offset-4 hover:underline"
      >
        Already installed? Continue
      </button>
    </p>
  ) : null;

  if (embedded) {
    return (
      <div className={ONBOARDING_STEP_SECTION_CLASS}>
        <div>
          <h2 className={ONBOARDING_STEP_HEADLINE_CLASS}>Install the Chrome extension</h2>
          <p className={ONBOARDING_STEP_DESCRIPTION_CLASS}>
            Apply directly from LinkedIn posts in one click.
          </p>
        </div>

        {benefitsList}

        {installButton}
        {waitingHint}
      </div>
    );
  }

  return (
    <div className="w-full max-w-lg overflow-visible">
      <div className="flex flex-col items-center text-center">
        <OneTapBrand className="mb-6 justify-center" />
        <p className="text-sm font-medium text-muted-foreground">One more thing</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Apply directly from LinkedIn
        </h2>
        <p className="mt-3 text-base text-muted-foreground">
          Install the OneTap Chrome extension to spot hiring posts and queue applications while you scroll your feed.
        </p>
      </div>

      <div className="mt-8 w-full overflow-visible">
        <LinkedInApplyVisual />
      </div>

      {benefitsList}

      <div className="mt-8 flex flex-col gap-3">
        {installButton}
        <Button type="button" variant="ghost" className="w-full" onClick={handleSkip}>
          Skip for now
        </Button>
      </div>

      {awaitingInstall ? (
        <div className="mt-4">{waitingHint}</div>
      ) : (
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Install from the Chrome Web Store. You can add it anytime from Settings → Extension.
        </p>
      )}
    </div>
  );
}
