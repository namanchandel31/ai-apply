import { useCallback, useMemo } from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type Row,
  type RowSelectionState,
  type OnChangeFn,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, Loader2, RefreshCw, Send } from "lucide-react";
import type { ApplicationRecord, ApplicationsListSortField } from "@/lib/api";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { displayRole } from "@/queries/applicationsCache";
import { useApplicationsListParams } from "@/contexts/ApplicationsListParamsContext";
import {
  ApplicationTableShimmerText,
  ApplicationTableStatusCell,
} from "@/components/applications/ApplicationTableStatusCell";
import { ApplicationCompanyCell } from "@/components/applications/ApplicationCompanyCell";
import { ApplicationSourceIcon } from "@/components/applications/ApplicationSourceIcon";
import { formatDateTime } from "@/lib/formatDateTime";
import { ApplicationRowActions } from "@/components/applications/ApplicationRowActions";
import { TableRowSelectCheckbox } from "@/components/applications/TableRowSelectCheckbox";
import { Button } from "@/components/ui/button";
import {
  EmptyApplicationsState,
  TableSkeletonRows,
} from "@/components/applications/ApplicationsListStates";
import { cn } from "@/lib/utils";
import { tableTextPrimary, tableTextSecondary, tableCellPaddingX } from "@/components/applications/applicationsTableTypography";
import { EMAIL_READY_TRACKER_STATUS_ID } from "@/lib/trackerStatusColors";
import { isApplicationRowFailed, isApplicationRowTileLoading, isApplicationJdParsing } from "@/lib/applicationRowState";

type Props = {
  items: ApplicationRecord[];
  isLoading: boolean;
  isFetching: boolean;
  hasActiveFilters: boolean;
  selectedId: string | null;
  rowSelection: RowSelectionState;
  onRowSelectionChange: OnChangeFn<RowSelectionState>;
  onSelectRow: (id: string) => void;
  onRetry: (id: string) => void;
  onContinue: (id: string) => void;
  onSend: (id: string) => void;
  onSendNow: (id: string) => void;
  actionId: string | null;
};

type ApplicationTableRowProps = {
  row: Row<ApplicationRecord>;
  isSelected: boolean;
  selectedId: string | null;
  actionId: string | null;
  onSelectRow: (id: string) => void;
  onRetry: (id: string) => void;
  onContinue: (id: string) => void;
  onSend: (id: string) => void;
  onSendNow: (id: string) => void;
};

