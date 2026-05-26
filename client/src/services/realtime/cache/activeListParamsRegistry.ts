import type { ApplicationsListParams } from "@/lib/api";
import { defaultApplicationsListParams } from "@/lib/normalizeApplicationsListParams";

let activeParams: ApplicationsListParams = defaultApplicationsListParams();

export function registerActiveListParams(params: ApplicationsListParams): void {
  activeParams = params;
}

export function getActiveListParams(): ApplicationsListParams {
  return activeParams;
}
