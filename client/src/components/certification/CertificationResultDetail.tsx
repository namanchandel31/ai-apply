import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ModelCertificationResult, ModelCertificationRunSummary } from "@/lib/api";

type CertificationRunError = {
  step?: string;
  message?: string;
  attempt?: number;
};

type CertificationRunRow = {
  attempt?: number;
  success?: boolean;
  error?: CertificationRunError | string;
};

function formatRunError(error: CertificationRunError | string | undefined) {
  if (!error) return null;
  if (typeof error === "string") return error;
  const step = error.step ? `${error.step}: ` : "";
  return `${step}${error.message || "Unknown error"}`;
}

function statusBadge(result: { overallScore: number; recommended: boolean; passed: boolean }) {
  if (result.recommended) {
    return <Badge className="bg-emerald-600">Recommended</Badge>;
  }
  if (result.passed) {
    return <Badge variant="secondary" className="bg-amber-500/15 text-amber-700">Passed</Badge>;
  }
  return <Badge variant="destructive">Failed</Badge>;
}

export function historyRowToResult(row: ModelCertificationRunSummary): ModelCertificationResult {
  const scores =
    typeof row.scores_json === "string"
      ? (JSON.parse(row.scores_json) as Record<string, unknown>)
      : row.scores_json ?? {};

  const runs = Array.isArray(scores.runs) ? scores.runs : [];
  const totalLatencyMs = runs.reduce(
    (sum, r) => sum + (typeof r?.latencyMs === "number" ? r.latencyMs : 0),
    0
  );
  const valueBlock = scores.value as { totalCostUsd?: number } | undefined;
  const totalCostUsd = typeof valueBlock?.totalCostUsd === "number" ? valueBlock.totalCostUsd : 0;
  const resumeBlock = scores.resume as { score?: number } | undefined;
  const emailBlock = scores.email as { score?: number } | undefined;
  const judgeBlock = scores.judge as { confidence?: number } | undefined;
  const certBlock = scores.certification as { resumeScore?: number; emailScore?: number } | undefined;

  return {
    runId: row.id,
    provider: row.provider,
    model: row.model,
    resumeScore: resumeBlock?.score ?? certBlock?.resumeScore ?? 0,
    emailScore: emailBlock?.score ?? certBlock?.emailScore ?? 0,
    certificationScore: row.certification_score,
    reliabilityScore: row.reliability_score,
    judgeConfidence: judgeBlock?.confidence ?? 0,
    valueScore: row.value_score,
    overallScore: row.overall_score,
    passed: row.passed,
    recommended: row.recommended,
    totalCostUsd,
    costPer100Runs: totalCostUsd * 100,
    costPer1000Runs: totalCostUsd * 1000,
    totalLatencyMs,
    scores,
  };
}

type CertificationResultDetailProps = {
  result: ModelCertificationResult;
  title?: string;
  subtitle?: string;
  onPromote?: () => void;
  promoteLabel?: string;
};

export function CertificationResultDetail({
  result,
  title = "Result",
  subtitle,
  onPromote,
  promoteLabel = "Promote to product dropdown",
}: CertificationResultDetailProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          {title ? <p className="text-base font-medium">{title}</p> : null}
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {statusBadge(result)}
      </div>
      <div className="text-4xl font-bold tabular-nums">{result.overallScore}</div>
      <p className="text-sm text-muted-foreground">Overall score (primary ranking)</p>
      <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div>
          <div className="text-muted-foreground">Certification</div>
          <div className="font-medium">{result.certificationScore}</div>
        </div>
        <div>
          <div className="text-muted-foreground">Reliability</div>
          <div className="font-medium">{result.reliabilityScore}</div>
        </div>
        <div>
          <div className="text-muted-foreground">Resume / Email</div>
          <div className="font-medium">
            {result.resumeScore} / {result.emailScore}
          </div>
        </div>
        <div>
          <div className="text-muted-foreground">Judge confidence</div>
          <div className="font-medium">{result.judgeConfidence}</div>
        </div>
      </div>
      <div className="text-sm text-muted-foreground">
        Cost ${result.totalCostUsd.toFixed(4)} · per 100 runs ${result.costPer100Runs.toFixed(2)} ·{" "}
        {(result.totalLatencyMs / 1000).toFixed(1)}s total
      </div>
      {Array.isArray((result.scores as { runs?: CertificationRunRow[] })?.runs) && (
        <div className="space-y-2 rounded-md border border-border/60 p-3 text-sm">
          <p className="font-medium">Attempt details</p>
          {((result.scores as { runs: CertificationRunRow[] }).runs || []).map((run) => {
            const errText = formatRunError(run.error);
            return (
              <div key={run.attempt ?? errText} className="text-muted-foreground">
                <span className="font-medium text-foreground">Run {run.attempt ?? "?"}</span>
                {": "}
                {run.success ? "succeeded" : errText || "failed"}
              </div>
            );
          })}
        </div>
      )}
      {onPromote && (
        <Button variant="outline" onClick={onPromote}>
          {promoteLabel}
        </Button>
      )}
    </div>
  );
}
