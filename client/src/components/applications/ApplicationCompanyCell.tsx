import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { ApplicationRecord } from "@/lib/api";
import { isApplicationJdParsing } from "@/lib/applicationRowState";
import { api } from "@/lib/api";
import {
  displayCompany,
  patchApplicationAfterMutation,
  refreshApplicationsList,
} from "@/queries/applicationsCache";
import { ApplicationTableShimmerText } from "@/components/applications/ApplicationTableStatusCell";
import { tableTextSecondary } from "@/components/applications/applicationsTableTypography";
import { cn } from "@/lib/utils";

type Props = {
  app: ApplicationRecord;
};

const cellShellClass =
  "flex h-7 w-full min-w-[8rem] max-w-[220px] items-center rounded-sm border px-1.5";

const cellFieldClass = cn(
  tableTextSecondary,
  "h-full w-full min-w-0 bg-transparent text-base font-normal leading-none outline-none"
);

export function ApplicationCompanyCell({ app }: Props) {
  const queryClient = useQueryClient();
  const initialValue = useMemo(() => {
    if (app.company && app.company.trim()) return app.company.trim();
    return "";
  }, [app.company]);
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    if (!isEditing) setValue(initialValue);
  }, [initialValue, isEditing]);

  const mutation = useMutation({
    mutationFn: (companyName: string) => api.patchApplicationCompany(app.id, { companyName }),
    onSuccess: async (res) => {
      patchApplicationAfterMutation(queryClient, app.id, {
        company: res.data.company ?? null,
        normalizedCompanyName: res.data.normalizedCompanyName ?? null,
        updatedAt: res.data.updatedAt ?? app.updatedAt,
      });
      await refreshApplicationsList(queryClient);
      setIsEditing(false);
      setValue((res.data.company ?? "").trim());
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to update company");
    },
  });

  const commit = () => {
    if (mutation.isPending) return;
    const next = value.trim();
    if (!next) {
      toast.error("Company name cannot be empty");
      setValue(initialValue);
      setIsEditing(false);
      return;
    }
    if (next === initialValue) {
      setIsEditing(false);
      return;
    }
    mutation.mutate(next);
  };

  const cancel = () => {
    if (mutation.isPending) return;
    setValue(initialValue);
    setIsEditing(false);
  };

  return (
    <div
      className={cn(
        cellShellClass,
        isEditing ? "border-input-border bg-input" : "border-transparent"
      )}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {isEditing ? (
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          className={cn(cellFieldClass, "truncate focus-visible:ring-0")}
          autoFocus
          disabled={mutation.isPending}
          aria-label="Edit company name"
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") {
              e.preventDefault();
              e.currentTarget.blur();
            }
            if (e.key === "Escape") {
              e.preventDefault();
              cancel();
            }
          }}
        />
      ) : (
        <button
          type="button"
          className={cn(cellFieldClass, "truncate text-left hover:text-foreground")}
          onClick={() => setIsEditing(true)}
          disabled={mutation.isPending}
          aria-label={`Edit company: ${displayCompany(app)}`}
          title="Click to edit company"
        >
          <ApplicationTableShimmerText shimmer={isApplicationJdParsing(app)} className={tableTextSecondary}>
            {displayCompany(app)}
          </ApplicationTableShimmerText>
        </button>
      )}
    </div>
  );
}
