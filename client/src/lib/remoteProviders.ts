export const REMOTE_PROVIDERS = [
  { id: "openai", label: "OpenAI" },
  { id: "openrouter", label: "OpenRouter" },
  { id: "anthropic", label: "Anthropic" },
  { id: "gemini", label: "Gemini" },
  { id: "grok", label: "Grok" },
  { id: "groq", label: "Groq" },
  { id: "nvidia", label: "NVIDIA NIM" },
] as const;

export type RemoteProviderId = (typeof REMOTE_PROVIDERS)[number]["id"];

const AVAILABLE_PROVIDER_IDS = new Set<RemoteProviderId>(["gemini", "groq"]);

/** Shown in the provider list but not selectable yet in onboarding. */
export function isProviderComingSoon(providerId: string): boolean {
  return !AVAILABLE_PROVIDER_IDS.has(providerId as RemoteProviderId);
}

export function isProviderAvailable(providerId: string): boolean {
  return AVAILABLE_PROVIDER_IDS.has(providerId as RemoteProviderId);
}
