import { api } from "@/lib/api";

export type PostAuthPath = "/onboarding" | "/dashboard";

export async function resolvePostAuthPath(): Promise<PostAuthPath> {
  try {
    const res = await api.getSetupStatus();
    return res.data.onboardingRequired ? "/onboarding" : "/dashboard";
  } catch {
    return "/onboarding";
  }
}
