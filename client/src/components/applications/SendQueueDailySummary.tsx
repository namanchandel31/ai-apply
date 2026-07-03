import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, Inbox, Pause, Play, Send } from "lucide-react";
import { api, type SendQueueSummary } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { refreshApplicationsList } from "@/queries/applicationsCache";
import { useIntelligentSendQueuesEntitlement } from "@/hooks/useIntelligentSendQueuesEntitlement";

const SUMMARY_KEY = ["send-queue", "summary"] as const;

function useNextSendCountdown(
  nextSendAt: string | null | undefined,
  schedulerState: SendQueueSummary["schedulerState"] | undefined,
  active: boolean
) {
  const [label, setLabel] = useState("—");

  useEffect(() => {
    if (!active) {
      setLabel("—");
      return;
    }
    if (schedulerState === "paused") {
      setLabel("Paused");
      return;
    }
    if (schedulerState !== "active" || !nextSendAt) {
      setLabel("—");
      return;
    }

    const tick = () => {
      const diffMs = new Date(nextSendAt).getTime() - Date.now();
      if (diffMs <= 0) {
        setLabel("Any moment");
        return;
      }
      if (diffMs < 60_000) {
        setLabel("In 1 min");
        return;
      }
      const mins = Math.max(1, Math.round(diffMs / 60_000));
      if (mins < 60) {
        setLabel(`In ${mins} min`);
        return;
      }
      const hours = Math.floor(mins / 60);
      const remMins = mins % 60;
      setLabel(remMins > 0 ? `In ${hours}h ${remMins}m` : `In ${hours}h`);
    };

    tick();
    const id = window.setInterval(tick, 15_000);
    return () => window.clearInterval(id);
  }, [active, nextSendAt, schedulerState]);

  return label;
}

function StatBlock({
  icon: Icon,
  label,
  value,
  accent = false,
}: {
  icon: typeof Send;
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-1 flex-col gap-1 rounded-lg border px-4 py-3",
        accent
          ? "border-primary/20 bg-primary/[0.04]"
          : "border-border/60 bg-background/80"
      )}
    >
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
        <span className="truncate">{label}</span>
      </div>
      <p
        className={cn(
          "text-2xl font-semibold tabular-nums leading-none tracking-tight",
          accent ? "text-primary" : "text-foreground"
        )}
      >
        {value}
      </p>
    </div>
  );
}

export function SendQueueDailySummary() {
  const entitled = useIntelligentSendQueuesEntitlement();
  const queryClient = useQueryClient();

  const summaryQuery = useQuery({
    queryKey: SUMMARY_KEY,
    queryFn: async () => {
      const res = await api.getSendQueueSummary();
      return res.data;
    },
    enabled: entitled,
    refetchInterval: entitled ? 30_000 : false,
    retry: (failureCount, error) => {
      const status = (error as { status?: number })?.status;
      if (status === 404 || status === 403) return false;
      return failureCount < 1;
    },
  });

  const pauseMutation = useMutation({
    mutationFn: () => api.pauseSendQueue(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: SUMMARY_KEY });
      await refreshApplicationsList(queryClient);
    },
  });

  const resumeMutation = useMutation({
    mutationFn: () => api.resumeSendQueue(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: SUMMARY_KEY });
      await refreshApplicationsList(queryClient);
    },
  });

  const summary = summaryQuery.data;
  const nextSendLabel = useNextSendCountdown(
    summary?.nextSendAt,
    summary?.schedulerState,
    entitled
  );

  if (!entitled) return null;

  const busy = pauseMutation.isPending || resumeMutation.isPending;
  const showPause =
    summary?.schedulerState === "active" && (summary?.queuedCount ?? 0) > 0;
  const showResume = summary?.schedulerState === "paused";

  return (
    <div className="mb-4 overflow-hidden rounded-xl border border-border/70 bg-gradient-to-br from-muted/40 via-background to-muted/20 shadow-sm">
      <div className="flex flex-col gap-4 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <p className="text-sm font-semibold text-foreground">Smart send queue</p>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
            Today
          </span>
        </div>
        {(showPause || showResume) && (
          <div className="flex shrink-0 items-center gap-2">
            {showResume ? (
              <Button
                type="button"
                size="sm"
                variant="default"
                disabled={busy}
                onClick={() => resumeMutation.mutate()}
              >
                <Play className="mr-1.5 h-3.5 w-3.5" />
                Resume
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => pauseMutation.mutate()}
              >
                <Pause className="mr-1.5 h-3.5 w-3.5" />
                Pause
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="grid gap-2 px-4 pb-4 sm:grid-cols-3">
        <StatBlock icon={Send} label="Sent" value={summary?.sentToday ?? 0} />
        <StatBlock icon={Inbox} label="Queued up" value={summary?.queuedCount ?? 0} />
        <StatBlock
          icon={Clock}
          label="Next sending in"
          value={nextSendLabel}
          accent
        />
      </div>
    </div>
  );
}

export { SUMMARY_KEY as sendQueueSummaryQueryKey };
