import type { QueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { isOnboardingFlowComplete } from "@/lib/onboardingFlow";
import { postAuthPathWithoutSubscription, shouldEnforceSubscriptionPaywall } from "@/lib/paywallRouting";
import { setupStatusQueryOptions } from "@/queries/bootstrapQueries";
import type { SetupStatusData } from "@/lib/api";

export type PostAuthPath = "/pricing" | "/onboarding" | "/dashboard";

async function loadSetupStatus(queryClient?: QueryClient): Promise<SetupStatusData> {
  const fetchStatus = () =>
    queryClient
      ? queryClient.fetchQuery(setupStatusQueryOptions)
      : api.getSetupStatus().then((res) => res.data);

  try {
    return await fetchStatus();
  } catch (first) {
    try {
      return await fetchStatus();
    } catch {
      throw first;
    }
  }
}

export async function resolvePostAuthPath(queryClient?: QueryClient): Promise<PostAuthPath> {
  try {
    const status = await loadSetupStatus(queryClient);
    if (!shouldEnforceSubscriptionPaywall(status) || status.hasActiveSubscription) {
      return isOnboardingFlowComplete(status) ? "/dashboard" : "/onboarding";
    }
    return postAuthPathWithoutSubscription(status);
  } catch {
    return "/onboarding";
  }
}
