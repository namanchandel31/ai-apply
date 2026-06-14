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
import { ApplicationsPageFilters } from "@/components/applications/ApplicationsPageFilters";
import { ApplicationsDataGrid } from "@/components/applications/ApplicationsDataGrid";
import { ApplicationsTableFooter } from "@/components/applications/ApplicationsTableFooter";
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
      <ApplicationsPageFilters isFetching={isFetching} />
      <div className="rounded-[10px] bg-card shadow-[var(--shadow-card)] overflow-hidden">
        <ApplicationsDataGrid
          items={items}
          isLoading={isLoading}
          isFetching={isFetching}
          hasActiveFilters={hasActiveFilters}
          selectedId={sheetOpen ? selectedId : null}
          onSelectRow={(id) => openDetails(id)}
          onRetry={handleRetry}
          onContinue={handleContinue}
          actionId={actionId}
        />
        <ApplicationsTableFooter
          totalItems={page.totalItems}
          currentPage={page.currentPage}
          pageSize={page.pageSize}
          totalPages={page.totalPages}
          onPageChange={(p) => patchParams({ page: p }, { resetPage: false })}
        />
      </div>

      <ApplicationDetailsSheet
        applicationId={selectedId}
        open={sheetOpen}
        onOpenChange={(open) => {
          setSheetOpen(open);
          if (!open) setSelectedId(null);
        }}
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
          ? "border-success/30 bg-success/10 text-success"
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
      <ApplicationsDashboardInner />
    </ApplicationsListParamsProvider>
  );
}

export { RealtimeConnectionBadge };
