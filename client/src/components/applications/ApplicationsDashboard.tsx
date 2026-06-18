import { memo, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { RowSelectionState } from "@tanstack/react-table";
import { Wifi, WifiOff } from "lucide-react";
import { ApplicationsListParamsProvider, useApplicationsListParams } from "@/contexts/ApplicationsListParamsContext";
import { getApplicationsListQueryOptions } from "@/queries/applicationsListQuery";
import {
  EMPTY_APPLICATIONS_LIST,
  getApplicationsListItems,
  normalizeApplicationsListData,
} from "@/lib/applicationsListResponse";
import { ApplicationsPageFilters } from "@/components/applications/ApplicationsPageFilters";
import { ApplicationsListErrorState } from "@/components/applications/ApplicationsListStates";
import { ApplicationsDataGrid } from "@/components/applications/ApplicationsDataGrid";
import { ApplicationsBulkActionsBar } from "@/components/applications/ApplicationsBulkActionsBar";
import { ApplicationsTableFooter } from "@/components/applications/ApplicationsTableFooter";
import { ApplicationDetailsSheet } from "@/components/applications/ApplicationDetailsSheet";
import { useRealtime } from "@/contexts/useRealtime";
import { globalOrchestrationRegistry } from "@/services/orchestration/orchestrationRegistry";
import { api } from "@/lib/api";
import {
  patchApplicationAfterMutation,
  refreshApplicationsList,
  consumePendingNewApplication,
} from "@/queries/applicationsCache";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { registerActiveListParams } from "@/services/realtime/cache/activeListParamsRegistry";
import { defaultApplicationsListParams } from "@/lib/normalizeApplicationsListParams";
import { useAuthReady } from "@/auth/AuthContext";

function ApplicationsDashboardInner() {
  const { params, patchParams, hasActiveFilters } = useApplicationsListParams();
  const queryClient = useQueryClient();
  const { broadcastRevive } = useRealtime();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const selectedIds = useMemo(
    () => Object.keys(rowSelection).filter((id) => rowSelection[id]),
    [rowSelection]
  );

  useEffect(() => {
    registerActiveListParams(params);
    return () => registerActiveListParams(defaultApplicationsListParams());
  }, [params]);

  useEffect(() => {
    if (consumePendingNewApplication()) {
      patchParams({ page: 1, status: undefined, datePreset: undefined, q: undefined });
    }
  }, [patchParams]);

  const { isResolved, isAuthenticated } = useAuthReady();

  useEffect(() => {
    if (!isResolved || !isAuthenticated) return;
    void refreshApplicationsList(queryClient);
  }, [queryClient, isResolved, isAuthenticated]);

  useEffect(() => {
    setRowSelection({});
  }, [params.page, params.pageSize]);

  const { data, isLoading, isFetching, isError, error, refetch } = useQuery({
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

  const openDetails = (id: string) => {
    setSelectedId(id);
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
    openDetails(id);
  };

  const handleSend = async (id: string) => {
    if (actionId) return;
    setActionId(id);
    const reg = globalOrchestrationRegistry.get(id);
    broadcastRevive(id, (reg?.orchestrationEpoch ?? 0) + 1);
    try {
      await api.send(id);
      patchApplicationAfterMutation(queryClient, id, {
        uiStatus: "sending",
        pollable: true,
        terminal: false,
        canSend: false,
      });
      toast.success("Send queued");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Send failed");
    } finally {
      setActionId(null);
    }
  };

  const selectedApplications = useMemo(
    () => items.filter((app) => selectedIds.includes(app.id)),
    [items, selectedIds]
  );

  const handleBulkSend = async (ids: string[]) => {
    if (actionId) return { queued: 0, failed: ids.length };
    setActionId("bulk");
    let queued = 0;
    let failed = 0;
    for (const id of ids) {
      const reg = globalOrchestrationRegistry.get(id);
      broadcastRevive(id, (reg?.orchestrationEpoch ?? 0) + 1);
      try {
        await api.send(id);
        patchApplicationAfterMutation(queryClient, id, {
          uiStatus: "sending",
          pollable: true,
          terminal: false,
          canSend: false,
        });
        queued += 1;
      } catch {
        failed += 1;
      }
    }
    setActionId(null);
    return { queued, failed };
  };

  if (isError && !items.length) {
    return (
      <>
        <ApplicationsPageFilters isFetching={isFetching} />
        <ApplicationsListErrorState
          message={error instanceof Error ? error.message : "Request failed"}
          onRetry={() => void refetch()}
        />
      </>
    );
  }

  return (
    <>
      <ApplicationsPageFilters isFetching={isFetching} />
      <div className="overflow-hidden">
        <ApplicationsDataGrid
          items={items}
          isLoading={isLoading}
          isFetching={isFetching}
          hasActiveFilters={hasActiveFilters}
          selectedId={sheetOpen ? selectedId : null}
          rowSelection={rowSelection}
          onRowSelectionChange={setRowSelection}
          onSelectRow={(id) => openDetails(id)}
          onRetry={handleRetry}
          onContinue={handleContinue}
          onSend={handleSend}
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
      />

      <ApplicationsBulkActionsBar
        selectedApplications={selectedApplications}
        onBulkSend={handleBulkSend}
        onClearSelection={() => setRowSelection({})}
        sendBusy={actionId === "bulk"}
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
