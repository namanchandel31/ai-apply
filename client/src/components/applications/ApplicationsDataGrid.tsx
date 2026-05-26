import { memo, useCallback, useMemo } from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type Row,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type { ApplicationRecord, ApplicationsListSortField } from "@/lib/api";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { displayCompany, displayRole } from "@/queries/applicationsCache";
import { useApplicationsListParams } from "@/contexts/ApplicationsListParamsContext";
import { ApplicationStatusBadge } from "@/components/applications/ApplicationStatusBadge";
import { MatchScoreCell } from "@/components/applications/MatchScoreCell";
import { DateTimeCell } from "@/components/applications/DateTimeCell";
import { ApplicationRowActions } from "@/components/applications/ApplicationRowActions";
import {
  EmptyApplicationsState,
  TableSkeletonRows,
} from "@/components/applications/ApplicationsListStates";
import { cn } from "@/lib/utils";

type Props = {
  items: ApplicationRecord[];
  isLoading: boolean;
  isFetching: boolean;
  hasActiveFilters: boolean;
  selectedId: string | null;
  onSelectRow: (id: string) => void;
  onRetry: (id: string) => void;
  onContinue: (id: string) => void;
  actionId: string | null;
};

type ApplicationTableRowProps = {
  row: Row<ApplicationRecord>;
  selectedId: string | null;
  actionId: string | null;
  onSelectRow: (id: string) => void;
  onRetry: (id: string) => void;
  onContinue: (id: string) => void;
};

const ApplicationTableRow = memo(function ApplicationTableRow({
  row,
  selectedId,
  actionId,
  onSelectRow,
  onRetry,
  onContinue,
}: ApplicationTableRowProps) {
  return (
    <TableRow
      data-state={selectedId === row.id ? "selected" : undefined}
      className={cn(
        "cursor-pointer transition-colors hover:bg-muted/50",
        selectedId === row.id && "bg-muted/40"
      )}
      onClick={() => onSelectRow(row.original.id)}
    >
      {row.getVisibleCells().map((cell) => (
        <TableCell
          key={cell.id}
          className={cn(
            "py-2.5",
            cell.column.id === "match" && "hidden sm:table-cell",
            cell.column.id === "updated" && "hidden md:table-cell"
          )}
        >
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </TableCell>
      ))}
    </TableRow>
  );
}, (prev, next) => {
  if (prev.selectedId !== next.selectedId) {
    const id = prev.row.id;
    if (id === prev.selectedId || id === next.selectedId) return false;
  }
  if (prev.actionId !== next.actionId && prev.row.id === next.row.id) return false;
  const a = prev.row.original;
  const b = next.row.original;
  return (
    a.id === b.id &&
    a.updatedAt === b.updatedAt &&
    a.uiStatus === b.uiStatus &&
    a.status === b.status &&
    a.role === b.role &&
    a.company === b.company &&
    a.matchScore === b.matchScore &&
    (a as { _partial?: boolean })._partial === (b as { _partial?: boolean })._partial
  );
});

function SortHeader({
  label,
  field,
  currentSort,
  currentOrder,
  onSort,
}: {
  label: string;
  field: ApplicationsListSortField;
  currentSort?: string;
  currentOrder?: string;
  onSort: (field: ApplicationsListSortField) => void;
}) {
  const active = currentSort === field;
  const Icon = active ? (currentOrder === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 font-medium hover:text-foreground"
      onClick={() => onSort(field)}
    >
      {label}
      <Icon className={cn("h-3.5 w-3.5", active ? "opacity-100" : "opacity-40")} />
    </button>
  );
}

export function ApplicationsDataGrid({
  items,
  isLoading,
  isFetching,
  hasActiveFilters,
  selectedId,
  onSelectRow,
  onRetry,
  onContinue,
  actionId,
}: Props) {
  const { params, patchParams } = useApplicationsListParams();

  const toggleSort = useCallback(
    (field: ApplicationsListSortField) => {
      if (params.sort === field) {
        patchParams({ order: params.order === "asc" ? "desc" : "asc", page: params.page });
      } else {
        patchParams({ sort: field, order: "desc" });
      }
    },
    [params.sort, params.order, params.page, patchParams]
  );

  const columns = useMemo<ColumnDef<ApplicationRecord>[]>(
    () => [
      {
        id: "role",
        header: () => (
          <SortHeader
            label="Role"
            field="normalized_company_name"
            currentSort={params.sort}
            currentOrder={params.order}
            onSort={toggleSort}
          />
        ),
        cell: ({ row }) => (
          <div>
            <div className="font-medium text-sm text-foreground">{displayRole(row.original)}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{displayCompany(row.original)}</div>
          </div>
        ),
      },
      {
        id: "match",
        header: () => (
          <SortHeader
            label="Match"
            field="match_score"
            currentSort={params.sort}
            currentOrder={params.order}
            onSort={toggleSort}
          />
        ),
        cell: ({ row }) => <MatchScoreCell score={row.original.matchScore} />,
      },
      {
        id: "status",
        header: () => (
          <SortHeader
            label="Status"
            field="application_status"
            currentSort={params.sort}
            currentOrder={params.order}
            onSort={toggleSort}
          />
        ),
        cell: ({ row }) => <ApplicationStatusBadge app={row.original} />,
      },
      {
        id: "updated",
        header: () => (
          <SortHeader
            label="Updated"
            field="updated_at"
            currentSort={params.sort}
            currentOrder={params.order}
            onSort={toggleSort}
          />
        ),
        cell: ({ row }) => (
          <DateTimeCell iso={row.original.updatedAt ?? row.original.createdAt} />
        ),
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <ApplicationRowActions
            app={row.original}
            disabled={actionId === row.original.id}
            onViewDetails={() => onSelectRow(row.original.id)}
            onRetry={() => onRetry(row.original.id)}
            onContinue={() => onContinue(row.original.id)}
          />
        ),
      },
    ],
    [params.sort, params.order, actionId, onSelectRow, onRetry, onContinue, toggleSort]
  );

  const table = useReactTable({
    data: items,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
  });

  if (isLoading && items.length === 0) {
    return (
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur">
          <TableRow>
            <TableHead>Role</TableHead>
            <TableHead className="hidden sm:table-cell">Match</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="hidden md:table-cell">Updated</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableSkeletonRows />
        </TableBody>
      </Table>
    );
  }

  if (!items.length) {
    return <EmptyApplicationsState filtered={hasActiveFilters} />;
  }

  return (
    <div
      className={cn(
        "overflow-x-auto transition-opacity",
        isFetching && !isLoading && "opacity-70"
      )}
    >
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur">
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id}>
              {hg.headers.map((h) => (
                <TableHead
                  key={h.id}
                  className={cn(
                    h.id === "match" && "hidden sm:table-cell",
                    h.id === "updated" && "hidden md:table-cell"
                  )}
                >
                  {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <ApplicationTableRow
              key={row.id}
              row={row}
              selectedId={selectedId}
              actionId={actionId}
              onSelectRow={onSelectRow}
              onRetry={onRetry}
              onContinue={onContinue}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
