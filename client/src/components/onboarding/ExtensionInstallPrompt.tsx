import { Check, ExternalLink, Puzzle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OneTapBrand } from "@/components/OneTapLogomark";
import { LinkedInApplyVisual } from "@/components/onboarding/LinkedInApplyVisual";
import { CHROME_EXTENSION_URL } from "@/lib/extensionPrompt";
import { trackOnboardingEvent } from "@/lib/onboardingEvents";
import "@/styles/mindoo.css";

const BENEFITS = [
  "Detects job posts on LinkedIn automatically — no copy-paste",
  "Drafts a personalized email from your résumé in one click",
  "Keep browsing listings without switching tabs",
] as const;

type Props = {
  onContinue: () => void;
};

export function ExtensionInstallPrompt({ onContinue }: Props) {
  const handleInstall = () => {
    trackOnboardingEvent("extension_install_clicked");
    window.open(CHROME_EXTENSION_URL, "_blank", "noopener,noreferrer");
  };

  const handleSkip = () => {
    trackOnboardingEvent("extension_prompt_skipped");
    onContinue();
  };

  return (
    <div className="w-full max-w-lg overflow-visible">
      <div className="flex flex-col items-center text-center">
        <OneTapBrand className="mb-6 justify-center" />
        <p className="text-sm font-medium text-muted-foreground">One more thing</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Apply directly from LinkedIn
        </h1>
        <p className="mt-3 text-base text-muted-foreground">
          Install the OneTap Chrome extension to spot hiring posts and queue applications while you
          scroll your feed.
        </p>
      </div>

      <div className="mt-8 w-full overflow-visible">
        <LinkedInApplyVisual />
      </div>

      <ul className="mt-8 space-y-3">
        {BENEFITS.map((benefit) => (
          <li key={benefit} className="flex items-start gap-3 text-base text-foreground">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
              <Check className="h-3 w-3" strokeWidth={2.5} aria-hidden />
            </span>
            {benefit}
          </li>
        ))}
      </ul>

      <div className="mt-8 flex flex-col gap-3">
        <Button type="button" className="w-full" onClick={handleInstall}>
          <Puzzle className="h-4 w-4" aria-hidden />
          Add to Chrome
          <ExternalLink className="h-3.5 w-3.5 opacity-70" aria-hidden />
        </Button>
        <Button type="button" variant="ghost" className="w-full" onClick={handleSkip}>
          Skip for now
        </Button>
      </div>

      <p className="mt-4 text-center text-sm text-muted-foreground">
        Install from the Chrome Web Store. You can add it anytime from Settings → Extension.
      </p>
    </div>
  );
}
