import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, RefreshCw } from "lucide-react";
import { api, type ApplicationRecord } from "@/lib/api";
import { useRealtime } from "@/contexts/useRealtime";
import { globalOrchestrationRegistry } from "@/services/orchestration/orchestrationRegistry";
import {
  displayCompany,
  displayRole,
  getApplicationsQueryOptions,
  patchApplicationAfterMutation,
  refreshApplicationsList,
} from "@/queries/applicationsCache";
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
  const queryClient = useQueryClient();
  const [continueEmail, setContinueEmail] = useState<Record<string, string>>({});
  const [actionId, setActionId] = useState<string | null>(null);
  const { isDegraded, broadcastRevive, resetDegraded } = useRealtime();

  const {
    data: apps = [],
    isLoading,
    isFetching,
  } = useQuery(getApplicationsQueryOptions());

  const reviveBeforeAction = (id: string) => {
    const current = globalOrchestrationRegistry.get(id);
    const nextEpoch = (current?.orchestrationEpoch ?? 0) + 1;
    broadcastRevive(id, nextEpoch);
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
      patchApplicationAfterMutation(queryClient, id, {
        status: res.data.status,
        uiStatus: "queued",
        pollable: true,
        terminal: false,
      });
      toast.success("Retry queued");
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
      const res = await api.continueApplication(id, email);
      patchApplicationAfterMutation(queryClient, id, {
        status: res.data.status,
        uiStatus: "sending",
        pollable: true,
        terminal: false,
      });
      toast.success("Send queued");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Continue failed");
    } finally {
      setActionId(null);
    }
  };

  if (isLoading && apps.length === 0) {
    return (
      <div className="flex justify-center p-8 border rounded-md bg-card">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="rounded-md border bg-card shadow-sm overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b bg-muted/20">
        <div>
          <h2 className="font-medium">Recent Applications</h2>
          {isDegraded && (
            <p className="text-xs text-amber-600 mt-1">
              Live updates temporarily unavailable.{" "}
              <button type="button" className="underline" onClick={() => void resetDegraded()}>
                Refresh status
              </button>
            </p>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => refreshApplicationsList(queryClient)}
          disabled={isFetching}
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
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
                <TableCell className="font-medium">{displayRole(app)}</TableCell>
                <TableCell>{displayCompany(app)}</TableCell>
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
