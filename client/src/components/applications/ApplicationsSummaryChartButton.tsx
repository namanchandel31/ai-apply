import { lazy, Suspense, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useTrackerStatusSummary } from "@/hooks/useTrackerStatusSummary";

const ApplicationsTrackerSankey = lazy(() =>
  import("@/components/applications/ApplicationsTrackerSankey").then((m) => ({
    default: m.ApplicationsTrackerSankey,
  }))
);

export function ApplicationsSummaryChartButton() {
  const [open, setOpen] = useState(false);
  const { data, isLoading, isError, refetch, isFetching } = useTrackerStatusSummary(open);

  return (
    <>
      <Button
        variant="outline"
        className="h-9 shrink-0 px-[14px] text-base font-normal"
        onClick={() => setOpen(true)}
      >
        Summary
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Job search summary</DialogTitle>
            <DialogDescription>
              Flow of your applications by tracker status: email sent, interviews, offers, and
              more.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-[380px] rounded-[10px] border border-border bg-card p-4">
            {isLoading || isFetching ? (
              <div className="space-y-3">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-[360px] w-full" />
              </div>
            ) : isError ? (
              <div className="flex h-[360px] flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
                <p>Could not load summary.</p>
                <Button variant="outline" size="sm" onClick={() => void refetch()}>
                  Retry
                </Button>
              </div>
            ) : data ? (
              <Suspense
                fallback={
                  <div>
                    <Skeleton className="h-[360px] w-full" />
                  </div>
                }
              >
                <ApplicationsTrackerSankey summary={data} />
              </Suspense>
            ) : null}
          </div>

          {data && data.total > 0 ? (
            <p className="text-sm text-muted-foreground">
              {data.total} application{data.total === 1 ? "" : "s"} across{" "}
              {data.buckets.filter((b) => b.count > 0).length} status
              {data.buckets.filter((b) => b.count > 0).length === 1 ? "" : "es"}.
            </p>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
