import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { api, type ApplicationRecord } from "@/lib/api";
import {
  useApplicationStatusPoll,
  requestPollEtagClear,
} from "@/hooks/useApplicationStatusPoll";
import { useRealtime } from "@/contexts/RealtimeProvider";
import { globalOrchestrationRegistry } from "@/services/orchestration/orchestrationRegistry";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

function StatusBadge({ app }: { app: ApplicationRecord }) {
  const ui = app.uiStatus || app.status;

  const variants: Record<string, { label: string; className?: string; variant?: "destructive" | "secondary" | "outline" }> = {
    sent: { label: "Sent", className: "bg-emerald-500/10 text-emerald-600", variant: "secondary" },
    failed: { label: "Failed", variant: "destructive" },
    cancelled: { label: "Cancelled", variant: "outline" },
    needs_review: { label: "Needs review", className: "bg-amber-500/10 text-amber-600", variant: "secondary" },
    processing: { label: "Processing", variant: "outline" },
    sending: { label: "Sending", variant: "outline" },
    queued: { label: "Queued", className: "bg-amber-500/10 text-amber-600", variant: "secondary" },
    retrying: { label: "Retrying", variant: "outline" },
    generated: { label: "Ready", variant: "secondary" },
    draft: { label: "Draft", variant: "outline" },
  };

  const cfg = variants[ui] || { label: ui, variant: "outline" as const };
  const spinning = ["processing", "sending", "queued", "retrying"].includes(ui);

  return (
    <Badge variant={cfg.variant} className={cfg.className}>
      {spinning && <Loader2 className="mr-1 h-3 w-3 animate-spin inline" />}
      {cfg.label}
    </Badge>
  );
}

export function ApplicationTable() {
  const [apps, setApps] = useState<ApplicationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [continueEmail, setContinueEmail] = useState<Record<string, string>>({});
  const [actionId, setActionId] = useState<string | null>(null);
  const timeoutToastShownRef = useRef<Set<string>>(new Set());
  const errorToastShownRef = useRef<Set<string>>(new Set());

  const { connectionState, subscribe, broadcastRevive } = useRealtime();

  useEffect(() => {
    return subscribe((event) => {
      if (event.type !== "application.updated") return;
      setApps((current) =>
        current.map((app) => {
          if (app.id !== event.applicationId) return app;
          return {
            ...app,
            status: event.status,
            uiStatus: event.uiStatus,
            terminal: event.terminal,
            executionTerminal: event.executionTerminal,
            pollable: event.pollable,
            canRetry: event.canRetry,
            canContinue: event.canContinue,
            reviewReason: event.reviewReason ?? undefined,
          };
        })
      );
    });
  }, [subscribe]);

  const pollCallbacks = useMemo(
    () => ({
      onPollTimeout: (applicationId: string) => {
        if (timeoutToastShownRef.current.has(applicationId)) return;
        timeoutToastShownRef.current.add(applicationId);
        toast.message("Processing is taking longer than expected");
      },
      onPollError: (applicationId: string, message: string) => {
        if (errorToastShownRef.current.has(applicationId)) return;
        errorToastShownRef.current.add(applicationId);
        toast.error(message);
      },
    }),
    []
  );

  const fetchApps = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await api.getApplications();
      setApps(res.data);
    } catch (err) {
      console.error(err);
      if (isRefresh) toast.error("Failed to load applications");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchApps();
  }, [fetchApps]);

  useApplicationStatusPoll(apps, setApps, {
    ...pollCallbacks,
    connectionState,
  });

  const reviveBeforeAction = (id: string) => {
    const current = globalOrchestrationRegistry.get(id);
    const nextEpoch = (current?.orchestrationEpoch ?? 0) + 1;
    broadcastRevive(id, nextEpoch);
    requestPollEtagClear(id);
    timeoutToastShownRef.current.delete(id);
    errorToastShownRef.current.delete(id);
  };

  const handleRetry = async (id: string) => {
    if (actionId) return;
    setActionId(id);
    reviveBeforeAction(id);
    try {
      const res = await api.retryApplication(id);
      const epoch = (res.data as { orchestrationEpoch?: number }).orchestrationEpoch;
      if (typeof epoch === "number") {
        broadcastRevive(id, epoch);
      }
      toast.success("Retry queued");
      await fetchApps(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Retry failed");
    } finally {
      setActionId(null);
    }
  };

  const handleContinue = async (id: string) => {
    if (actionId) return;
    const email = continueEmail[id]?.trim();
    if (!email) {
      toast.error("Enter a contact email to continue");
      return;
    }
    setActionId(id);
    reviveBeforeAction(id);
    try {
      await api.continueApplication(id, email);
      toast.success("Send queued");
      await fetchApps(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Continue failed");
    } finally {
      setActionId(null);
    }
  };

  if (loading && apps.length === 0) {
    return (
      <div className="flex justify-center p-8 border rounded-md bg-card">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="rounded-md border bg-card shadow-sm overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b bg-muted/20">
        <h2 className="font-medium">Recent Applications</h2>
        <Button variant="ghost" size="sm" onClick={() => fetchApps(true)} disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Role</TableHead>
            <TableHead>Company</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Date</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {apps.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                No applications yet.
              </TableCell>
            </TableRow>
          ) : (
            apps.map((app) => (
              <TableRow key={app.id}>
                <TableCell className="font-medium">{app.role || "Unknown Role"}</TableCell>
                <TableCell>{app.company || "Unknown Company"}</TableCell>
                <TableCell>
                  <StatusBadge app={app} />
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {new Date(app.createdAt).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-right space-y-2">
                  {app.canContinue && (
                    <div className="flex flex-col sm:flex-row gap-2 justify-end">
                      <Input
                        type="email"
                        placeholder="Contact email"
                        className="h-8 text-sm max-w-[200px] ml-auto"
                        value={continueEmail[app.id] || ""}
                        onChange={(e) =>
                          setContinueEmail((prev) => ({ ...prev, [app.id]: e.target.value }))
                        }
                        disabled={actionId === app.id}
                      />
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={actionId === app.id}
                        onClick={() => handleContinue(app.id)}
                      >
                        Continue
                      </Button>
                    </div>
                  )}
                  {app.canRetry && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={actionId === app.id}
                      onClick={() => handleRetry(app.id)}
                    >
                      Retry
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
