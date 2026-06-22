import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AiProviderOptionLabel } from "@/components/ai/AiProviderLogo";
import { getAiProviderApiKeyLink } from "@/lib/aiProviderApiKeyLinks";
import {
  isProviderComingSoon,
  REMOTE_PROVIDERS,
  type RemoteProviderId,
} from "@/lib/remoteProviders";

export type CuratedModelOption = {
  id?: string;
  modelId: string;
  displayName: string;
};

type Props = {
  provider: string;
  onProviderChange: (provider: string) => void;
  modelValue: string;
  onModelChange: (value: string) => void;
  apiKey?: string;
  onApiKeyChange?: (value: string) => void;
  /** Use certified catalog row id (admin) vs model_id string (BYOK setup). */
  modelValueKey?: "id" | "modelId";
  providers?: readonly { id: string; label: string }[];
  showApiKey?: boolean;
  apiKeyPlaceholder?: string;
  disabled?: boolean;
  modelsLoading?: boolean;
  onModelsLoadingChange?: (loading: boolean) => void;
  onModelsLoaded?: (models: CuratedModelOption[]) => void;
  className?: string;
};

const FIELD_CLASS = "flex flex-col gap-1";
const LABEL_CLASS = "block text-base font-medium leading-normal text-foreground";

export function AiProviderCredentialFields({
  provider,
  onProviderChange,
  modelValue,
  onModelChange,
  apiKey = "",
  onApiKeyChange,
  modelValueKey = "modelId",
  providers = REMOTE_PROVIDERS,
  showApiKey = true,
  apiKeyPlaceholder = "Paste your API key",
  disabled = false,
  modelsLoading: modelsLoadingProp,
  onModelsLoadingChange,
  onModelsLoaded,
  className,
}: Props) {
  const [models, setModels] = useState<CuratedModelOption[]>([]);
  const [modelsLoadingInternal, setModelsLoadingInternal] = useState(false);
  const modelsLoading = modelsLoadingProp ?? modelsLoadingInternal;

  useEffect(() => {
    if (!provider || isProviderComingSoon(provider)) {
      setModels([]);
      return;
    }
    let cancelled = false;
    setModelsLoadingInternal(true);
    onModelsLoadingChange?.(true);
    api
      .getCuratedAiModels(provider)
      .then((res) => {
        if (cancelled) return;
        setModels(
          (res.data?.models ?? []).map((m) => ({
            id: m.id,
            modelId: m.modelId,
            displayName: m.displayName,
          }))
        );
        if (!cancelled) {
          onModelsLoaded?.(
            (res.data?.models ?? []).map((m) => ({
              id: m.id,
              modelId: m.modelId,
              displayName: m.displayName,
            }))
          );
        }
      })
      .catch(() => {
        if (!cancelled) setModels([]);
      })
      .finally(() => {
        if (!cancelled) {
          setModelsLoadingInternal(false);
          onModelsLoadingChange?.(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [provider, onModelsLoadingChange, onModelsLoaded]);

  const apiKeyLink = getAiProviderApiKeyLink(provider as RemoteProviderId);
  const modelSelectDisabled = disabled || modelsLoading || models.length === 0;

  return (
    <div className={className}>
      <div className="grid gap-4 md:grid-cols-2">
        <div className={FIELD_CLASS}>
          <Label className={LABEL_CLASS}>Provider</Label>
          <Select
            value={provider || undefined}
            onValueChange={(value) => {
              onProviderChange(value);
              onModelChange("");
            }}
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select provider" />
            </SelectTrigger>
            <SelectContent>
              {[...providers]
                .sort(
                  (a, b) =>
                    Number(isProviderComingSoon(a.id)) - Number(isProviderComingSoon(b.id))
                )
                .map((p) => {
                  const comingSoon = isProviderComingSoon(p.id);
                  return (
                    <SelectItem
                      key={p.id}
                      value={p.id}
                      disabled={comingSoon}
                      suffix={
                        comingSoon ? (
                          <span className="text-xs text-muted-foreground">Coming soon</span>
                        ) : undefined
                      }
                    >
                      <AiProviderOptionLabel provider={p.id} label={p.label} />
                    </SelectItem>
                  );
                })}
            </SelectContent>
          </Select>
        </div>

        <div className={FIELD_CLASS}>
          <Label className={LABEL_CLASS}>Certified model</Label>
          <Select
            value={modelValue || undefined}
            onValueChange={onModelChange}
            disabled={modelSelectDisabled}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={
                  modelsLoading
                    ? "Loading models…"
                    : models.length === 0
                      ? "No certified models for this provider"
                      : "Select model"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {models.map((m) => {
                const value = modelValueKey === "id" ? m.id ?? m.modelId : m.modelId;
                return (
                  <SelectItem key={value} value={value}>
                    {m.displayName}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        {showApiKey ? (
          <div className={`${FIELD_CLASS} md:col-span-2`}>
            <Label htmlFor="ai-provider-api-key" className={LABEL_CLASS}>
              API key
            </Label>
            <Input
              id="ai-provider-api-key"
              type="password"
              value={apiKey}
              onChange={(e) => onApiKeyChange?.(e.target.value)}
              autoComplete="off"
              placeholder={apiKeyPlaceholder}
              disabled={disabled}
            />
            {apiKeyLink ? (
              <p className="text-sm text-muted-foreground">
                Get your {apiKeyLink.providerName} API key from{" "}
                <a
                  href={apiKeyLink.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 font-medium text-foreground underline-offset-4 hover:underline"
                >
                  {apiKeyLink.linkLabel}
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                </a>
                .
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