function ApplicationTableRow({
  row,
  isSelected,
  selectedId,
  actionId,
  onSelectRow,
  onRetry,
  onContinue,
  onSend,
  onSendNow,
}: ApplicationTableRowProps) {
  const app = row.original;
  const tileLoading = isApplicationRowTileLoading(app);
  const failed = isApplicationRowFailed(app);

  return (
    <TableRow
      data-state={selectedId === row.id ? "selected" : undefined}
      className={cn(
        "cursor-pointer transition-colors hover:bg-muted/50",
        selectedId === row.id && "bg-muted/40",
        isSelected && "bg-muted/30",
        tileLoading && "bg-primary/[0.03]"
      )}
      onClick={() => onSelectRow(row.original.id)}
    >
      {row.getVisibleCells().map((cell) => {
        if (cell.column.id === "select") {
          return (
            <TableCell
              key={cell.id}
              className={cn(tableCellPaddingX, "w-12 py-2.5 pl-0 pr-0")}
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            >
              {tileLoading ? (
                <div
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center"
                  aria-label="Processing application"
                >
                  <Loader2 className="h-[18px] w-[18px] animate-spin text-primary" />
                </div>
              ) : (
                <TableRowSelectCheckbox
                  checked={isSelected}
                  onCheckedChange={(checked) => row.toggleSelected(checked)}
                  aria-label={`Select ${displayRole(row.original)}`}
                />
              )}
            </TableCell>
          );
        }

        return (
          <TableCell
            key={cell.id}
            className={cn(
              tableCellPaddingX,
              "py-2.5",
              cell.column.id === "source" && "w-10 px-2",
              cell.column.id === "match" && "hidden sm:table-cell",
              cell.column.id === "updated" && "hidden md:table-cell"
            )}
          >
            {cell.column.id === "actions" ? (
              (() => {
                const showSendEmail =
                  !failed &&
                  row.original.trackerStatusId === EMAIL_READY_TRACKER_STATUS_ID &&
                  row.original.canSend;
                const showRetry = failed && row.original.canRetry;
                return (
                  <div className="flex items-center justify-end gap-1">
                    {showRetry ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-10 border-destructive/40 px-2.5 text-base font-normal text-destructive hover:bg-destructive/10 hover:text-destructive"
                        disabled={actionId === row.original.id || actionId === "bulk"}
                        onClick={(e) => {
                          e.stopPropagation();
                          onRetry(row.original.id);
                        }}
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Retry
                      </Button>
                    ) : null}
                    {showSendEmail ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="default"
                        className="h-10 px-2.5 text-base font-normal"
                        disabled={actionId === row.original.id || actionId === "bulk"}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSend(row.original.id);
                        }}
                      >
                        <Send className="h-3.5 w-3.5" />
                        Send email
                      </Button>
                    ) : null}
                    {!showSendEmail && !showRetry ? (
                      <ApplicationRowActions
                        app={row.original}
                        disabled={actionId === row.original.id || actionId === "bulk"}
                        onViewDetails={() => onSelectRow(row.original.id)}
                        onRetry={() => onRetry(row.original.id)}
                        onContinue={() => onContinue(row.original.id)}
                        onSend={() => onSend(row.original.id)}
                        onSendNow={() => onSendNow(row.original.id)}
                      />
                    ) : null}
                  </div>
                );
              })()
            ) : (
              flexRender(cell.column.columnDef.cell, cell.getContext())
            )}
          </TableCell>
        );
      })}
    </TableRow>
  );
}

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
      className={cn("inline-flex items-center gap-1", tableTextSecondary)}
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
  rowSelection,
  onRowSelectionChange,
  onSelectRow,
  onRetry,
  onContinue,
  onSend,
  onSendNow,
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
        id: "select",
        header: () => null,
        cell: () => null,
        enableSorting: false,
        enableHiding: false,
      },
      {
        id: "source",
        header: () => <span className="sr-only">Source</span>,
        cell: ({ row }) => (
          <div className="flex items-center justify-center">
            <ApplicationSourceIcon sourcePlatform={row.original.sourcePlatform} />
          </div>
        ),
        enableSorting: false,
        enableHiding: false,
      },
      {
        id: "role",
        header: () => <span className={tableTextSecondary}>Role</span>,
        cell: ({ row }) => (
          <ApplicationTableShimmerText shimmer={isApplicationJdParsing(row.original)} className={tableTextPrimary}>
            {displayRole(row.original)}
          </ApplicationTableShimmerText>
        ),
      },
      {
        id: "company",
        header: () => (
          <SortHeader
            label="Company"
            field="normalized_company_name"
            currentSort={params.sort}
            currentOrder={params.order}
            onSort={toggleSort}
          />
        ),
        cell: ({ row }) => <ApplicationCompanyCell app={row.original} />,
      },
      {
        id: "status",
        header: () => <span className={tableTextSecondary}>Status</span>,
        cell: ({ row }) => <ApplicationTableStatusCell app={row.original} />,
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
        cell: ({ row }) => {
          const score = row.original.matchScore;
          const label =
            score == null || Number.isNaN(score) ? "-" : `${Math.round(score)}%`;
          return (
            <ApplicationTableShimmerText shimmer={isApplicationJdParsing(row.original)} className={cn(tableTextSecondary, "tabular-nums")}>
              {label}
            </ApplicationTableShimmerText>
          );
        },
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
        cell: ({ row }) => {
          const { date, time } = formatDateTime(row.original.updatedAt ?? row.original.createdAt);
          const line = date === "-" ? "-" : time ? `${date} · ${time}` : date;
          return (
            <ApplicationTableShimmerText shimmer={isApplicationJdParsing(row.original)} className={tableTextSecondary}>
              {line}
            </ApplicationTableShimmerText>
          );
        },
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: () => null,
      },
    ],
    [params.sort, params.order, toggleSort]
  );

  const table = useReactTable({
    data: items,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
    enableRowSelection: true,
    onRowSelectionChange,
    state: { rowSelection },
  });

  if (isLoading && items.length === 0) {
    return (
      <Table className="text-base">
        <TableHeader className="sticky top-0 z-10 bg-background">
          <TableRow>
            <TableHead className={cn("w-12 pl-0 pr-0", tableCellPaddingX)} />
            <TableHead className={cn("w-10 px-2", tableCellPaddingX)}>
              <span className="sr-only">Source</span>
            </TableHead>
            <TableHead className={cn(tableTextSecondary, tableCellPaddingX)}>Role</TableHead>
            <TableHead className={cn(tableTextSecondary, tableCellPaddingX)}>Company</TableHead>
            <TableHead className={cn(tableTextSecondary, tableCellPaddingX)}>Status</TableHead>
            <TableHead className={cn("hidden sm:table-cell", tableTextSecondary, tableCellPaddingX)}>
              Match
            </TableHead>
            <TableHead className={cn("hidden md:table-cell", tableTextSecondary, tableCellPaddingX)}>
              Updated
            </TableHead>
            <TableHead className={cn("w-10", tableCellPaddingX)} />
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
      <Table className="text-base">
        <TableHeader className="sticky top-0 z-10 bg-background">
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id}>
              {hg.headers.map((h) => (
                <TableHead
                  key={h.id}
                  className={cn(
                    tableTextSecondary,
                    tableCellPaddingX,
                    h.id === "select" && "w-12 pl-0 pr-0",
                    h.id === "source" && "w-10 px-2",
                    h.id === "match" && "hidden sm:table-cell",
                    h.id === "updated" && "hidden md:table-cell"
                  )}
                >
                  {h.id === "select" ? null : h.isPlaceholder ? null : (
                    flexRender(h.column.columnDef.header, h.getContext())
                  )}
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
              isSelected={row.getIsSelected()}
              selectedId={selectedId}
              actionId={actionId}
              onSelectRow={onSelectRow}
              onRetry={onRetry}
              onContinue={onContinue}
              onSend={onSend}
              onSendNow={onSendNow}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
