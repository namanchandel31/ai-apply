import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, AlertTriangle, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  api,
  type CertifiedModelOption,
  type PlatformAiCredential,
  type PlatformAiGlobalConfig,
} from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AiProviderCredentialFields } from "@/components/ai/AiProviderCredentialFields";
import { REMOTE_PROVIDERS } from "@/lib/remoteProviders";

const PROVIDERS = ["gemini", "openai", "anthropic", "groq"] as const;

const ADMIN_PROVIDERS = PROVIDERS.map((id) => ({
  id,
  label: REMOTE_PROVIDERS.find((p) => p.id === id)?.label ?? id,
}));

function hasActiveKeysForProvider(credentials: PlatformAiCredential[], provider: string) {
  return credentials.some(
    (c) => c.provider === provider && c.is_active && (Number(c.traffic_weight) || 0) > 0
  );
}

function deriveDraftFromServer(
  config: PlatformAiGlobalConfig | null,
  credentials: PlatformAiCredential[]
): { provider: string; modelId: string } {
  const savedProvider = config?.model_provider ?? "";
  if (savedProvider && hasActiveKeysForProvider(credentials, savedProvider)) {
    return { provider: savedProvider, modelId: config?.certified_model_id ?? "" };
  }

  const fallbackCred = credentials.find(
    (c) => c.is_active && (Number(c.traffic_weight) || 0) > 0
  );
  if (fallbackCred) {
    return { provider: fallbackCred.provider, modelId: "" };
  }

  return {
    provider: savedProvider || PROVIDERS[0],
    modelId: config?.certified_model_id ?? "",
  };
}

