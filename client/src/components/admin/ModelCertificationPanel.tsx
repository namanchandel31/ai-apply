import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  api,
  type CuratedAiModelRow,
  type ModelCertificationResult,
  type ModelCertificationRunSummary,
} from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CertificationResultDetail,
  historyRowToResult,
} from "@/components/certification/CertificationResultDetail";

const PROVIDERS = [
  { id: "gemini", label: "Gemini" },
  { id: "openai", label: "OpenAI" },
  { id: "grok", label: "Grok" },
  { id: "groq", label: "Groq" },
  { id: "anthropic", label: "Anthropic" },
  { id: "openrouter", label: "OpenRouter" },
  { id: "nvidia", label: "NVIDIA NIM" },
];

export function ModelCertificationPanel() {
  const [provider, setProvider] = useState("gemini");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [resumeSource, setResumeSource] = useState<"active" | "upload">("active");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState("");
  const [result, setResult] = useState<ModelCertificationResult | null>(null);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
  const [history, setHistory] = useState<ModelCertificationRunSummary[]>([]);
  const [curated, setCurated] = useState<CuratedAiModelRow[]>([]);
  const [removingCuratedId, setRemovingCuratedId] = useState<string | null>(null);

  const providerLabel = PROVIDERS.find((p) => p.id === provider)?.label ?? provider;
  const promotedForProvider = useMemo(
    () => curated.filter((m) => m.provider === provider),
    [curated, provider]
  );

  const loadMeta = useCallback(async () => {
    try {
      const [runsRes, curatedRes] = await Promise.all([
        api.listModelCertificationRuns(),
        api.listCuratedModelsAdmin(),
      ]);
      setHistory(runsRes.data?.runs ?? []);
      setCurated(curatedRes.data?.models ?? []);
    } catch {
      /* dev route may be disabled */
    }
  }, []);

  useEffect(() => {
    void loadMeta();
  }, [loadMeta]);

  const handleRun = async () => {
    if (!apiKey.trim()) {
      toast.error("API key is required");
      return;
    }
    if (!model.trim()) {
      toast.error("Model ID is required");
      return;
    }
    if (resumeSource === "upload" && !resumeFile) {
      toast.error("Upload a PDF resume for upload mode");
      return;
    }

    setRunning(true);
    setProgress("Run 1: parsing resume…");
    setResult(null);
    setSelectedHistoryId(null);

    const progressTimer = window.setTimeout(() => {
      setProgress("Run 1: generating email…");
    }, 8000);
    const progressTimer2 = window.setTimeout(() => {
      setProgress("Run 2: second certification attempt…");
    }, 45000);

    try {
      const res = await api.runModelCertification({
        provider,
        model: model.trim(),
        apiKey,
        resumeSource,
        resumeFile: resumeFile ?? undefined,
      });
      setResult(res.data);
      toast.success(`Certification complete. Overall ${res.data.overallScore}`);
      await loadMeta();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Certification failed");
    } finally {
      window.clearTimeout(progressTimer);
      window.clearTimeout(progressTimer2);
      setRunning(false);
      setProgress("");
    }
  };

  const handlePromote = async (runId: string, displayName?: string) => {
    const historyRow = history.find((h) => h.id === runId);
    const target =
      result?.runId === runId && result
        ? result
        : historyRow
          ? historyRowToResult(historyRow)
          : null;

    if (!target) {
      toast.error("Run not found");
      return;
    }

    if (!target.passed && !window.confirm("Overall score is below pass threshold. Promote anyway?")) {
      return;
    }
    try {
      await api.promoteCuratedModel(runId, displayName || target.model);
      toast.success("Model promoted to product dropdown");
      await loadMeta();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Promote failed");
    }
  };

  const handleHistorySelect = (row: ModelCertificationRunSummary) => {
    setSelectedHistoryId(row.id);
    setResult(historyRowToResult(row));
  };

  const handleRemoveCurated = async (entry: CuratedAiModelRow) => {
    if (
      !window.confirm(
        `Remove "${entry.display_name}" from the production dropdown? Users will no longer be able to select this model.`
      )
    ) {
      return;
    }
    setRemovingCuratedId(entry.id);
    try {
      await api.deactivateCuratedModel(entry.id);
      toast.success("Model removed from dropdown");
      await loadMeta();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove model");
    } finally {
      setRemovingCuratedId(null);
    }
  };

  const resultTitle =
    selectedHistoryId && result?.runId === selectedHistoryId ? "History result" : "Latest result";
  const resultSubtitle =
    selectedHistoryId && result
      ? `${result.provider} / ${result.model} · ${new Date(
          history.find((h) => h.id === selectedHistoryId)?.created_at ?? ""
        ).toLocaleString()}`
      : undefined;

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Dual-run certification: resume parse → email → judge. Passing models can be promoted into the
        product&apos;s AI model dropdowns.
      </p>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Certify a model</CardTitle>
          <CardDescription>Two full workflow runs with the same resume and credentials.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Provider</Label>
              <select
                className="flex h-10 w-full rounded-[10px] border border-input-border bg-input px-[14px] py-2.5 text-base"
                value={provider}
                onChange={(e) => {
                  setProvider(e.target.value);
                  setModel("");
                }}
              >
                {PROVIDERS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Model ID</Label>
              <Input
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="Enter model ID to certify"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>API key</Label>
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Not stored. Used only for this run"
            />
          </div>

          <div className="space-y-2">
            <Label>Resume source</Label>
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={resumeSource === "active"}
                  onChange={() => setResumeSource("active")}
                />
                My uploaded resume
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={resumeSource === "upload"}
                  onChange={() => setResumeSource("upload")}
                />
                Upload test PDF
              </label>
            </div>
            {resumeSource === "upload" && (
              <Input
                type="file"
                accept="application/pdf"
                onChange={(e) => setResumeFile(e.target.files?.[0] ?? null)}
              />
            )}
          </div>

          <Button onClick={handleRun} disabled={running}>
            {running && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Run certification
          </Button>
          {running && progress && <p className="text-sm text-muted-foreground">{progress}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Promoted models: {providerLabel}</CardTitle>
          <CardDescription>
            Certified models in the production dropdown for this provider.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {promotedForProvider.length > 0 ? (
            <ul className="space-y-2 text-sm">
              {promotedForProvider.map((m) => (
                <li
                  key={m.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2"
                >
                  <span>
                    {m.display_name}
                    <span className="text-muted-foreground"> ({m.model_id})</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">
                      overall {m.overall_score} · cert {m.certification_score} · reliability{" "}
                      {m.reliability_score} · {m.is_active ? "active" : "inactive"}
                    </span>
                    {m.is_active && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 text-destructive hover:text-destructive"
                        disabled={removingCuratedId === m.id}
                        onClick={() => handleRemoveCurated(m)}
                      >
                        {removingCuratedId === m.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                        <span className="sr-only">Remove</span>
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              No promoted models for {providerLabel} yet. Run certification and promote a passing
              model to add it here.
            </p>
          )}
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{resultTitle}</CardTitle>
          </CardHeader>
          <CardContent>
            <CertificationResultDetail
              result={result}
              title=""
              subtitle={resultSubtitle}
              onPromote={() => handlePromote(result.runId, result.model)}
            />
          </CardContent>
        </Card>
      )}

      {history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">History</CardTitle>
            <CardDescription>Click a row to view full scores and attempt details.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-4">Model</th>
                    <th className="pb-2 pr-4">Overall</th>
                    <th className="pb-2 pr-4">Cert</th>
                    <th className="pb-2 pr-4">Reliability</th>
                    <th className="pb-2">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((row) => (
                    <tr
                      key={row.id}
                      className={`cursor-pointer border-b border-border/50 transition-colors hover:bg-muted/50 ${
                        selectedHistoryId === row.id ? "bg-muted/70" : ""
                      }`}
                      onClick={() => handleHistorySelect(row)}
                    >
                      <td className="py-2 pr-4">
                        {row.provider} / {row.model}
                      </td>
                      <td className="py-2 pr-4 font-medium">{row.overall_score}</td>
                      <td className="py-2 pr-4">{row.certification_score}</td>
                      <td className="py-2 pr-4">{row.reliability_score}</td>
                      <td className="py-2 text-muted-foreground">
                        {new Date(row.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
