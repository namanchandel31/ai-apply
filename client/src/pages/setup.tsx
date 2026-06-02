import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useSetupStatus } from "@/hooks/useSetupStatus";
import { EmailStatusCard } from "@/components/EmailStatusCard";
import { EmailPreferencesCard } from "@/components/EmailPreferencesCard";
import { ResumeStatusCard } from "@/components/ResumeStatusCard";
import { AiProviderStatusCard } from "@/components/AiProviderStatusCard";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { useActivationTracking } from "@/hooks/useActivationTracking";

export function Setup() {
  const { data: status, isLoading } = useSetupStatus();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const emailCardRef = useRef<HTMLDivElement>(null);

  useActivationTracking(status, "setup");

  const handleUpdate = () => {
    queryClient.invalidateQueries({ queryKey: ["setup-status"] });
  };

  useEffect(() => {
    if (searchParams.get("focus") !== "email") return;
    const el = emailCardRef.current;
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [searchParams, isLoading]);

  if (isLoading) {
    return (
      <div className="p-8 lg:p-10 max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="font-serif text-3xl">Setup</h1>
          <p className="mt-1 text-muted-foreground">
            Manage your resume, email, and AI provider credentials.
          </p>
        </div>
        <div className="grid gap-6">
          <Skeleton className="h-[200px] w-full rounded-xl" />
          <Skeleton className="h-[200px] w-full rounded-xl" />
          <Skeleton className="h-[200px] w-full rounded-xl" />
        </div>
      </div>
    );
  }

  const expandEmail = searchParams.get("focus") === "email" && !status?.hasEmailSetup;

  return (
    <div className="p-8 lg:p-10 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="font-serif text-3xl">Setup</h1>
        <p className="mt-1 text-muted-foreground">
          Manage your resume, email, and AI provider credentials. AI billing rules are explained on the AI card below.
        </p>
      </div>

      <div className="grid gap-6">
        <AiProviderStatusCard
          activeAiProvider={
            status?.activeAiProvider?.id
              ? (status.activeAiProvider as import("@/lib/api").AiCredentialSummary)
              : null
          }
          hasAiSetup={status?.hasAiSetup}
          onUpdate={handleUpdate}
        />
        <ResumeStatusCard activeResume={status?.activeResume} onUpdate={handleUpdate} />
        <div ref={emailCardRef}>
          <EmailStatusCard
            email={status?.email}
            onUpdate={handleUpdate}
            defaultExpanded={expandEmail}
          />
        </div>
        <EmailPreferencesCard />
      </div>
    </div>
  );
}
