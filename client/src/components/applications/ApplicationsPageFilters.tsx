import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Search, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { useApplicationsListParams } from "@/contexts/ApplicationsListParamsContext";
import { applicationsListQueryKey } from "@/queries/applicationsListQuery";
import { SseReconnectBanner } from "@/components/applications/ApplicationsListStates";
import { ApplicationsSummaryChartButton } from "@/components/applications/ApplicationsSummaryChartButton";
import { useRealtime } from "@/contexts/useRealtime";
import { cn } from "@/lib/utils";

const controlClass = "h-9 rounded-[10px] text-base font-normal";

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "generated", label: "Ready" },
  { value: "needs_review", label: "Needs review" },
  { value: "sent", label: "Sent" },
  { value: "failed", label: "Failed" },
  { value: "cancelled", label: "Cancelled" },
];

const DATE_OPTIONS = [
  { value: "", label: "All time" },
  { value: "today", label: "Today" },
  { value: "last7", label: "Last 7 days" },
  { value: "last30", label: "Last 30 days" },
  { value: "custom", label: "Custom range" },
];

const filterTriggerClass =
  "inline-flex h-9 w-auto shrink-0 items-center justify-start rounded-[10px] border border-input-border bg-input px-[14px] text-base font-normal text-foreground transition-[background-color,border-color,box-shadow] duration-[120ms] ease-in-out hover:bg-black/[0.04] focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/12 data-[state=open]:bg-black/[0.04] disabled:cursor-not-allowed disabled:opacity-50";

const filterMenuItemClass =
  "flex w-full cursor-pointer select-none items-center gap-2 rounded-lg px-2 py-2 text-base font-normal text-foreground outline-none transition-colors hover:bg-black/[0.06] focus-visible:bg-black/[0.06]";

const filterMenuItemSelectedClass = "bg-black/[0.06]";

type Props = {
  isFetching: boolean;
};

export function ApplicationsPageFilters({ isFetching }: Props) {
  const { params, patchParams, clearFilters, hasActiveFilters } = useApplicationsListParams();
  const queryClient = useQueryClient();
  const { connectionState, isDegraded } = useRealtime();
  const [searchLocal, setSearchLocal] = useState(params.q ?? "");

  useEffect(() => {
    setSearchLocal(params.q ?? "");
  }, [params.q]);

  useEffect(() => {
    const t = setTimeout(() => {
      const next = searchLocal.trim();
      if ((params.q ?? "") !== next) {
        patchParams({ q: next || undefined });
      }
    }, 300);
    return () => clearTimeout(t);
  }, [searchLocal, params.q, patchParams]);

  const statusLabel =
    params.status?.length === 0 || !params.status
      ? "Status"
      : `Status (${params.status.length})`;

  const dateLabel =
    DATE_OPTIONS.find((d) => d.value === (params.datePreset ?? ""))?.label ?? "Date";

  const toggleStatus = (value: string, checked: boolean) => {
    const current = new Set(params.status ?? []);
    if (checked) current.add(value);
    else current.delete(value);
    const next = [...current];
    patchParams({ status: next.length ? next : undefined });
  };

  const showReconnect =
    connectionState === "disconnected" || connectionState === "degraded" || isDegraded;

  return (
    <div className="mb-4 space-y-3">
      {showReconnect && <SseReconnectBanner />}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className={`pl-9 ${controlClass}`}
            placeholder="Search company or role…"
            value={searchLocal}
            onChange={(e) => setSearchLocal(e.target.value)}
          />
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <button type="button" className={filterTriggerClass}>
              {statusLabel}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-1" align="start">
            <p className="px-2 py-1.5 text-base font-medium">Application status</p>
            <div className="flex flex-col">
              {STATUS_OPTIONS.map((opt) => {
                const checked = params.status?.includes(opt.value) ?? false;
                return (
                  <label
                    key={opt.value}
                    htmlFor={`status-${opt.value}`}
                    className={cn(
                      filterMenuItemClass,
                      checked && filterMenuItemSelectedClass
                    )}
                  >
                    <Checkbox
                      id={`status-${opt.value}`}
                      checked={checked}
                      onCheckedChange={(c) => toggleStatus(opt.value, c === true)}
                    />
                    <span>{opt.label}</span>
                  </label>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>

        <Select
          value={params.datePreset ?? "__all__"}
          onValueChange={(v) =>
            patchParams({
              datePreset:
                v === "__all__" ? undefined : (v as NonNullable<typeof params.datePreset>),
              dateFrom: undefined,
              dateTo: undefined,
            })
          }
        >
          <SelectTrigger className={cn(filterTriggerClass, "[&>svg]:hidden")}>
            <SelectValue placeholder="Date">{dateLabel}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {DATE_OPTIONS.map((d) => (
              <SelectItem key={d.value || "all"} value={d.value || "__all__"}>
                {d.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {params.datePreset === "custom" && (
          <div className="flex items-center gap-2">
            <Input
              type="date"
              className={`w-36 ${controlClass}`}
              value={params.dateFrom?.slice(0, 10) ?? ""}
              onChange={(e) => patchParams({ dateFrom: e.target.value, datePreset: "custom" })}
            />
            <span className="text-base text-muted-foreground">to</span>
            <Input
              type="date"
              className={`w-36 ${controlClass}`}
              value={params.dateTo?.slice(0, 10) ?? ""}
              onChange={(e) => patchParams({ dateTo: e.target.value, datePreset: "custom" })}
            />
          </div>
        )}

        {hasActiveFilters && (
          <Button variant="ghost" className={controlClass} onClick={clearFilters}>
            Clear filters
          </Button>
        )}

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <ApplicationsSummaryChartButton />

          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0"
            disabled={isFetching}
            aria-label="Refresh applications"
            onClick={() =>
              void queryClient.invalidateQueries({
                queryKey: applicationsListQueryKey(params),
              })
            }
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>
    </div>
  );
}
