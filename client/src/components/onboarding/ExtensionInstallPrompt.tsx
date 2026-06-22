import { Check, ExternalLink, Puzzle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OneTapBrand } from "@/components/OneTapLogomark";
import { LinkedInApplyVisual } from "@/components/onboarding/LinkedInApplyVisual";
import { CHROME_EXTENSION_URL, markOnboardingExtensionPending } from "@/lib/extensionPrompt";
import { trackOnboardingEvent } from "@/lib/onboardingEvents";
import "@/styles/mindoo.css";

const BENEFITS = [
  "Detects job posts on LinkedIn automatically - no copy-paste",
  "Drafts a personalized email from your résumé in one click",
  "Keep browsing listings without switching tabs",
] as const;

type Props = {
  onContinue: () => void;
  /** When true, omits top branding — for use inside the onboarding card. */
  embedded?: boolean;
};

export function ExtensionInstallPrompt({ onContinue, embedded = false }: Props) {
  const handleInstall = () => {
    trackOnboardingEvent("extension_install_clicked");
    markOnboardingExtensionPending();
    window.open(CHROME_EXTENSION_URL, "_blank", "noopener,noreferrer");
  };

  const handleSkip = () => {
    trackOnboardingEvent("extension_prompt_skipped");
    onContinue();
  };

  return (
    <div className={embedded ? "w-full" : "w-full max-w-lg overflow-visible"}>
      <div className={embedded ? "space-y-4" : "flex flex-col items-center text-center"}>
        {!embedded ? <OneTapBrand className="mb-6 justify-center" /> : null}
        {!embedded ? (
          <p className="text-sm font-medium text-muted-foreground">One more thing</p>
        ) : null}
        <h2
          className={
            embedded
              ? "text-base font-medium text-foreground"
              : "mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl"
          }
        >
          {embedded ? "Install the Chrome extension" : "Apply directly from LinkedIn"}
        </h2>
        <p className={embedded ? "text-sm text-muted-foreground" : "mt-3 text-base text-muted-foreground"}>
          {embedded
            ? "Spot hiring posts on LinkedIn and queue applications while you browse."
            : "Install the OneTap Chrome extension to spot hiring posts and queue applications while you scroll your feed."}
        </p>
      </div>

      {!embedded ? (
        <div className="mt-8 w-full overflow-visible">
          <LinkedInApplyVisual />
        </div>
      ) : null}

      <ul className={embedded ? "mt-4 space-y-2" : "mt-8 space-y-3"}>
        {BENEFITS.map((benefit) => (
          <li
            key={benefit}
            className={
              embedded
                ? "flex items-start gap-2 text-sm text-foreground"
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

      <div className={embedded ? "mt-5 flex flex-col gap-2" : "mt-8 flex flex-col gap-3"}>
        <Button type="button" className="w-full" onClick={handleInstall}>
          <Puzzle className="h-4 w-4" aria-hidden />
          Add to Chrome
          <ExternalLink className="h-3.5 w-3.5 opacity-70" aria-hidden />
        </Button>
        <Button type="button" variant="ghost" className="w-full" onClick={handleSkip}>
          Skip for now
        </Button>
      </div>

      <p className={embedded ? "mt-3 text-xs text-muted-foreground" : "mt-4 text-center text-sm text-muted-foreground"}>
        Install from the Chrome Web Store. You can add it anytime from Settings → Extension.
      </p>
    </div>
  );
}
