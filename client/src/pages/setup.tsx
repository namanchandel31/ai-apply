import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useSetupStatus } from "@/hooks/useSetupStatus";
import { EmailStatusCard } from "@/components/EmailStatusCard";
import { TrialUsageProgress } from "@/components/TrialUsageProgress";
import { EmailPreferencesCard } from "@/components/EmailPreferencesCard";
import { ResumeStatusCard } from "@/components/ResumeStatusCard";
import { AiProviderStatusCard } from "@/components/AiProviderStatusCard";
import { SetupPageShell } from "@/components/layout/SetupPageShell";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { useActivationTracking } from "@/hooks/useActivationTracking";

const SETUP_DESCRIPTION =
  "Manage your resume, email, and AI provider credentials. Use the tabs below to configure each area.";

const SETUP_TABS = [
  { value: "ai", label: "AI Providers" },
  { value: "resume", label: "Resume Management" },
  { value: "email", label: "Email Configuration" },
  { value: "style", label: "Email style" },
] as const;

type SetupTab = (typeof SETUP_TABS)[number]["value"];

function visibleSetupTabs(canUseByok: boolean) {
  return canUseByok ? SETUP_TABS : SETUP_TABS.filter((t) => t.value !== "ai");
}

function resolveInitialTab(searchParams: URLSearchParams, canUseByok: boolean): SetupTab {
  if (searchParams.get("focus") === "email") return "email";
  const tab = searchParams.get("tab");
  if (tab === "resume" || tab === "email" || tab === "style") return tab;
  if (tab === "ai" && canUseByok) return "ai";
  return canUseByok ? "ai" : "resume";
}

export function Setup() {
  const { data: status, isLoading } = useSetupStatus();
  const canUseByok = status?.entitlements?.can_use_byok === true;
  const setupTabs = visibleSetupTabs(canUseByok);
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<SetupTab>(() =>
    resolveInitialTab(searchParams, canUseByok)
  );

  useActivationTracking(status, "setup");

  const handleUpdate = () => {
    queryClient.invalidateQueries({ queryKey: ["setup-status"] });
  };

  useEffect(() => {
    if (searchParams.get("focus") === "email") {
      setActiveTab("email");
    }
  }, [searchParams]);

  useEffect(() => {
    if (!canUseByok && activeTab === "ai") {
      setActiveTab("resume");
    }
  }, [canUseByok, activeTab]);

  const handleTabChange = (tab: SetupTab) => {
    setActiveTab(tab);
    const next = new URLSearchParams(searchParams);
    next.set("tab", tab);
    next.delete("focus");
    setSearchParams(next, { replace: true });
  };

  const expandEmail = searchParams.get("focus") === "email" && !status?.hasEmailSetup;

  if (isLoading) {
    return (
      <SetupPageShell title="Setup" description={SETUP_DESCRIPTION}>
        <div className="space-y-6">
          <Skeleton className="h-10 w-[520px] max-w-full rounded-sm" />
          <Skeleton className="h-[320px] w-full rounded-sm" />
        </div>
      </SetupPageShell>
    );
  }

  return (
    <SetupPageShell title="Setup" description={SETUP_DESCRIPTION}>
      <div className="space-y-6">
        <SegmentedControl
          value={activeTab}
          options={[...setupTabs]}
          onValueChange={handleTabChange}
          fullWidth={false}
        />

        {activeTab === "ai" && (
          <AiProviderStatusCard
            activeAiProvider={
              status?.activeAiProvider?.id
                ? (status.activeAiProvider as import("@/lib/api").AiCredentialSummary)
                : null
            }
            hasAiSetup={status?.hasAiSetup}
            onUpdate={handleUpdate}
          />
        )}

        {activeTab === "resume" && (
          <ResumeStatusCard
            activeResume={status?.activeResume}
            hasValidResume={status?.hasValidResume}
            resumeParseStatus={status?.resumeParseStatus}
            resumeParseError={status?.resumeParseError}
            onUpdate={handleUpdate}
          />
        )}

        {activeTab === "email" && (
          <div className="space-y-6">
            <EmailStatusCard
              email={status?.email}
              onUpdate={handleUpdate}
              defaultExpanded={expandEmail}
            />
            <TrialUsageProgress />
          </div>
        )}

        {activeTab === "style" && <EmailPreferencesCard />}
      </div>
    </SetupPageShell>
  );
}