export function OneTapAiConfigPanel() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [config, setConfig] = useState<PlatformAiGlobalConfig | null>(null);
  const [credentials, setCredentials] = useState<PlatformAiCredential[]>([]);
  const [providerModels, setProviderModels] = useState<CertifiedModelOption[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [warnings, setWarnings] = useState<
    Array<{ displayName: string; certificationStatus: string }>
  >([]);

  const [provider, setProvider] = useState("");
  const [certifiedModelId, setCertifiedModelId] = useState("");
  const [credDraft, setCredDraft] = useState({ label: "", apiKey: "", trafficWeight: "100" });
  const [weightDrafts, setWeightDrafts] = useState<Record<string, string>>({});
  const draftSyncedRef = useRef(false);

  const providerCredentials = useMemo(
    () => credentials.filter((c) => c.provider === provider),
    [credentials, provider]
  );

  const otherProviderCredentials = useMemo(
    () => credentials.filter((c) => c.provider !== provider),
    [credentials, provider]
  );

  const savedProviderKeys = useMemo(
    () =>
      config?.model_provider
        ? credentials.filter((c) => c.provider === config.model_provider)
        : [],
    [credentials, config?.model_provider]
  );

  const savedStateBroken = useMemo(() => {
    if (!config?.model_provider) return false;
    return !hasActiveKeysForProvider(credentials, config.model_provider);
  }, [config?.model_provider, credentials]);

  const activeProviderKeys = useMemo(
    () =>
      providerCredentials.filter(
        (c) => c.is_active && (Number(c.traffic_weight) || 0) > 0
      ),
    [providerCredentials]
  );

  const totalTrafficWeight = providerCredentials.reduce(
    (sum, c) => sum + (c.is_active ? Number(c.traffic_weight) || 0 : 0),
    0
  );

  const savedModelLabel = useMemo(() => {
    if (!config?.certified_model_id) return null;
    if (config.model_display_name && config.model_provider) {
      return `${config.model_display_name} (${config.model_provider})`;
    }
    return config.certified_model_id;
  }, [config]);

  const selectedModel = useMemo(
    () => providerModels.find((m) => m.id === certifiedModelId) ?? null,
    [providerModels, certifiedModelId]
  );

  const configIsDirty = useMemo(() => {
    if (!certifiedModelId) return false;
    return (
      config?.certified_model_id !== certifiedModelId ||
      config?.model_provider !== provider
    );
  }, [config, certifiedModelId, provider]);

  const canSaveConfig =
    !!certifiedModelId &&
    !!selectedModel &&
    activeProviderKeys.length > 0 &&
    (configIsDirty || savedStateBroken);

  const syncDraftFromServer = useCallback(
    (cfg: PlatformAiGlobalConfig | null, creds: PlatformAiCredential[]) => {
      const draft = deriveDraftFromServer(cfg, creds);
      setProvider(draft.provider);
      setCertifiedModelId(draft.modelId);
    },
    []
  );

  const refreshData = useCallback(
    async (options?: { syncDraft?: boolean }) => {
      const showSpinner = !draftSyncedRef.current;
      if (showSpinner) setLoading(true);
      try {
        const res = await api.getAdminPlatformAi();
        const data = res.data;
        const cfg = data.config ?? null;
        const creds = data.credentials ?? [];

        setConfig(cfg);
        setCredentials(creds);
        setWarnings(
          (data.deprecationWarnings ?? []).map((w) => ({
            displayName: w.displayName,
            certificationStatus: w.certificationStatus,
          }))
        );

        const weights: Record<string, string> = {};
        for (const c of creds) {
          weights[c.id] = String(c.traffic_weight ?? 100);
        }
        setWeightDrafts(weights);

        if (!draftSyncedRef.current || options?.syncDraft) {
          syncDraftFromServer(cfg, creds);
          draftSyncedRef.current = true;
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load OneTap AI config");
      } finally {
        if (showSpinner) setLoading(false);
      }
    },
    [syncDraftFromServer]
  );

  useEffect(() => {
    void refreshData({ syncDraft: true });
  }, [refreshData]);

  const handleModelsLoaded = useCallback(
    (models: Array<{ id?: string; modelId: string; displayName: string }>) => {
      const mapped = models.map((m) => ({
        id: m.id ?? m.modelId,
        provider,
        modelId: m.modelId,
        displayName: m.displayName,
      }));
      setProviderModels(mapped);
      setCertifiedModelId((prev) => {
        if (prev && mapped.some((m) => m.id === prev)) return prev;
        if (hasActiveKeysForProvider(credentials, provider)) {
          return mapped[0]?.id ?? "";
        }
        return prev || mapped[0]?.id || "";
      });
    },
    [credentials, provider]
  );

  const handleProviderChange = (nextProvider: string) => {
    setProvider(nextProvider);
    if (config?.model_provider === nextProvider && config.certified_model_id) {
      setCertifiedModelId(config.certified_model_id);
    } else {
      setCertifiedModelId("");
    }
    setCredDraft({ label: "", apiKey: "", trafficWeight: "100" });
  };

  const saveConfig = async () => {
    if (!certifiedModelId) {
      toast.error("Select a certified model");
      return;
    }
    if (!selectedModel) {
      toast.error("Model must belong to the selected provider");
      return;
    }
    if (activeProviderKeys.length === 0) {
      toast.error(`Add at least one active API key for ${provider} before saving`);
      return;
    }
    setSaving("config");
    try {
      await api.upsertPlatformAiConfig({ certifiedModelId, isEnabled: true });
      toast.success("OneTap AI configuration saved");
      await refreshData({ syncDraft: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(null);
    }
  };

  const addCredential = async () => {
    if (!provider) {
      toast.error("Select a provider first");
      return;
    }
    if (!credDraft.apiKey.trim()) {
      toast.error("API key is required");
      return;
    }
    setSaving("credential");
    try {
      const res = await api.createPlatformAiCredential({
        provider,
        label: credDraft.label || undefined,
        apiKey: credDraft.apiKey,
        trafficWeight: Number(credDraft.trafficWeight) || 100,
      });
      const created = res.data?.credential;
      if (created) {
        setCredentials((prev) => [...prev, created]);
        setWeightDrafts((d) => ({ ...d, [created.id]: String(created.traffic_weight ?? 100) }));
      }
      toast.success(`API key added for ${provider}`);
      setCredDraft({ label: "", apiKey: "", trafficWeight: "100" });
      await refreshData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add API key");
    } finally {
      setSaving(null);
    }
  };

  const saveCredentialWeight = async (cred: PlatformAiCredential) => {
    const weight = Number(weightDrafts[cred.id]);
    if (!Number.isFinite(weight) || weight < 0) {
      toast.error("Traffic weight must be 0 or greater");
      return;
    }
    setSaving(cred.id);
    try {
      await api.updatePlatformAiCredential(cred.id, { trafficWeight: weight });
      toast.success("Traffic weight updated");
      await refreshData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSaving(null);
    }
  };

  const toggleCredential = async (cred: PlatformAiCredential) => {
    setSaving(cred.id);
    try {
      await api.updatePlatformAiCredential(cred.id, { isActive: !cred.is_active });
      await refreshData({ syncDraft: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSaving(null);
    }
  };

  const deleteCredential = async (cred: PlatformAiCredential) => {
    const label = cred.label || "this API key";
    if (!window.confirm(`Delete ${label} (${cred.provider})? This cannot be undone.`)) {
      return;
    }
    setSaving(`delete-${cred.id}`);
    try {
      const res = await api.deletePlatformAiCredential(cred.id);
      setCredentials((prev) => prev.filter((c) => c.id !== cred.id));
      if (res.data?.autoFailover) {
        toast.success("API key deleted - switched to another provider with available keys");
      } else {
        toast.success("API key deleted");
      }
      await refreshData({ syncDraft: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setSaving(null);
    }
  };

  const renderCredentialRow = (cred: PlatformAiCredential, trafficTotal: number) => {
    const weight = Number(cred.traffic_weight) || 0;
    const share =
      cred.is_active && trafficTotal > 0 ? Math.round((weight / trafficTotal) * 100) : 0;
    return (
      <div
        key={cred.id}
        className="flex flex-wrap items-center gap-3 rounded-md border p-3 text-sm"
      >
        <div className="min-w-[140px] flex-1">
          <p className="font-medium">{cred.label || "Unlabeled key"}</p>
          <p className="text-xs text-muted-foreground">{cred.provider}</p>
        </div>
        <Badge variant={cred.is_active ? "default" : "secondary"}>
          {cred.is_active ? "Active" : "Inactive"}
        </Badge>
        {cred.is_active && trafficTotal > 0 && (
          <span className="text-muted-foreground tabular-nums">~{share}% traffic</span>
        )}
        <div className="flex items-center gap-2">
          <Label className="sr-only">Weight</Label>
          <Input
            className="h-8 w-20"
            type="number"
            min={0}
            value={weightDrafts[cred.id] ?? String(cred.traffic_weight)}
            onChange={(e) => setWeightDrafts((d) => ({ ...d, [cred.id]: e.target.value }))}
          />
          <Button
            size="sm"
            variant="outline"
            disabled={saving === cred.id}
            onClick={() => void saveCredentialWeight(cred)}
          >
            Save
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={saving === cred.id}
            onClick={() => void toggleCredential(cred)}
          >
            {cred.is_active ? "Disable" : "Enable"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            disabled={saving === `delete-${cred.id}`}
            onClick={() => void deleteCredential(cred)}
          >
            {saving === `delete-${cred.id}` ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading OneTap AI…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {savedStateBroken && (
        <Card className="border-amber-500/50">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base text-amber-600 dark:text-amber-500">
              <AlertTriangle className="h-4 w-4" />
              Saved provider has no active API keys
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            The active model is <strong>{savedModelLabel}</strong> but there are no usable keys for{" "}
            {config?.model_provider}. Pick a provider with keys below and save, or add keys for the
            saved provider.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Current OneTap setup</CardTitle>
          <CardDescription>Active configuration used for managed users.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground">Provider + model:</span>
            {savedModelLabel ? (
              <>
                <span className="font-medium">{savedModelLabel}</span>
                <Badge variant={config?.is_enabled && !savedStateBroken ? "default" : "secondary"}>
                  {config?.is_enabled && !savedStateBroken ? "Enabled" : "Needs attention"}
                </Badge>
              </>
            ) : (
              <span className="text-muted-foreground">Not configured yet.</span>
            )}
          </div>
          <div>
            <span className="text-muted-foreground">API keys for this provider</span>
            {savedProviderKeys.length === 0 ? (
              <p className="mt-1 text-muted-foreground">No keys for the saved provider.</p>
            ) : (
              <ul className="mt-2 space-y-1">
                {savedProviderKeys.map((cred) => {
                  const weight = Number(cred.traffic_weight) || 0;
                  const providerActiveWeight = savedProviderKeys
                    .filter((c) => c.is_active)
                    .reduce((sum, c) => sum + (Number(c.traffic_weight) || 0), 0);
                  const share =
                    cred.is_active && providerActiveWeight > 0
                      ? Math.round((weight / providerActiveWeight) * 100)
                      : 0;
                  return (
                    <li key={cred.id} className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{cred.label || "Unlabeled key"}</span>
                      <Badge variant={cred.is_active ? "default" : "secondary"}>
                        {cred.is_active ? "Active" : "Inactive"}
                      </Badge>
                      {cred.is_active && providerActiveWeight > 0 && (
                        <span className="text-muted-foreground tabular-nums">~{share}% traffic</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>

      {warnings.length > 0 && (
        <Card className="border-destructive/50">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base text-destructive">
              <AlertTriangle className="h-4 w-4" />
              Active model needs attention
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {warnings.map((w) => (
              <p key={w.displayName}>
                <strong>{w.displayName}</strong> ({w.certificationStatus})
              </p>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Configure OneTap AI</CardTitle>
          <CardDescription>
            Provider, model, and API keys are saved together. Add at least one active key for the
            provider before saving.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <AiProviderCredentialFields
            provider={provider}
            onProviderChange={handleProviderChange}
            modelValue={certifiedModelId}
            onModelChange={setCertifiedModelId}
            modelValueKey="id"
            providers={ADMIN_PROVIDERS}
            showApiKey={false}
            modelsLoading={modelsLoading}
            onModelsLoadingChange={setModelsLoading}
            onModelsLoaded={handleModelsLoaded}
          />

          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium">API keys for {provider}</p>
              <p className="text-sm text-muted-foreground">
                Traffic is split by weight across active keys
                {totalTrafficWeight > 0 ? ` (total weight: ${totalTrafficWeight})` : ""}.
              </p>
            </div>

            {providerCredentials.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No API keys for {provider} yet. Add at least one key below before saving.
              </p>
            ) : (
              <div className="space-y-3">
                {providerCredentials.map((cred) => renderCredentialRow(cred, totalTrafficWeight))}
              </div>
            )}

            <div className="grid gap-4 rounded-md border border-dashed p-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Label</Label>
                <Input
                  value={credDraft.label}
                  onChange={(e) => setCredDraft((d) => ({ ...d, label: e.target.value }))}
                  placeholder="Production key A"
                />
              </div>
              <div className="space-y-2">
                <Label>Traffic weight</Label>
                <Input
                  type="number"
                  min={0}
                  value={credDraft.trafficWeight}
                  onChange={(e) => setCredDraft((d) => ({ ...d, trafficWeight: e.target.value }))}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>API key</Label>
                <Input
                  type="password"
                  value={credDraft.apiKey}
                  onChange={(e) => setCredDraft((d) => ({ ...d, apiKey: e.target.value }))}
                  placeholder={`Paste ${provider} API key`}
                />
              </div>
              <Button
                className="w-fit"
                variant="outline"
                onClick={() => void addCredential()}
                disabled={saving === "credential" || !provider}
              >
                {saving === "credential" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Add key for {provider}
                  </>
                )}
              </Button>
            </div>
          </div>

          {!canSaveConfig && certifiedModelId && activeProviderKeys.length === 0 && (
            <p className="text-sm text-amber-600 dark:text-amber-500">
              Add at least one active API key for {provider} before saving this configuration.
            </p>
          )}

          <Button
            className="w-fit"
            onClick={() => void saveConfig()}
            disabled={saving === "config" || !canSaveConfig}
          >
            {saving === "config" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Save configuration"
            )}
          </Button>
        </CardContent>
      </Card>

      {otherProviderCredentials.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Keys for other providers</CardTitle>
            <CardDescription>
              Stored keys not tied to the provider you are editing above. Delete unused keys here.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {otherProviderCredentials.map((cred) => {
              const providerTotal = credentials
                .filter((c) => c.provider === cred.provider && c.is_active)
                .reduce((sum, c) => sum + (Number(c.traffic_weight) || 0), 0);
              return renderCredentialRow(cred, providerTotal);
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
