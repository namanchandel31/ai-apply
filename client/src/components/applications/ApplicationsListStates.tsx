import { Link } from "react-router-dom";
import { Loader2, SearchX, Inbox, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableCell, TableHeader, TableRow } from "@/components/ui/table";

export function TableSkeletonRows({ rows = 6 }: { rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <TableRow key={i}>
          <TableCell>
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-24 mt-1" />
          </TableCell>
          <TableCell className="hidden sm:table-cell">
            <Skeleton className="h-4 w-12" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-6 w-20 rounded-full" />
          </TableCell>
          <TableCell className="hidden md:table-cell">
            <Skeleton className="h-4 w-24" />
          </TableCell>
          <TableCell className="w-10">
            <Skeleton className="h-8 w-8" />
          </TableCell>
        </TableRow>
      ))}
    </>
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
      <p className="font-medium">No applications yet</p>
      <p className="text-sm text-muted-foreground mt-1 max-w-sm">
        Start from the dashboard to queue your first AI-tailored application.
      </p>
      <Button asChild className="mt-4" variant="secondary">
        <Link to="/dashboard">Go to Dashboard</Link>
      </Button>
    </div>
  );
}

export function SseReconnectBanner() {
  return (
    <div className="flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-800">
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
        <TableHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur">
          {children}
        </TableHeader>
      </Table>
    </div>
  );
}
