import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api, type AiCostMetrics } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { OneTapAiConfigPanel } from "@/components/admin/OneTapAiConfigPanel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

function formatUsd(value: number) {
  return `$${value.toFixed(4)}`;
}

export function AiCostPanel() {
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState("30");
  const [metrics, setMetrics] = useState<AiCostMetrics | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getAdminAiCost(Number(days));
      setMetrics(res.data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load cost metrics");
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    void load();
  }, [load]);

  const platformModels = useMemo(
    () => (metrics?.byModel ?? []).filter((r) => r.credential_source === "platform"),
    [metrics]
  );

  const byokModels = useMemo(
    () => (metrics?.byModel ?? []).filter((r) => r.credential_source === "user"),
    [metrics]
  );

  return (
    <div className="space-y-8">
      <OneTapAiConfigPanel />

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4">
          <div>
            <CardTitle>Platform cost overview</CardTitle>
            <CardDescription>
              Aggregated LLM spend - does not grow with user count. Per-user breakdown is on the
              Users tab.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="cost-days" className="text-sm text-muted-foreground">
              Period
            </Label>
            <Select value={days} onValueChange={setDays}>
              <SelectTrigger id="cost-days" className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["7", "30", "90"].map((d) => (
                  <SelectItem key={d} value={d}>
                    {d} days
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading metrics…
            </div>
          ) : metrics ? (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-md border p-4">
                  <p className="text-sm text-muted-foreground">OneTap AI (platform)</p>
                  <p className="text-2xl font-semibold tabular-nums">
                    {formatUsd(Number(metrics.totals.platformCost))}
                  </p>
                </div>
                <div className="rounded-md border p-4">
                  <p className="text-sm text-muted-foreground">BYOK (estimated)</p>
                  <p className="text-2xl font-semibold tabular-nums">
                    {formatUsd(Number(metrics.totals.byokEstimatedCost))}
                  </p>
                </div>
              </div>

              {metrics.byPlatformCredential.length > 0 && (
                <div>
                  <h3 className="mb-2 text-sm font-medium">Traffic by API key</h3>
                  <div className="overflow-x-auto rounded-md border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/40 text-left text-muted-foreground">
                          <th className="px-3 py-2">Key</th>
                          <th className="px-3 py-2">Provider</th>
                          <th className="px-3 py-2">Requests</th>
                          <th className="px-3 py-2">Cost</th>
                        </tr>
                      </thead>
                      <tbody>
                        {metrics.byPlatformCredential.map((row) => (
                          <tr key={row.credential_id} className="border-b border-border/50">
                            <td className="px-3 py-2">{row.label || row.credential_id.slice(0, 8)}</td>
                            <td className="px-3 py-2">{row.provider}</td>
                            <td className="px-3 py-2 tabular-nums">{row.request_count}</td>
                            <td className="px-3 py-2 tabular-nums">
                              {formatUsd(Number(row.total_cost))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="grid gap-6 lg:grid-cols-2">
                <ModelCostTable title="OneTap AI models" rows={platformModels} />
                <ModelCostTable title="BYOK models (estimated)" rows={byokModels} />
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function ModelCostTable({
  title,
  rows,
}: {
  title: string;
  rows: AiCostMetrics["byModel"];
}) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-medium">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No usage in this period.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-muted-foreground">
                <th className="px-3 py-2">Provider</th>
                <th className="px-3 py-2">Model</th>
                <th className="px-3 py-2">Req</th>
                <th className="px-3 py-2">Cost</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={`${row.provider}-${row.model}-${i}`} className="border-b border-border/50">
                  <td className="px-3 py-2">{row.provider}</td>
                  <td className="max-w-[140px] truncate px-3 py-2" title={row.model}>
                    {row.model}
                  </td>
                  <td className="px-3 py-2 tabular-nums">{row.request_count}</td>
                  <td className="px-3 py-2 tabular-nums">
                    {formatUsd(Number(row.total_cost))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
