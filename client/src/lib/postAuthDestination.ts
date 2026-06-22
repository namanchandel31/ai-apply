import type { QueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { isPricingEnabled } from "@/lib/featureFlags";
import { isOnboardingFlowComplete } from "@/lib/onboardingFlow";
import { postAuthPathWithoutSubscription } from "@/lib/paywallRouting";
import { setupStatusQueryOptions } from "@/queries/bootstrapQueries";

export type PostAuthPath = "/pricing" | "/onboarding" | "/dashboard";

export async function resolvePostAuthPath(queryClient?: QueryClient): Promise<PostAuthPath> {
  try {
    const status = queryClient
      ? await queryClient.fetchQuery(setupStatusQueryOptions)
      : (await api.getSetupStatus()).data;
    if (!status.hasActiveSubscription) {
      return postAuthPathWithoutSubscription(status);
    }
    return isOnboardingFlowComplete(status) ? "/dashboard" : "/onboarding";
  } catch {
    return isPricingEnabled ? "/pricing" : "/onboarding";
  }
}
