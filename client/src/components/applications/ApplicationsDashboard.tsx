import { memo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Wifi, WifiOff } from "lucide-react";
import { ApplicationsListParamsProvider, useApplicationsListParams } from "@/contexts/ApplicationsListParamsContext";
import { getApplicationsListQueryOptions } from "@/queries/applicationsListQuery";
import {
  EMPTY_APPLICATIONS_LIST,
  getApplicationsListItems,
  normalizeApplicationsListData,
} from "@/lib/applicationsListResponse";
import { ApplicationsToolbar } from "@/components/applications/ApplicationsToolbar";
import { ApplicationsDataGrid } from "@/components/applications/ApplicationsDataGrid";
import { ApplicationsPagination } from "@/components/applications/ApplicationsPagination";
import { ApplicationDetailsSheet } from "@/components/applications/ApplicationDetailsSheet";
import { useRealtime } from "@/contexts/useRealtime";
import { globalOrchestrationRegistry } from "@/services/orchestration/orchestrationRegistry";
import { api } from "@/lib/api";
import { patchApplicationAfterMutation } from "@/queries/applicationsCache";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { registerActiveListParams } from "@/services/realtime/cache/activeListParamsRegistry";
import { useEffect } from "react";
import { useAuthReady } from "@/auth/AuthContext";

function ApplicationsDashboardInner() {
  const { params, patchParams, hasActiveFilters } = useApplicationsListParams();
  const queryClient = useQueryClient();
  const { broadcastRevive } = useRealtime();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetTab, setSheetTab] = useState("overview");
  const [actionId, setActionId] = useState<string | null>(null);

  useEffect(() => {
    registerActiveListParams(params);
  }, [params]);

  const { isResolved, isAuthenticated } = useAuthReady();
  const { data, isLoading, isFetching } = useQuery({
    ...getApplicationsListQueryOptions(params),
    enabled: isResolved && isAuthenticated,
    retry: (failureCount, error) => {
      const status = (error as { status?: number })?.status;
      if (status === 401 || status === 403) return false;
      return failureCount < 1;
    },
  });
  const page = normalizeApplicationsListData(data ?? EMPTY_APPLICATIONS_LIST);
  const items = getApplicationsListItems(page);

  const openDetails = (id: string, tab = "overview") => {
    setSelectedId(id);
    setSheetTab(tab);
    setSheetOpen(true);
  };

  const handleRetry = async (id: string) => {
    if (actionId) return;
    setActionId(id);
    const reg = globalOrchestrationRegistry.get(id);
    broadcastRevive(id, (reg?.orchestrationEpoch ?? 0) + 1);
    try {
      const res = await api.retryApplication(id);
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

  const handleContinue = (id: string) => {
    openDetails(id, "overview");
  };

  return (
    <>
      <div className="rounded-lg border border-border/80 bg-card shadow-sm overflow-hidden">
        <ApplicationsToolbar
          totalItems={page.totalItems}
          currentPage={page.currentPage}
          pageSize={page.pageSize}
          isFetching={isFetching}
        />
        <ApplicationsDataGrid
          items={items}
          isLoading={isLoading}
          isFetching={isFetching}
          hasActiveFilters={hasActiveFilters}
          selectedId={selectedId}
          onSelectRow={(id) => openDetails(id)}
          onRetry={handleRetry}
          onContinue={handleContinue}
          actionId={actionId}
        />
        <ApplicationsPagination
          currentPage={page.currentPage}
          totalPages={page.totalPages}
          onPageChange={(p) => patchParams({ page: p }, { resetPage: false })}
        />
      </div>

      <ApplicationDetailsSheet
        applicationId={selectedId}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        initialTab={sheetTab}
      />
    </>
  );
}

const RealtimeConnectionBadge = memo(function RealtimeConnectionBadge() {
  const { connectionState, sseConnected } = useRealtime();
  const live = connectionState === "connected" && sseConnected;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium w-fit",
        live
          ? "border-emerald-600/30 bg-emerald-600/10 text-emerald-700"
          : "border-muted bg-muted/50 text-muted-foreground"
      )}
    >
      {live ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
      {live ? "Live updates" : "Updates paused"}
    </div>
  );
});

export function ApplicationsDashboard() {
  return (
    <ApplicationsListParamsProvider>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="font-serif text-3xl tracking-tight">Applications</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track and debug AI-tailored job applications in real time.
          </p>
        </div>
        <RealtimeConnectionBadge />
      </div>
      <ApplicationsDashboardInner />
    </ApplicationsListParamsProvider>
  );
}
