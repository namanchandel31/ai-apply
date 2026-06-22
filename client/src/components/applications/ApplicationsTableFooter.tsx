import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useApplicationsListParams } from "@/contexts/ApplicationsListParamsContext";
import { PAGE_SIZE_OPTIONS } from "@/lib/normalizeApplicationsListParams";
import { cn } from "@/lib/utils";

function pageWindow(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "ellipsis")[] = [];
  const add = (p: number) => {
    if (p >= 1 && p <= total && !pages.includes(p)) pages.push(p);
  };
  add(1);
  if (current > 3) pages.push("ellipsis");
  for (let p = current - 1; p <= current + 1; p++) add(p);
  if (current < total - 2) pages.push("ellipsis");
  add(total);
  return pages;
}

type Props = {
  totalItems: number;
  currentPage: number;
  pageSize: number;
  totalPages: number;
  onPageChange: (page: number) => void;
};

export function ApplicationsTableFooter({
  totalItems,
  currentPage,
  pageSize,
  totalPages,
  onPageChange,
}: Props) {
  const { params, patchParams } = useApplicationsListParams();

  const start = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalItems);
  const pages = pageWindow(currentPage, totalPages);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3">
      <p className="text-sm text-muted-foreground">
        {totalItems === 0
          ? "No applications"
          : `Showing ${start}-${end} of ${totalItems} applications`}
      </p>

      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            className="h-9 w-9 p-0"
            disabled={currentPage <= 1}
            onClick={() => onPageChange(currentPage - 1)}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          {pages.map((p, i) =>
            p === "ellipsis" ? (
              <span key={`e-${i}`} className="px-2 text-sm text-muted-foreground">
                …
              </span>
            ) : (
              <Button
                key={p}
                variant={p === currentPage ? "default" : "outline"}
                className={cn("h-9 min-w-9 text-sm", p === currentPage && "pointer-events-none")}
                aria-current={p === currentPage ? "page" : undefined}
                onClick={() => onPageChange(p)}
              >
                {p}
              </Button>
            )
          )}
          <Button
            variant="outline"
            className="h-9 w-9 p-0"
            disabled={currentPage >= totalPages}
            onClick={() => onPageChange(currentPage + 1)}
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      <Select
        value={String(params.pageSize)}
        onValueChange={(v) => patchParams({ pageSize: Number(v) })}
      >
        <SelectTrigger className="h-9 w-[120px] text-sm">
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
    </div>
  );
}
