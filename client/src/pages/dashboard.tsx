import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { LoadingTimer } from "@/components/loading-timer";
import { useSetupStatus } from "@/hooks/useSetupStatus";
import { AlertCircle, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { PageId } from "@/components/layout";

interface DashboardProps {
  onNavigate: (page: PageId) => void;
}

export function Dashboard({ onNavigate }: DashboardProps) {
  const { data: status, isLoading, isSuccess, isError } = useSetupStatus();
  const [loadingTask, setLoadingTask] = useState<{
    type: "resume" | "jd" | "apply";
    label: string;
    startedAt: number;
  } | null>(null);

  const setupLoaded = !isLoading && (isSuccess || isError);
  const hasResume = !!status?.hasResume;
  const hasValidResume = status?.hasValidResume ?? hasResume;
  const hasEmailSetup = !!status?.hasEmailSetup;
  const hasAiSetup = !!status?.hasAiSetup;
  const canApply = setupLoaded && hasValidResume && hasEmailSetup && hasAiSetup && !loadingTask;

  useEffect(() => {
    if (isError) {
      toast.error("Failed to load setup status");
    }
  }, [isError]);

  const handleApply = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canApply) return;

    const fd = new FormData(e.currentTarget);
    const text = String(fd.get("jdText")).trim();
    if (!text) return toast.error("Paste the job description first.");

    setLoadingTask({
      type: "apply",
      label: "Queuing your application…",
      startedAt: Date.now(),
    });

    try {
      const applyRes = await api.autoApply(text);
      toast.success("Application queued — we'll draft and send it in the background.", {
        description: `Application ${applyRes.applicationId.slice(0, 8)}…`,
      });

      const textarea = document.getElementById("jd-text") as HTMLTextAreaElement;
      if (textarea) textarea.value = "";
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Application flow failed");
    } finally {
      setLoadingTask(null);
    }
  };

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
    <div className="p-8 lg:p-10 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="font-serif text-3xl">Dashboard</h1>
        <p className="mt-1 text-muted-foreground">
          Your AI-powered productivity center.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {isLoading ? (
          <>
            <Skeleton className="h-[140px] w-full rounded-xl" />
            <Skeleton className="h-[140px] w-full rounded-xl" />
          </>
        ) : (
          <>
            <Card className={setupLoaded && !hasResume ? "border-amber-500/50" : ""}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center justify-between">
                  Resume Status
                  {hasResume ? (
                    <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 font-normal">
                      Ready
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 font-normal">
                      Required
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {hasResume && status?.activeResume ? (
                  <div className="space-y-1">
                    <p className="font-medium text-sm">{status.activeResume.filename}</p>
                    <p className="text-xs text-muted-foreground">
                      Uploaded {new Date(status.activeResume.uploadedAt).toLocaleDateString()}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-amber-500" />
                      Upload a resume before applying.
                    </p>
                    <Button size="sm" variant="outline" onClick={() => onNavigate("setup")}>
                      Upload Resume
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className={setupLoaded && !hasEmailSetup ? "border-amber-500/50" : ""}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center justify-between">
                  Email Status
                  {hasEmailSetup ? (
                    <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 font-normal">
                      Connected
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 font-normal">
                      Required
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {hasEmailSetup && status?.email ? (
                  <div className="space-y-1">
                    <p className="font-medium text-sm">{status.email}</p>
                    <p className="text-xs text-muted-foreground">SMTP authenticated</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-amber-500" />
                      Connect your email account to send applications.
                    </p>
                    <Button size="sm" variant="outline" onClick={() => onNavigate("setup")}>
                      Connect Email
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <Card className="max-w-4xl mx-auto border-2 shadow-sm">
        <CardHeader className="text-center pb-4 pt-8">
          <CardTitle className="font-serif text-3xl">Apply to a Job</CardTitle>
          <CardDescription className="text-base mt-2">
            Paste the job description — AI will tailor and send your application in the background.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-8 pb-8">
          <form onSubmit={handleApply} className="space-y-6">
            <Textarea
              id="jd-text"
              name="jdText"
              placeholder="Paste the complete job description here..."
              className="min-h-[250px] rounded-xl resize-y text-base p-4 focus-visible:ring-primary/50"
              disabled={!!loadingTask}
              required
            />

            <div className="flex flex-col sm:flex-row items-start gap-4">
              <Button
                type="submit"
                size="lg"
                className="w-full sm:w-auto h-12 px-8 rounded-xl font-medium"
                disabled={!canApply}
              >
                <Send className="mr-2 h-5 w-5" />
                {canApply ? "Apply Now" : "Complete Setup To Apply"}
              </Button>
            </div>
            {applyDisabledReason && (
              <p className="text-sm text-muted-foreground">{applyDisabledReason}</p>
            )}

            {loadingTask && (
              <LoadingTimer label={loadingTask.label} startedAt={loadingTask.startedAt} />
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
