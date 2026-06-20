import { api } from "@/lib/api";

export type PostAuthPath = "/pricing" | "/onboarding" | "/dashboard";

export async function resolvePostAuthPath(): Promise<PostAuthPath> {
  try {
    const res = await api.getSetupStatus();
    if (!res.data.hasActiveSubscription) {
      return "/pricing";
    }
    return res.data.onboardingRequired ? "/onboarding" : "/dashboard";
  } catch {
    return "/pricing";
  }
}
