import { Link } from "react-router-dom";
import { Loader2, SearchX, Inbox, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { tableCellPaddingX } from "@/components/applications/applicationsTableTypography";
import { cn } from "@/lib/utils";

export function TableSkeletonRows({ rows = 6 }: { rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <TableRow key={i}>
          <TableCell className={cn("w-12 pl-0 pr-0", tableCellPaddingX, "py-2.5")}>
            <Skeleton className="h-[18px] w-[18px]" />
          </TableCell>
          <TableCell className={cn(tableCellPaddingX, "py-2.5")}>
            <Skeleton className="h-4 w-40" />
          </TableCell>
          <TableCell className={cn(tableCellPaddingX, "py-2.5")}>
            <Skeleton className="h-4 w-16" />
          </TableCell>
          <TableCell className={cn("hidden sm:table-cell", tableCellPaddingX, "py-2.5")}>
            <Skeleton className="h-4 w-12" />
          </TableCell>
          <TableCell className={cn("hidden md:table-cell", tableCellPaddingX, "py-2.5")}>
            <Skeleton className="h-4 w-24" />
          </TableCell>
          <TableCell className={cn("w-10", tableCellPaddingX, "py-2.5")}>
            <Skeleton className="h-8 w-8" />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

export function ApplicationsListErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <p className="font-medium">Could not load applications</p>
      <p className="text-sm text-muted-foreground mt-1 max-w-sm">{message}</p>
      <Button className="mt-4" variant="secondary" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

export function EmptyApplicationsState({ filtered }: { filtered: boolean }) {
  if (filtered) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <SearchX className="h-10 w-10 text-muted-foreground mb-3" />
        <p className="font-medium">No applications match your filters</p>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
          Try adjusting search, status, or date range.
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <Inbox className="h-10 w-10 text-muted-foreground mb-3" />
      <p className="text-base font-medium">No applications yet</p>
      <p className="text-base font-normal text-muted-foreground mt-1 max-w-sm">
        Go to Apply and paste a job description to queue your first AI-tailored application.
      </p>
      <Button asChild className="mt-4" variant="secondary">
        <Link to="/dashboard">Start applying</Link>
      </Button>
    </div>
  );
}

export function SseReconnectBanner() {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-warning/10 px-3 py-2 text-sm text-warning">
      <WifiOff className="h-4 w-4 shrink-0" />
      <span>Reconnecting live updates…</span>
      <Loader2 className="h-3.5 w-3.5 animate-spin ml-auto" />
    </div>
  );
}

export function ApplicationsTableShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-background">
          {children}
        </TableHeader>
      </Table>
    </div>
  );
}
