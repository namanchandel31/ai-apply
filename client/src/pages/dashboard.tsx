import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { useSetupStatus } from "@/hooks/useSetupStatus";
import { useAutoApply } from "@/hooks/useApplyMode";
import { ApplyComposer } from "@/components/dashboard/ApplyComposer";
import { ApplyWalkthrough } from "@/components/dashboard/ApplyWalkthrough";
import { AutoApplyToggle } from "@/components/dashboard/AutoApplyToggle";
import { ReferralNearLimitPill } from "@/components/ReferralNearLimitPill";
import { ReferralShareDialog } from "@/components/ReferralShareDialog";
import { PageShell } from "@/components/layout/PageShell";
import { applyPageDescription } from "@/lib/applyMode";
import { shouldStartApplyWalkthrough } from "@/lib/applyWalkthrough";

export function Dashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [referralShareOpen, setReferralShareOpen] = useState(false);
  const { autoApplyEnabled, setAutoApplyEnabled, isApplyModePending } = useAutoApply();
  const { data: status, isLoading, isSuccess, isError } = useSetupStatus();
  const [walkthroughOpen, setWalkthroughOpen] = useState(false);
  const walkthroughStartedRef = useRef(false);

  const setupLoaded = !isLoading && (isSuccess || isError);
  const hasResume = !!status?.hasResume;
  const hasValidResume = !!status?.hasValidResume;
  const hasEmailSetup = !!status?.hasEmailSetup;
  const hasAiSetup = !!status?.hasAiSetup;
  const resumeParseFailed = setupLoaded && status?.resumeParseStatus === "failed";
  const resumeParsing =
    setupLoaded && hasResume && !hasValidResume && !resumeParseFailed;
  const canApply = setupLoaded && hasValidResume && hasEmailSetup && hasAiSetup;

  useEffect(() => {
    if (isError) {
      toast.error("Failed to load setup status");
    }
  }, [isError]);

  useEffect(() => {
    if (!setupLoaded || walkthroughOpen || walkthroughStartedRef.current) return;
    if (!shouldStartApplyWalkthrough()) return;
    walkthroughStartedRef.current = true;
    const timer = window.setTimeout(() => setWalkthroughOpen(true), 350);
    return () => window.clearTimeout(timer);
  }, [setupLoaded, walkthroughOpen]);

  useEffect(() => {
    if (searchParams.get("share") !== "referral") return;
    setReferralShareOpen(true);
    const next = new URLSearchParams(searchParams);
    next.delete("share");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const applyDisabledReason = !setupLoaded
    ? null
    : resumeParseFailed
      ? status?.resumeParseError ?? "Resume parsing failed. Replace your resume in Setup."
      : resumeParsing
      ? null
      : !hasValidResume
        ? "Upload and parse a resume in Setup before using auto apply"
        : !hasEmailSetup
          ? "Connect your email in Setup before applying"
          : !hasAiSetup
            ? "Configure an AI provider in Setup before applying"
            : null;

  return (
    <>
      <ReferralShareDialog open={referralShareOpen} onOpenChange={setReferralShareOpen} />
      <ApplyWalkthrough active={walkthroughOpen} onComplete={() => setWalkthroughOpen(false)} />
      <PageShell
        title="Apply"
        description={applyPageDescription(autoApplyEnabled)}
        actions={
          <AutoApplyToggle
            enabled={autoApplyEnabled}
            onEnabledChange={(v) => void setAutoApplyEnabled(v)}
            disabled={!setupLoaded || isApplyModePending}
          />
        }
      >
        <div className="space-y-4">
          <ReferralNearLimitPill onShareClick={() => setReferralShareOpen(true)} />
          <ApplyComposer
            autoApplyEnabled={autoApplyEnabled}
            canApply={canApply}
            applyDisabledReason={applyDisabledReason}
            resumeParsing={resumeParsing}
            resumeParseFailed={resumeParseFailed}
            resumeParseError={status?.resumeParseError ?? null}
          />
        </div>
      </PageShell>
    </>
  );
}
