import { useEffect, useState } from "react";
import {
  Loader2,
  Sparkles,
  CheckCircle2,
  ChevronDown,
  KeyRound,
  Server,
  ArrowUp,
  ArrowDown,
  Pause,
  Play,
  Trash2,
  Plus,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { api, type AiCredentialSummary } from "@/lib/api";
import { useAiCredentials } from "@/hooks/useAiCredentials";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const SECTION_LABEL = "text-base font-medium";
const SETUP_BOX_RADIUS = "rounded-sm";

const REMOTE_PROVIDERS = [
  { id: "openai", label: "OpenAI" },
  { id: "openrouter", label: "OpenRouter" },
  { id: "anthropic", label: "Anthropic" },
  { id: "gemini", label: "Gemini" },
  { id: "grok", label: "Grok" },
  { id: "groq", label: "Groq" },
  { id: "nvidia", label: "NVIDIA NIM" },
];

function healthBadge(status?: string) {
  switch (status) {
    case "invalid":
      return (
        <Badge variant="destructive" className="font-normal text-xs">
          Invalid key
        </Badge>
      );
    case "rate_limited":
      return (
        <Badge variant="secondary" className="font-normal text-xs">
          Rate limited
        </Badge>
      );
    case "quota_exceeded":
      return (
        <Badge variant="secondary" className="font-normal text-xs">
          Quota exceeded
        </Badge>
      );
    default:
      return (
        <Badge variant="success" className="font-normal text-xs">
          Healthy
        </Badge>
      );
  }
}

function BillingHelpSection() {
  return (
    <details className={cn("border border-border bg-muted/30 px-3 py-2 text-base", SETUP_BOX_RADIUS)}>
      <summary className="cursor-pointer font-medium text-foreground list-none flex items-center gap-1 [&::-webkit-details-marker]:hidden">
        <ChevronDown className="h-4 w-4 shrink-0" />
        How billing works
      </summary>
      <ul className="mt-3 space-y-2 text-muted-foreground list-disc pl-5">
        <li>
          <strong className="text-foreground">Primary key:</strong> Used first. You are billed by that provider.
        </li>
        <li>
          <strong className="text-foreground">Backup keys:</strong> Used only if primary fails (retryable errors).
          Each backup bills through its own provider account.
        </li>
        <li>
          <strong className="text-foreground">Paused keys:</strong> Kept in Setup but excluded from the fallback chain.
        </li>
        <li>
          <strong className="text-foreground">Platform fallback:</strong> Server credits only if enabled on primary,
          after your chain is exhausted.
        </li>
      </ul>
    </details>
  );
}

interface Props {
  activeAiProvider?: AiCredentialSummary | null;
  hasAiSetup?: boolean;
  onUpdate: () => void;
}

export function AiProviderStatusCard({ activeAiProvider, hasAiSetup, onUpdate }: Props) {
  const queryClient = useQueryClient();
  const { data: credentials = [], isLoading: listLoading, refetch } = useAiCredentials();

  const [showForm, setShowForm] = useState(!hasAiSetup);
  const [formRole, setFormRole] = useState<"primary" | "backup">("backup");
  const [provider, setProvider] = useState("openai");
  const [selectedModel, setSelectedModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [allowPlatformFallback, setAllowPlatformFallback] = useState(false);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [curatedModels, setCuratedModels] = useState<
    Array<{ modelId: string; displayName: string }>
  >([]);

  useEffect(() => {
    let cancelled = false;
    setSelectedModel("");
    api
      .getCuratedAiModels(provider)
      .then((res) => {
        if (!cancelled) setCuratedModels(res.data?.models ?? []);
      })
      .catch(() => {
        if (!cancelled) setCuratedModels([]);
      });
    return () => {
      cancelled = true;
    };
  }, [provider]);

  const sorted = [...credentials].sort((a, b) => a.priority - b.priority);
  const usesOwnKey = sorted.length > 0;
  const usesPlatformOnly = !usesOwnKey && !!hasAiSetup;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["ai-credentials"] });
    queryClient.invalidateQueries({ queryKey: ["setup-status"] });
    onUpdate();
  };

  const handleTest = async () => {
    if (!selectedModel) {
      toast.error("Select a certified model from the dropdown");
      return;
    }
    setTesting(true);
    try {
      const res = await api.testAiCredential({
        provider,
        apiKey,
        selectedModel,
        providerType: "remote",
      });
      if (res.data?.ok) toast.success("Connection successful");
      else toast.error(res.data?.error || "Connection failed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Connection test failed");
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedModel) {
      toast.error("Select a certified model from the dropdown");
      return;
    }
    setLoading(true);
    try {
      await api.saveAiCredential({
        provider,
        apiKey,
        selectedModel,
        allowPlatformFallback: formRole === "primary" ? allowPlatformFallback : false,
        providerType: "remote",
        role: formRole,
      });
      toast.success(formRole === "primary" ? "Primary provider saved" : "Backup provider added");
      setApiKey("");
      setShowForm(false);
      invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setLoading(false);
    }
  };

  const handleMove = async (index: number, direction: "up" | "down") => {
    const swap = direction === "up" ? index - 1 : index + 1;
    if (swap < 0 || swap >= sorted.length) return;
    const orderedIds = sorted.map((c) => c.id);
    [orderedIds[index], orderedIds[swap]] = [orderedIds[swap], orderedIds[index]];
    try {
      await api.reorderAiCredentialChain(orderedIds);
      invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reorder");
    }
  };

  const handleTogglePause = async (cred: AiCredentialSummary) => {
    try {
      await api.patchAiCredential(cred.id, { inFallbackChain: cred.inFallbackChain === false });
      invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    }
  };

  const handleSetPrimary = async (id: string) => {
    try {
      await api.activateAiCredential(id);
      toast.success("Primary provider updated");
      invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to set primary");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteAiCredential(id);
      toast.success("Credential removed");
      invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  const handleRetest = async (id: string) => {
    try {
      const res = await api.healthCheckAiCredential(id);
      if (res.data?.ok) {
        toast.success("Connection OK");
        invalidate();
      } else toast.error(res.data?.error || "Health check failed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Health check failed");
    }
  };

  if (listLoading && !sorted.length) {
    return (
      <Card className={SETUP_BOX_RADIUS}>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!showForm && (usesOwnKey || usesPlatformOnly)) {
    return (
      <Card className={SETUP_BOX_RADIUS}>
        <CardHeader className="flex flex-row items-start justify-between gap-4 pb-4">
          <div className="space-y-1 min-w-0 flex-1">
            <CardTitle className="flex items-center gap-2 flex-wrap text-base font-medium">
              <Sparkles className="h-5 w-5 shrink-0" />
              AI Providers
              {usesOwnKey ? (
                <Badge variant="outline" className="font-normal">
                  <KeyRound className="mr-1 h-3 w-3" />
                  Your keys
                </Badge>
              ) : (
                <Badge variant="secondary" className="font-normal">
                  <Server className="mr-1 h-3 w-3" />
                  Platform
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              {usesOwnKey
                ? `${sorted.length} credential(s) configured. Primary is tried first, then backups in order.`
                : "No personal AI key. Using server configuration when available."}
            </CardDescription>
          </div>
          <Badge variant="success" className="shrink-0">
            <CheckCircle2 className="mr-1 h-3 w-3" /> Ready
          </Badge>
        </CardHeader>
        <CardContent className="space-y-3">
          <BillingHelpSection />

          {usesOwnKey && (
            <ul className="space-y-3">
              {sorted.map((cred, index) => (
                <li
                  key={cred.id}
                  className={cn(
                    "flex flex-wrap items-center gap-2 border p-3 text-base",
                    SETUP_BOX_RADIUS,
                    cred.inFallbackChain === false && "opacity-60 bg-muted/10"
                  )}
                >
                  <div className="flex-1 min-w-[140px]">
                    <div className="font-medium flex items-center gap-2 flex-wrap">
                      {cred.priority === 0 ? (
                        <Badge>Primary</Badge>
                      ) : (
                        <Badge variant="outline">Backup {cred.priority}</Badge>
                      )}
                      {cred.inFallbackChain === false && (
                        <Badge variant="secondary">Paused</Badge>
                      )}
                      {healthBadge(cred.healthStatus)}
                    </div>
                    <div className="text-muted-foreground mt-1">
                      {cred.provider}
                      {cred.selectedModel ? ` · ${cred.selectedModel}` : ""}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {cred.priority !== 0 && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => handleSetPrimary(cred.id)}>
                        Set primary
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={index === 0}
                      onClick={() => handleMove(index, "up")}
                      title="Move up"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={index === sorted.length - 1}
                      onClick={() => handleMove(index, "down")}
                      title="Move down"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleTogglePause(cred)}
                      title={cred.inFallbackChain === false ? "Resume in chain" : "Pause"}
                    >
                      {cred.inFallbackChain === false ? (
                        <Play className="h-4 w-4" />
                      ) : (
                        <Pause className="h-4 w-4" />
                      )}
                    </Button>
                    {(cred.healthStatus === "invalid" ||
                      cred.healthStatus === "rate_limited" ||
                      cred.healthStatus === "quota_exceeded") && (
                      <Button type="button" variant="ghost" size="icon" onClick={() => handleRetest(cred.id)}>
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(cred.id)}
                      title="Remove"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {activeAiProvider?.allowPlatformFallback !== undefined && sorted[0] && (
            <p className="text-base text-muted-foreground">
              Platform fallback on primary:{" "}
              <strong>{sorted[0].allowPlatformFallback ? "Enabled" : "Disabled"}</strong>
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => { setFormRole("backup"); setShowForm(true); }}>
              <Plus className="mr-1 h-4 w-4" />
              Add backup key
            </Button>
            <Button variant="outline" size="sm" onClick={() => { setFormRole("primary"); setShowForm(true); }}>
              Change primary
            </Button>
            <Button variant="ghost" size="sm" onClick={() => refetch()}>
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn(SETUP_BOX_RADIUS, !hasAiSetup && !usesOwnKey ? "ring-1 ring-warning/40" : "")}>
      <CardHeader className="gap-1">
        <CardTitle className="flex items-center gap-2 text-base font-medium">
          <Sparkles className="h-5 w-5" />
          {formRole === "primary" ? "Set primary AI provider" : "Add AI provider"}
        </CardTitle>
        <CardDescription>
          {formRole === "primary"
            ? "Your main API key. This provider is billed first for every AI request."
            : "Added to the end of your backup chain if primary fails."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <BillingHelpSection />
        {sorted.length > 0 && (
          <Button type="button" variant="ghost" size="sm" onClick={() => setShowForm(false)}>
            Back to list
          </Button>
        )}
        <form onSubmit={handleSave} className="space-y-3">
          <div className="flex gap-4 text-base">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={formRole === "primary"}
                onChange={() => setFormRole("primary")}
              />
              Set as primary
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={formRole === "backup"}
                onChange={() => setFormRole("backup")}
                disabled={!sorted.length && formRole !== "backup"}
              />
              Add as backup
            </label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ai-provider" className={SECTION_LABEL}>Provider</Label>
            <select
              id="ai-provider"
              className={cn(
                "flex h-10 w-full border border-input-border bg-input px-[14px] py-2.5 text-base",
                SETUP_BOX_RADIUS
              )}
              value={provider}
              onChange={(e) => {
                setProvider(e.target.value);
                setSelectedModel("");
              }}
            >
              {REMOTE_PROVIDERS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ai-model" className={SECTION_LABEL}>Model</Label>
            {curatedModels.length > 0 ? (
              <select
                id="ai-model"
                className={cn(
                  "flex h-10 w-full border border-input-border bg-input px-[14px] py-2.5 text-base",
                  SETUP_BOX_RADIUS
                )}
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                required
              >
                <option value="">Select certified model</option>
                {curatedModels.map((m) => (
                  <option key={m.modelId} value={m.modelId}>
                    {m.displayName}
                  </option>
                ))}
              </select>
            ) : (
              <p className={cn("border border-dashed border-border px-3 py-2 text-base text-muted-foreground", SETUP_BOX_RADIUS)}>
                No certified models for this provider yet. Certify and promote a model from the{" "}
                <span className="font-medium text-foreground">Admin console → AI models</span> first.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="ai-api-key" className={SECTION_LABEL}>API key</Label>
            <Input
              id="ai-api-key"
              type="password"
              placeholder="sk-..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className={SETUP_BOX_RADIUS}
              required
            />
          </div>

          {formRole === "primary" && (
            <div className={cn("border border-border p-3", SETUP_BOX_RADIUS)}>
              <label className="flex items-start gap-2 text-base">
                <input
                  type="checkbox"
                  checked={allowPlatformFallback}
                  onChange={(e) => setAllowPlatformFallback(e.target.checked)}
                  className="mt-1"
                />
                <span>
                  <span className="font-medium">Allow platform-managed fallback</span>
                  <span className="block text-muted-foreground mt-1">
                    After all your keys fail, use server credits if available.
                  </span>
                </span>
              </label>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleTest}
              disabled={testing || loading || !selectedModel || curatedModels.length === 0}
            >
              {testing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Test connection
            </Button>
            <Button
              type="submit"
              disabled={loading || !selectedModel || curatedModels.length === 0}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
