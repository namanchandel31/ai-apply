import { api } from "@/lib/api";
import { isPricingEnabled } from "@/lib/featureFlags";

export type PostAuthPath = "/pricing" | "/onboarding" | "/dashboard";

export async function resolvePostAuthPath(): Promise<PostAuthPath> {
  try {
    const res = await api.getSetupStatus();
    // hasActiveSubscription is server-derived and already folds in the paywall
    // state (ENV kill-switch + DB setting + live access period).
    if (!res.data.hasActiveSubscription) {
      return "/pricing";
    }
    return res.data.onboardingRequired ? "/onboarding" : "/dashboard";
  } catch {
    return isPricingEnabled ? "/pricing" : "/onboarding";
  }
}
