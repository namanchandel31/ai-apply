import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApplicationStatusBadge } from "@/components/applications/ApplicationStatusBadge";
import { MatchScoreCell } from "@/components/applications/MatchScoreCell";
import { DateTimeCell } from "@/components/applications/DateTimeCell";
import { SafeContent } from "@/components/applications/SafeContent";
import { JsonViewer } from "@/components/applications/JsonViewer";
import { formatDateTime } from "@/lib/formatDateTime";
import { patchApplicationAfterMutation } from "@/queries/applicationsCache";
import { useRealtime } from "@/contexts/useRealtime";
import { globalOrchestrationRegistry } from "@/services/orchestration/orchestrationRegistry";
import { toast } from "sonner";

type Props = {
  applicationId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTab?: string;
};

function TimestampRow({ label, iso }: { label: string; iso?: string | null }) {
  const { date, time } = formatDateTime(iso);
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm border-b border-border/40 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">
        <span className="block">{date}</span>
        {time ? <span className="text-xs text-muted-foreground">{time}</span> : null}
      </span>
    </div>
  );
}

export function ApplicationDetailsSheet({
  applicationId,
  open,
  onOpenChange,
  initialTab = "overview",
}: Props) {
  const queryClient = useQueryClient();
  const { broadcastRevive } = useRealtime();
  const [continueEmail, setContinueEmail] = useState("");
  const [actionBusy, setActionBusy] = useState(false);

  const {
    data: detailRes,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["application", applicationId],
    queryFn: async ({ signal }) => {
      const res = await api.getApplication(applicationId!, { signal });
      return res.data;
    },
    enabled: open && !!applicationId,
    staleTime: 30_000,
  });

  const app = detailRes;

  const handleRetry = async () => {
    if (!applicationId || actionBusy) return;
    setActionBusy(true);
    const reg = globalOrchestrationRegistry.get(applicationId);
    broadcastRevive(applicationId, (reg?.orchestrationEpoch ?? 0) + 1);
    try {
      const res = await api.retryApplication(applicationId);
      patchApplicationAfterMutation(queryClient, applicationId, {
        status: res.data.status,
        uiStatus: "queued",
        pollable: true,
        terminal: false,
      });
      toast.success("Retry queued");
      void refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Retry failed");
    } finally {
      setActionBusy(false);
    }
  };

  const handleContinue = async () => {
    if (!applicationId || actionBusy) return;
    const email = continueEmail.trim();
    if (!email) {
      toast.error("Enter a contact email");
      return;
    }
    setActionBusy(true);
    const reg = globalOrchestrationRegistry.get(applicationId);
    broadcastRevive(applicationId, (reg?.orchestrationEpoch ?? 0) + 1);
    try {
      await api.continueApplication(applicationId, email);
      patchApplicationAfterMutation(queryClient, applicationId, {
        uiStatus: "sending",
        pollable: true,
        terminal: false,
      });
      toast.success("Send queued");
      void refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Continue failed");
    } finally {
      setActionBusy(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex flex-col p-0 gap-0 sm:max-w-xl md:max-w-2xl">
        <SheetHeader className="px-6 py-4 shrink-0">
          {isLoading ? (
            <>
              <SheetTitle>Loading…</SheetTitle>
              <SheetDescription>Fetching application details</SheetDescription>
            </>
          ) : isError || !app ? (
            <>
              <SheetTitle>Could not load application</SheetTitle>
              <Button variant="outline" size="sm" className="mt-2 w-fit" onClick={() => void refetch()}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </>
          ) : (
            <>
              <div className="flex items-start justify-between gap-3 pr-8">
                <div>
                  <SheetTitle className="text-left">{app.role ?? "Application"}</SheetTitle>
                  <SheetDescription className="text-left mt-1">
                    {app.company ?? "Unknown company"}
                  </SheetDescription>
                </div>
                <ApplicationStatusBadge app={app} />
              </div>
              <div className="mt-3">
                <MatchScoreCell score={app.matchScore} />
              </div>
            </>
          )}
        </SheetHeader>

        {isLoading && (
          <div className="flex flex-1 items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {app && !isLoading && (
          <div className="flex flex-1 flex-col min-h-0 overflow-hidden px-6 pb-6">
            {(app.canRetry || app.canContinue) && (
              <div className="flex flex-wrap gap-2 mb-4 shrink-0">
                {app.canRetry && (
                  <Button size="sm" variant="outline" disabled={actionBusy} onClick={() => void handleRetry()}>
                    Retry
                  </Button>
                )}
                {app.canContinue && (
                  <div className="flex gap-2 flex-1 min-w-[200px]">
                    <Input
                      type="email"
                      placeholder="Contact email"
                      className="h-8 text-sm"
                      value={continueEmail}
                      onChange={(e) => setContinueEmail(e.target.value)}
                    />
                    <Button size="sm" disabled={actionBusy} onClick={() => void handleContinue()}>
                      Continue
                    </Button>
                  </div>
                )}
              </div>
            )}

            <Tabs defaultValue={initialTab} className="flex flex-1 flex-col min-h-0">
              <TabsList className="w-full justify-start shrink-0">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="email">Email</TabsTrigger>
                <TabsTrigger value="errors">Errors</TabsTrigger>
                <TabsTrigger value="snapshots">Snapshots</TabsTrigger>
                <TabsTrigger value="raw">Raw</TabsTrigger>
                <TabsTrigger value="activity">Activity</TabsTrigger>
              </TabsList>
              <div className="flex-1 overflow-y-auto mt-4 pr-1">
                <TabsContent value="overview" className="mt-0 space-y-4">
                  <div className="rounded-md border p-3">
                    <TimestampRow label="Created" iso={app.createdAt} />
                    <TimestampRow label="Updated" iso={app.updatedAt} />
                    <TimestampRow label="Sent" iso={app.sentAt} />
                    <TimestampRow label="Completed" iso={app.completedAt} />
                    <TimestampRow label="Failed" iso={app.failedAt} />
                  </div>
                  <div className="text-sm space-y-1">
                    <p>
                      <span className="text-muted-foreground">ID: </span>
                      <code className="text-xs">{app.id}</code>
                    </p>
                    {app.recipientEmail && (
                      <p>
                        <span className="text-muted-foreground">Recipient: </span>
                        {app.recipientEmail}
                      </p>
                    )}
                    <p>
                      <span className="text-muted-foreground">Orchestration: </span>
                      v{app.orchestrationVersion ?? 0} / epoch {app.orchestrationEpoch ?? 0}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Retries: </span>
                      {app.retryCount ?? 0}
                    </p>
                  </div>
                </TabsContent>
                <TabsContent value="email" className="mt-0 space-y-3">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Subject</p>
                    <SafeContent text={app.emailSubject} />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Body</p>
                    <SafeContent text={app.emailBody} className="max-h-96 overflow-auto" />
                  </div>
                </TabsContent>
                <TabsContent value="errors" className="mt-0 space-y-3">
                  {app.lastError && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Last error</p>
                      <SafeContent text={app.lastError} />
                    </div>
                  )}
                  {app.failureStage && (
                    <p className="text-sm">
                      <span className="text-muted-foreground">Failure stage: </span>
                      {app.failureStage}
                    </p>
                  )}
                  <JsonViewer data={app.error} title="Error payload" />
                </TabsContent>
                <TabsContent value="snapshots" className="mt-0 space-y-3">
                  <JsonViewer data={app.parsedJdSnapshot} title="Parsed JD" />
                  <JsonViewer data={app.parsedResumeSnapshot} title="Parsed resume" />
                  <JsonViewer data={app.emailMetadata} title="Email metadata" />
                  <JsonViewer data={app.emailFeedbackSignals} title="Feedback signals" />
                </TabsContent>
                <TabsContent value="raw" className="mt-0">
                  {app.llmRawOutputTruncated && (
                    <p className="text-xs text-amber-700 mb-2 rounded-md bg-amber-500/10 px-2 py-1">
                      Output truncated on server for size — full load may be added later.
                    </p>
                  )}
                  <SafeContent text={app.llmRawOutput} className="font-mono text-xs max-h-[60vh] overflow-auto" />
                </TabsContent>
                <TabsContent value="activity" className="mt-0">
                  {!app.events?.length ? (
                    <p className="text-sm text-muted-foreground">No activity events recorded.</p>
                  ) : (
                    <ul className="space-y-2">
                      {app.events.map((ev) => (
                        <li
                          key={ev.id}
                          className="rounded-md border px-3 py-2 text-sm"
                        >
                          <div className="flex justify-between gap-2">
                            <span className="font-medium">{ev.eventType}</span>
                            <DateTimeCell iso={ev.createdAt} />
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {ev.actorType}
                            {ev.actorId ? ` · ${ev.actorId}` : ""}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </TabsContent>
              </div>
            </Tabs>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
