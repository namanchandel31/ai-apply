import type { AiProviderId } from "@/components/ai/AiProviderLogo";

export type AiProviderApiKeyLink = {
  url: string;
  linkLabel: string;
  providerName: string;
};

export const AI_PROVIDER_API_KEY_LINKS: Record<AiProviderId, AiProviderApiKeyLink> = {
  openai: {
    url: "https://platform.openai.com/api-keys",
    linkLabel: "OpenAI API keys",
    providerName: "OpenAI",
  },
  anthropic: {
    url: "https://console.anthropic.com/settings/keys",
    linkLabel: "Anthropic Console",
    providerName: "Anthropic",
  },
  gemini: {
    url: "https://aistudio.google.com/app/api-keys",
    linkLabel: "Google AI Studio",
    providerName: "Gemini",
  },
  openrouter: {
    url: "https://openrouter.ai/keys",
    linkLabel: "OpenRouter",
    providerName: "OpenRouter",
  },
  grok: {
    url: "https://console.x.ai/team/default/api-keys",
    linkLabel: "xAI Console",
    providerName: "Grok",
  },
  groq: {
    url: "https://console.groq.com/keys",
    linkLabel: "GroqCloud",
    providerName: "Groq",
  },
  nvidia: {
    url: "https://build.nvidia.com/settings/api-key",
    linkLabel: "NVIDIA Build",
    providerName: "NVIDIA NIM",
  },
};

export function getAiProviderApiKeyLink(provider: string): AiProviderApiKeyLink | null {
  if (provider in AI_PROVIDER_API_KEY_LINKS) {
    return AI_PROVIDER_API_KEY_LINKS[provider as AiProviderId];
  }
  return null;
}
