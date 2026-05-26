import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { ApplicationsListParams } from "@/lib/api";
import { useApplicationsListState } from "@/hooks/useApplicationsListState";

type ApplicationsListParamsContextValue = {
  params: ApplicationsListParams;
  patchParams: ReturnType<typeof useApplicationsListState>["patchParams"];
  setParams: ReturnType<typeof useApplicationsListState>["setParams"];
  clearFilters: ReturnType<typeof useApplicationsListState>["clearFilters"];
  hasActiveFilters: boolean;
};

const ApplicationsListParamsContext = createContext<ApplicationsListParamsContextValue | null>(
  null
);

export function ApplicationsListParamsProvider({ children }: { children: ReactNode }) {
  const state = useApplicationsListState();
  const value = useMemo(() => state, [state]);
  return (
    <ApplicationsListParamsContext.Provider value={value}>
      {children}
    </ApplicationsListParamsContext.Provider>
  );
}

export function useApplicationsListParams() {
  const ctx = useContext(ApplicationsListParamsContext);
  if (!ctx) {
    throw new Error("useApplicationsListParams must be used within ApplicationsListParamsProvider");
  }
  return ctx;
}
