import { useMemo, useState, type ComponentProps } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Send, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import type { ApplicationRecord } from "@/lib/api";
import { api } from "@/lib/api";
import {
  bulkPatchApplicationsAfterMutation,
  refreshApplicationsList,
  removeApplicationsFromList,
} from "@/queries/applicationsCache";
import { useTrackerStatuses } from "@/hooks/useTrackerStatuses";
import { TRACKER_STATUS_SUMMARY_QUERY_KEY } from "@/hooks/useTrackerStatusSummary";
import {
  sortTrackerStatusOptions,
  trackerStatusStyle,
  EMAIL_READY_TRACKER_STATUS_ID,
  type TrackerStatusOption,
} from "@/lib/trackerStatusColors";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type Props = {
  selectedApplications: ApplicationRecord[];
  onBulkSend: (ids: string[]) => Promise<{ queued: number; failed: number }>;
  onClearSelection: () => void;
  sendBusy?: boolean;
};

function StatusMenuItem({
  option,
  onSelect,
}: {
  option: TrackerStatusOption;
  onSelect: (id: string | null) => void;
}) {
  const style = trackerStatusStyle(option.color);
  return (
    <DropdownMenuItem className="gap-2" onClick={() => onSelect(option.id)}>
      <span className={cn("h-2 w-2 shrink-0 rounded-full", style.dot)} aria-hidden />
      <span className={cn("truncate", style.text)}>{option.name}</span>
    </DropdownMenuItem>
  );
}

function BulkBarButton({
  className,
  ...props
}: ComponentProps<typeof Button>) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={cn(
        "h-10 gap-2 px-3 text-base font-normal text-background hover:bg-white/10 hover:text-background",
        className
      )}
      {...props}
    />
  );
}

export function ApplicationsBulkActionsBar({
  selectedApplications,
  onBulkSend,
  onClearSelection,
  sendBusy = false,
}: Props) {
  const queryClient = useQueryClient();
  const { data: options = [] } = useTrackerStatuses();
  const sortedOptions = sortTrackerStatusOptions(options);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const selectedIds = useMemo(
    () => selectedApplications.map((app) => app.id),
    [selectedApplications]
  );
  const sendableIds = useMemo(
    () =>
      selectedApplications
        .filter(
          (app) => app.canSend && app.trackerStatusId === EMAIL_READY_TRACKER_STATUS_ID
        )
        .map((app) => app.id),
    [selectedApplications]
  );
  const count = selectedIds.length;

  const statusMutation = useMutation({
    mutationFn: (trackerStatusId: string | null) =>
      api.bulkSetApplicationTrackerStatus(selectedIds, trackerStatusId),
    onSuccess: async (res, trackerStatusId) => {
      bulkPatchApplicationsAfterMutation(queryClient, selectedIds, { trackerStatusId });
      await refreshApplicationsList(queryClient);
      void queryClient.invalidateQueries({ queryKey: TRACKER_STATUS_SUMMARY_QUERY_KEY });
      onClearSelection();
      toast.success(
        trackerStatusId
          ? `Updated status for ${res.data.updatedCount} application${res.data.updatedCount === 1 ? "" : "s"}`
          : `Cleared status for ${res.data.updatedCount} application${res.data.updatedCount === 1 ? "" : "s"}`
      );
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to update status");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.bulkDeleteApplications(selectedIds),
    onSuccess: async (res) => {
      removeApplicationsFromList(queryClient, res.data.deletedIds);
      await refreshApplicationsList(queryClient);
      void queryClient.invalidateQueries({ queryKey: TRACKER_STATUS_SUMMARY_QUERY_KEY });
      onClearSelection();
      setDeleteOpen(false);
      toast.success(
        `Deleted ${res.data.deletedCount} application${res.data.deletedCount === 1 ? "" : "s"}`
      );
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to delete applications");
    },
  });

  const sendMutation = useMutation({
    mutationFn: () => onBulkSend(sendableIds),
    onSuccess: ({ queued, failed }) => {
      if (queued > 0) {
        toast.success(
          `Queued ${queued} email${queued === 1 ? "" : "s"} for sending`
        );
      }
      if (failed > 0) {
        toast.error(`${failed} application${failed === 1 ? "" : "s"} could not be sent`);
      }
      if (queued > 0) onClearSelection();
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to send emails");
    },
  });

  if (!count) return null;

  const busy =
    statusMutation.isPending ||
    deleteMutation.isPending ||
    sendMutation.isPending ||
    sendBusy;
  const sendLabel =
    sendableIds.length > 0 && sendableIds.length < count
      ? `Send email (${sendableIds.length})`
      : "Send email";

  return (
    <>
      <div
        role="toolbar"
        aria-label="Bulk actions"
        className={cn(
          "fixed bottom-6 left-1/2 z-50 flex max-w-[calc(100vw-2rem)] items-center gap-1.5",
          "rounded-2xl bg-foreground px-4 py-3 shadow-[0_8px_32px_rgba(0,0,0,0.28)]",
          "animate-[bulk-bar-in_280ms_cubic-bezier(0.22,1,0.36,1)_both]"
        )}
      >
        <span className="whitespace-nowrap px-2.5 text-base font-medium text-background">
          {count} selected
        </span>

        <span className="mx-1.5 h-6 w-px shrink-0 bg-white/15" aria-hidden />

        {sendableIds.length > 0 ? (
          <BulkBarButton disabled={busy} onClick={() => sendMutation.mutate()}>
            <Send className="h-4 w-4" />
            {sendLabel}
          </BulkBarButton>
        ) : null}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <BulkBarButton disabled={busy}>
              Change status
              <ChevronDown className="h-4 w-4 opacity-70" />
            </BulkBarButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="center" className="max-h-72 w-56 overflow-y-auto">
            {sortedOptions.map((option) => (
              <StatusMenuItem
                key={option.id}
                option={option}
                onSelect={(id) => statusMutation.mutate(id)}
              />
            ))}
            <DropdownMenuItem
              className="text-muted-foreground"
              onClick={() => statusMutation.mutate(null)}
            >
              Clear status
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <BulkBarButton
          disabled={busy}
          className="text-red-300 hover:bg-red-500/15 hover:text-red-200"
          onClick={() => setDeleteOpen(true)}
        >
          <Trash2 className="h-4 w-4" />
          Delete
        </BulkBarButton>

        <span className="mx-1.5 h-6 w-px shrink-0 bg-white/15" aria-hidden />

        <BulkBarButton
          disabled={busy}
          className="h-10 w-10 px-0"
          aria-label="Clear selection"
          onClick={onClearSelection}
        >
          <X className="h-[18px] w-[18px]" />
        </BulkBarButton>
      </div>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Delete {count} application{count === 1 ? "" : "s"}?
            </DialogTitle>
            <DialogDescription>
              This permanently removes the selected applications and their history. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setDeleteOpen(false)}
              disabled={deleteMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
