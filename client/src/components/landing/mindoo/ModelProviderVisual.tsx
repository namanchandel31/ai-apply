import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { AiProviderLogo } from "@/components/ai/AiProviderLogo";
import { REMOTE_PROVIDERS, type RemoteProviderId } from "@/lib/remoteProviders";

export function ModelProviderVisual() {
  const [selectedProvider, setSelectedProvider] =
    useState<RemoteProviderId>("gemini");

  const selectedProviderLabel =
    REMOTE_PROVIDERS.find((p) => p.id === selectedProvider)?.label ?? "Gemini";

  return (
    <div className="m-byok-provider">
      <p className="m-byok-provider-label" id="m-byok-provider-label">
        Choose your model provider
      </p>
      <div className="m-byok-provider-trigger" aria-hidden>
        <span className="m-byok-provider-trigger-inner">
          <AiProviderLogo provider={selectedProvider} className="h-5 w-5" />
          <span>{selectedProviderLabel}</span>
        </span>
        <ChevronDown className="m-byok-provider-chevron" aria-hidden />
      </div>

      <ul
        className="m-byok-provider-menu"
        role="listbox"
        aria-labelledby="m-byok-provider-label"
      >
        {REMOTE_PROVIDERS.map((provider) => {
          const isSelected = provider.id === selectedProvider;

          return (
            <li key={provider.id} className="m-byok-provider-item-wrap">
              <button
                type="button"
                role="option"
                aria-selected={isSelected}
                className={`m-byok-provider-item${isSelected ? " is-selected" : ""}`}
                onClick={() => setSelectedProvider(provider.id)}
              >
                <AiProviderLogo provider={provider.id} className="h-5 w-5" />
                <span className="m-byok-provider-name">{provider.label}</span>
                <span className="m-byok-provider-check" aria-hidden>
                  {isSelected ? <Check /> : null}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
