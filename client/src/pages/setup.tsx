import { useSetupStatus } from "@/hooks/useSetupStatus";
import { EmailStatusCard } from "@/components/EmailStatusCard";
import { ResumeStatusCard } from "@/components/ResumeStatusCard";
import { AiProviderStatusCard } from "@/components/AiProviderStatusCard";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";

export function Setup() {
  const { data: status, isLoading } = useSetupStatus();
  const queryClient = useQueryClient();

  const handleUpdate = () => {
    queryClient.invalidateQueries({ queryKey: ["setup-status"] });
  };

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

  return (
    <div className="p-8 lg:p-10 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="font-serif text-3xl">Setup</h1>
        <p className="mt-1 text-muted-foreground">
          Manage your resume, email, and AI provider credentials. AI billing rules are explained on the AI card below.
        </p>
      </div>

      <div className="grid gap-6">
        <ResumeStatusCard 
          activeResume={status?.activeResume} 
          onUpdate={handleUpdate} 
        />
        <EmailStatusCard 
          email={status?.email} 
          onUpdate={handleUpdate} 
        />
        <AiProviderStatusCard
          activeAiProvider={status?.activeAiProvider}
          hasAiSetup={status?.hasAiSetup}
          onUpdate={handleUpdate}
        />
      </div>
    </div>
  );
}
