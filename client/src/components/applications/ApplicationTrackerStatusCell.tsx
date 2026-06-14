import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, MoreHorizontal, Plus } from "lucide-react";
import { toast } from "sonner";
import type { ApplicationRecord } from "@/lib/api";
import { api } from "@/lib/api";
import {
  patchApplicationAfterMutation,
  refreshApplicationsList,
} from "@/queries/applicationsCache";
import { TRACKER_STATUSES_QUERY_KEY, useTrackerStatuses } from "@/hooks/useTrackerStatuses";
import { TRACKER_STATUS_SUMMARY_QUERY_KEY } from "@/hooks/useTrackerStatusSummary";
import {
  isSystemTrackerStatus,
  sortTrackerStatusOptions,
  trackerStatusStyle,
  type TrackerStatusOption,
} from "@/lib/trackerStatusColors";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  app: ApplicationRecord;
};

function StatusLabel({ option, empty }: { option?: TrackerStatusOption; empty?: boolean }) {
  if (!option || empty) {
    return (
      <span className="inline-flex min-h-7 items-center py-1 text-base text-muted-foreground">
        Select status
      </span>
    );
  }
  const style = trackerStatusStyle(option.color);
  return (
    <span className="inline-flex min-h-7 max-w-[200px] items-center gap-2 py-1 text-base font-normal">
      <span className={cn("h-2 w-2 shrink-0 rounded-full", style.dot)} aria-hidden />
      <span className={cn("truncate", style.text)}>{option.name}</span>
    </span>
  );
}

