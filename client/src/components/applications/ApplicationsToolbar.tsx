import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Search, RefreshCw, Filter } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { useApplicationsListParams } from "@/contexts/ApplicationsListParamsContext";
import { PAGE_SIZE_OPTIONS } from "@/lib/normalizeApplicationsListParams";
import { applicationsListQueryKey } from "@/queries/applicationsListQuery";
import { SseReconnectBanner } from "@/components/applications/ApplicationsListStates";
import { useRealtime } from "@/contexts/useRealtime";

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

type Props = {
  totalItems: number;
  currentPage: number;
  pageSize: number;
  isFetching: boolean;
};

export function ApplicationsToolbar({ totalItems, currentPage, pageSize, isFetching }: Props) {
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

  const start = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalItems);

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
    <div className="border-b px-4 py-3 space-y-3">
      {showReconnect && <SseReconnectBanner />}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search company or role…"
          value={searchLocal}
          onChange={(e) => setSearchLocal(e.target.value)}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Filter className="h-3.5 w-3.5" />
              {statusLabel}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56" align="start">
            <p className="text-sm font-medium mb-3">Application status</p>
            <div className="space-y-2">
              {STATUS_OPTIONS.map((opt) => (
                <div key={opt.value} className="flex items-center gap-2">
                  <Checkbox
                    id={`status-${opt.value}`}
                    checked={params.status?.includes(opt.value) ?? false}
                    onCheckedChange={(c) => toggleStatus(opt.value, c === true)}
                  />
                  <Label htmlFor={`status-${opt.value}`} className="text-sm font-normal">
                    {opt.label}
                  </Label>
                </div>
              ))}
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
          <SelectTrigger className="w-[140px] h-8 text-xs">
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
          <div className="flex gap-2 items-center">
            <Input
              type="date"
              className="h-8 w-36 text-xs"
              value={params.dateFrom?.slice(0, 10) ?? ""}
              onChange={(e) => patchParams({ dateFrom: e.target.value, datePreset: "custom" })}
            />
            <span className="text-muted-foreground text-xs">to</span>
            <Input
              type="date"
              className="h-8 w-36 text-xs"
              value={params.dateTo?.slice(0, 10) ?? ""}
              onChange={(e) => patchParams({ dateTo: e.target.value, datePreset: "custom" })}
            />
          </div>
        )}

        <Select
          value={String(params.pageSize)}
          onValueChange={(v) => patchParams({ pageSize: Number(v) })}
        >
          <SelectTrigger className="w-[110px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZE_OPTIONS.map((n) => (
              <SelectItem key={n} value={String(n)}>
                {n} / page
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <p className="text-xs text-muted-foreground ml-auto hidden sm:block">
          {totalItems === 0
            ? "No applications"
            : `Showing ${start}–${end} of ${totalItems} applications`}
        </p>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          disabled={isFetching}
          onClick={() =>
            void queryClient.invalidateQueries({
              queryKey: applicationsListQueryKey(params),
            })
          }
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
        </Button>

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={clearFilters}>
            Clear filters
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground sm:hidden">
        {totalItems === 0
          ? "No applications"
          : `Showing ${start}–${end} of ${totalItems} applications`}
      </p>
    </div>
  );
}
