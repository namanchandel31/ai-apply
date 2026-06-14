import { useEffect } from "react";
import { toast } from "sonner";
import { useSetupStatus } from "@/hooks/useSetupStatus";
import { useAutoApply } from "@/hooks/useApplyMode";
import { ApplyComposer } from "@/components/dashboard/ApplyComposer";
import { AutoApplyToggle } from "@/components/dashboard/AutoApplyToggle";
import { PageShell } from "@/components/layout/PageShell";
import { applyPageDescription } from "@/lib/applyMode";

export function Dashboard() {
  const { autoApplyEnabled, setAutoApplyEnabled } = useAutoApply();
  const { data: status, isLoading, isSuccess, isError } = useSetupStatus();

  const setupLoaded = !isLoading && (isSuccess || isError);
  const hasResume = !!status?.hasResume;
  const hasValidResume = status?.hasValidResume ?? hasResume;
  const hasEmailSetup = !!status?.hasEmailSetup;
  const hasAiSetup = !!status?.hasAiSetup;
  const canApply = setupLoaded && hasValidResume && hasEmailSetup && hasAiSetup;

  useEffect(() => {
    if (isError) {
      toast.error("Failed to load setup status");
    }
  }, [isError]);

  const applyDisabledReason = !setupLoaded
    ? null
    : !hasValidResume
      ? "Upload and parse a resume in Setup before using auto apply"
      : !hasEmailSetup
        ? "Connect your email in Setup before applying"
        : !hasAiSetup
          ? "Configure an AI provider in Setup before applying"
          : null;

  return (
    <PageShell
      title="Apply"
      description={applyPageDescription(autoApplyEnabled)}
      actions={
        <AutoApplyToggle
          enabled={autoApplyEnabled}
          onEnabledChange={setAutoApplyEnabled}
          disabled={!setupLoaded}
        />
      }
    >
      <ApplyComposer
        autoApplyEnabled={autoApplyEnabled}
        canApply={canApply}
        applyDisabledReason={applyDisabledReason}
      />
    </PageShell>
  );
}