export function ApplicationTrackerStatusCell({ app }: Props) {
  const queryClient = useQueryClient();
  const { data: options = [], isLoading } = useTrackerStatuses();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [pendingDelete, setPendingDelete] = useState<TrackerStatusOption | null>(null);

  const selected = useMemo(
    () => options.find((o) => o.id === app.trackerStatusId) ?? null,
    [options, app.trackerStatusId]
  );

  const sortedOptions = useMemo(() => sortTrackerStatusOptions(options), [options]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sortedOptions;
    return sortedOptions.filter((o) => o.name.toLowerCase().includes(q));
  }, [sortedOptions, query]);

  const exactMatch = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return options.find((o) => o.name.toLowerCase() === q) ?? null;
  }, [options, query]);

  const assignMutation = useMutation({
    mutationFn: (trackerStatusId: string | null) =>
      api.patchApplicationTrackerStatus(app.id, trackerStatusId),
    onSuccess: (_res, trackerStatusId) => {
      patchApplicationAfterMutation(queryClient, app.id, { trackerStatusId });
      void queryClient.invalidateQueries({ queryKey: TRACKER_STATUS_SUMMARY_QUERY_KEY });
      setOpen(false);
      setQuery("");
      setPendingDelete(null);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to update status");
    },
  });

  const createMutation = useMutation({
    mutationFn: (name: string) => api.createTrackerStatus(name),
    onSuccess: async (res) => {
      queryClient.setQueryData(TRACKER_STATUSES_QUERY_KEY, (prev: TrackerStatusOption[] | undefined) => {
        const list = prev ?? [];
        if (list.some((o) => o.id === res.data.option.id)) return list;
        return sortTrackerStatusOptions([...list, res.data.option]);
      });
      await assignMutation.mutateAsync(res.data.option.id);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to create status");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (statusId: string) => api.deleteTrackerStatus(statusId),
    onSuccess: async (res) => {
      const deletedId = res.data.id;
      queryClient.setQueryData(TRACKER_STATUSES_QUERY_KEY, (prev: TrackerStatusOption[] | undefined) =>
        (prev ?? []).filter((o) => o.id !== deletedId)
      );
      if (app.trackerStatusId === deletedId) {
        patchApplicationAfterMutation(queryClient, app.id, { trackerStatusId: null });
      }
      await refreshApplicationsList(queryClient);
      void queryClient.invalidateQueries({ queryKey: TRACKER_STATUS_SUMMARY_QUERY_KEY });
      setPendingDelete(null);
      toast.success(`Deleted "${res.data.name}"`);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to delete status");
    },
  });

  const busy = assignMutation.isPending || createMutation.isPending || deleteMutation.isPending;

  const handleSelect = (optionId: string | null) => {
    if (busy) return;
    if (optionId === app.trackerStatusId) {
      setOpen(false);
      setQuery("");
      return;
    }
    assignMutation.mutate(optionId);
  };

  const handleCreate = () => {
    const name = query.trim();
    if (!name || busy) return;
    if (exactMatch) {
      handleSelect(exactMatch.id);
      return;
    }
    createMutation.mutate(name);
  };

  const handleRequestDelete = (option: TrackerStatusOption) => {
    setPendingDelete(option);
  };

  const handleConfirmDelete = () => {
    if (!pendingDelete || busy) return;
    deleteMutation.mutate(pendingDelete.id);
  };

  return (
    <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            setQuery("");
            setPendingDelete(null);
          }
        }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            className="rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
            disabled={isLoading || busy}
            aria-label={selected ? `Status: ${selected.name}` : "Select status"}
          >
            <StatusLabel option={selected ?? undefined} empty={!selected} />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 p-0">
          {pendingDelete ? (
            <div className="p-3">
              <p className="text-base font-medium text-foreground">
                Delete &quot;{pendingDelete.name}&quot;?
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                This status will be removed from all applications. This cannot be undone.
              </p>
              <div className="mt-3 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setPendingDelete(null)}
                  disabled={busy}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={handleConfirmDelete}
                  disabled={busy}
                >
                  Delete
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="border-b border-border p-2">
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search or create…"
                  className="h-9 rounded-sm border-0 bg-transparent px-2 shadow-none focus-visible:ring-0"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (filtered.length === 1) {
                        handleSelect(filtered[0].id);
                      } else if (query.trim() && !exactMatch) {
                        handleCreate();
                      } else if (exactMatch) {
                        handleSelect(exactMatch.id);
                      }
                    }
                  }}
                  autoFocus
                />
              </div>
              <div className="max-h-56 overflow-y-auto p-1">
                {filtered.map((option) => {
                  const style = trackerStatusStyle(option.color);
                  const isSelected = option.id === app.trackerStatusId;
                  const canDelete = !isSystemTrackerStatus(option);
                  return (
                    <div
                      key={option.id}
                      className="group flex items-center rounded-sm hover:bg-black/[0.04]"
                    >
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 items-center gap-2 rounded-sm px-2 py-2 text-left text-base"
                        onClick={() => handleSelect(option.id)}
                        disabled={busy}
                      >
                        <span
                          className={cn("h-2.5 w-2.5 shrink-0 rounded-full", style.dot)}
                          aria-hidden
                        />
                        <span className={cn("min-w-0 flex-1 truncate", style.text)}>
                          {option.name}
                        </span>
                        {isSelected ? (
                          <Check className="h-4 w-4 shrink-0 text-muted-foreground" />
                        ) : (
                          <span className="h-4 w-4 shrink-0" aria-hidden />
                        )}
                      </button>
                      {canDelete ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="mr-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-sm text-muted-foreground opacity-0 outline-none transition-opacity hover:bg-black/[0.06] hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-100"
                              aria-label={`Actions for ${option.name}`}
                              disabled={busy}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            className="w-36"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => handleRequestDelete(option)}
                            >
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : null}
                    </div>
                  );
                })}
                {!filtered.length && !query.trim() && (
                  <p className="px-2 py-3 text-sm text-muted-foreground">No statuses yet</p>
                )}
              </div>
              {query.trim() && !exactMatch && (
                <div className="border-t border-border p-1">
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left text-base hover:bg-black/[0.04]"
                    onClick={handleCreate}
                    disabled={busy}
                  >
                    <Plus className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span>
                      Create <span className="font-medium">&quot;{query.trim()}&quot;</span>
                    </span>
                  </button>
                </div>
              )}
              {selected && (
                <div className="border-t border-border p-1">
                  <button
                    type="button"
                    className="flex w-full items-center rounded-sm px-2 py-2 text-left text-base text-muted-foreground hover:bg-black/[0.04] hover:text-foreground"
                    onClick={() => handleSelect(null)}
                    disabled={busy}
                  >
                    Clear status
                  </button>
                </div>
              )}
            </>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
