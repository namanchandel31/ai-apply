import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthReady } from "@/auth/AuthContext";
import { Loader2, RefreshCw, Send } from "lucide-react";
import { api } from "@/lib/api";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ApplicationStatusBadge } from "@/components/applications/ApplicationStatusBadge";
import { MatchScoreCell } from "@/components/applications/MatchScoreCell";
import { SafeContent } from "@/components/applications/SafeContent";
import { formatDateTime } from "@/lib/formatDateTime";
import { patchApplicationAfterMutation } from "@/queries/applicationsCache";
import { useRealtime } from "@/contexts/useRealtime";
import { globalOrchestrationRegistry } from "@/services/orchestration/orchestrationRegistry";
import { toast } from "sonner";

type Props = {
  applicationId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function TimestampRow({ label, iso }: { label: string; iso?: string | null }) {
  const { date, time } = formatDateTime(iso);
  if (!date || date === "—") return null;
  return (
    <div className="flex justify-between gap-4 py-1 text-xs text-muted-foreground/80">
      <span>{label}</span>
      <span className="text-right tabular-nums">
        {time ? `${date}, ${time}` : date}
      </span>
    </div>
  );
}

export function ApplicationDetailsSheet({
  applicationId,
  open,
  onOpenChange,
}: Props) {
  const queryClient = useQueryClient();
  const { broadcastRevive } = useRealtime();
  const { isResolved, isAuthenticated } = useAuthReady();
  const [continueEmail, setContinueEmail] = useState("");
  const [editSubject, setEditSubject] = useState("");
  const [editBody, setEditBody] = useState("");
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
    enabled: isResolved && isAuthenticated && open && !!applicationId,
    staleTime: 30_000,
  });

  const app = detailRes;
  const isReadyEditable = Boolean(app?.canSend || app?.uiStatus === "generated");

  useEffect(() => {
    if (!app) return;
    setEditSubject(app.emailSubject ?? "");
    setEditBody(app.emailBody ?? "");
  }, [app?.id, app?.emailSubject, app?.emailBody, app]);

  const handleSaveEmail = async () => {
    if (!applicationId || actionBusy) return;
    setActionBusy(true);
    try {
      await api.patchApplicationEmail(applicationId, {
        emailSubject: editSubject,
        emailBody: editBody,
      });
      toast.success("Email updated");
      void refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update email");
    } finally {
      setActionBusy(false);
    }
  };

  const handleSend = async () => {
    if (!applicationId || actionBusy) return;
    setActionBusy(true);
    const reg = globalOrchestrationRegistry.get(applicationId);
    broadcastRevive(applicationId, (reg?.orchestrationEpoch ?? 0) + 1);
    try {
      if (isReadyEditable) {
        await api.patchApplicationEmail(applicationId, {
          emailSubject: editSubject,
          emailBody: editBody,
        });
      }
      await api.send(applicationId);
      patchApplicationAfterMutation(queryClient, applicationId, {
        uiStatus: "sending",
        pollable: true,
        terminal: false,
        canSend: false,
      });
      toast.success("Send queued");
      void refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Send failed");
    } finally {
      setActionBusy(false);
    }
  };

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
        <SheetHeader className="px-6 py-4 shrink-0 border-b border-border/40">
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
          <div className="flex flex-1 flex-col min-h-0 overflow-y-auto px-6 py-4">
            {(app.canRetry || app.canContinue || app.canSend) && (
              <div className="flex flex-wrap gap-2 mb-5 shrink-0">
                {app.canRetry && (
                  <Button size="sm" variant="outline" disabled={actionBusy} onClick={() => void handleRetry()}>
                    Retry
                  </Button>
                )}
                {app.canSend && (
                  <Button size="sm" disabled={actionBusy} onClick={() => void handleSend()}>
                    <Send className="h-4 w-4 mr-2" />
                    Send
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

            <div className="space-y-4">
              {app.recipientEmail ? (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">To</p>
                  <p className="text-sm">{app.recipientEmail}</p>
                </div>
              ) : app.canContinue ? null : (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">To</p>
                  <p className="text-sm text-muted-foreground">No recipient yet</p>
                </div>
              )}

              {isReadyEditable ? (
                <>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Subject</p>
                    <Input
                      value={editSubject}
                      onChange={(e) => setEditSubject(e.target.value)}
                      className="text-sm"
                      disabled={actionBusy}
                    />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Body</p>
                    <Textarea
                      value={editBody}
                      onChange={(e) => setEditBody(e.target.value)}
                      className="min-h-[240px] text-sm"
                      disabled={actionBusy}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={actionBusy}
                      onClick={() => void handleSaveEmail()}
                    >
                      Save changes
                    </Button>
                    {app.canSend && (
                      <Button size="sm" disabled={actionBusy} onClick={() => void handleSend()}>
                        <Send className="h-4 w-4 mr-2" />
                        Send
                      </Button>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Subject</p>
                    <SafeContent text={app.emailSubject} />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Body</p>
                    <SafeContent text={app.emailBody} />
                  </div>
                </>
              )}

              {app.lastError && (
                <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2">
                  <p className="text-xs font-medium text-destructive mb-1">Error</p>
                  <SafeContent text={app.lastError} className="text-sm text-destructive/90" />
                  {app.failureStage && (
                    <p className="text-xs text-muted-foreground mt-1.5">
                      Stage: {app.failureStage}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="mt-8 pt-4 border-t border-border/30">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/60 mb-2">
                Details
              </p>
              <div className="rounded-md bg-muted/30 px-3 py-2">
                <TimestampRow label="Created" iso={app.createdAt} />
                <TimestampRow label="Updated" iso={app.updatedAt} />
                <TimestampRow label="Sent" iso={app.sentAt} />
                <TimestampRow label="Completed" iso={app.completedAt} />
                <TimestampRow label="Failed" iso={app.failedAt} />
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
