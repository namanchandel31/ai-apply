import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";
import {
  api,
  type ExtensionDetectionConfig,
  type ExtensionDetectionConfigPatch,
} from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const TEXTAREA_CLASS =
  "flex min-h-[120px] w-full rounded-[10px] border border-input-border bg-input px-[14px] py-2.5 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const SCORE_MIN = 0;
const SCORE_MAX = 1000;

type FormState = {
  hiringKeywords: string;
  applyKeywords: string;
  blockedEmailPrefixes: string;
  scoreEmail: string;
  scoreHiringKeyword: string;
  scoreApplyKeyword: string;
  threshold: string;
};

function listToText(list: string[]): string {
  return list.join("\n");
}

function textToList(text: string): string[] {
  return text
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function configToForm(config: ExtensionDetectionConfig): FormState {
  return {
    hiringKeywords: listToText(config.hiringKeywords),
    applyKeywords: listToText(config.applyKeywords),
    blockedEmailPrefixes: listToText(config.blockedEmailPrefixes),
    scoreEmail: String(config.scoreEmail),
    scoreHiringKeyword: String(config.scoreHiringKeyword),
    scoreApplyKeyword: String(config.scoreApplyKeyword),
    threshold: String(config.threshold),
  };
}

function parseScore(value: string, label: string): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < SCORE_MIN || n > SCORE_MAX) {
    throw new Error(`${label} must be a whole number between ${SCORE_MIN} and ${SCORE_MAX}`);
  }
  return n;
}

function buildPatch(form: FormState): ExtensionDetectionConfigPatch {
  return {
    hiringKeywords: textToList(form.hiringKeywords),
    applyKeywords: textToList(form.applyKeywords),
    blockedEmailPrefixes: textToList(form.blockedEmailPrefixes),
    scoreEmail: parseScore(form.scoreEmail, "Email score"),
    scoreHiringKeyword: parseScore(form.scoreHiringKeyword, "Hiring keyword score"),
    scoreApplyKeyword: parseScore(form.scoreApplyKeyword, "Apply keyword score"),
    threshold: parseScore(form.threshold, "Threshold"),
  };
}

export function DetectionConfigPanel() {
  const [config, setConfig] = useState<ExtensionDetectionConfig | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await api.getExtensionDetectionConfig();
      setConfig(res.data);
      setForm(configToForm(res.data));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load detection config");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const setField = (key: keyof FormState, value: string) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const isDirty = useMemo(() => {
    if (!config || !form) return false;
    return JSON.stringify(configToForm(config)) !== JSON.stringify(form);
  }, [config, form]);

  const handleSave = async () => {
    if (!form) return;
    let patch: ExtensionDetectionConfigPatch;
    try {
      patch = buildPatch(form);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid values");
      return;
    }

    setSaving(true);
    try {
      const res = await api.updateExtensionDetectionConfig(patch);
      setConfig(res.data);
      setForm(configToForm(res.data));
      toast.success("Detection config saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save detection config");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (config) setForm(configToForm(config));
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading detection config…
      </div>
    );
  }

  if (loadError || !form) {
    return (
      <Card>
        <CardContent className="space-y-3 py-6">
          <p className="text-sm text-destructive" role="alert">
            {loadError ?? "Detection config unavailable"}
          </p>
          <Button type="button" variant="outline" onClick={() => void load()}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        These rules control when the LinkedIn extension shows the <strong>Add to OneTap</strong>{" "}
        button. A post qualifies when its total score reaches the threshold. Scores are additive: a
        valid contact email plus a matching hiring keyword is the typical qualifying combination.
      </p>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Keywords</CardTitle>
          <CardDescription>One entry per line (commas also accepted). Matching is case-insensitive.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="hiring-keywords">Hiring keywords</Label>
            <textarea
              id="hiring-keywords"
              className={TEXTAREA_CLASS}
              value={form.hiringKeywords}
              onChange={(e) => setField("hiringKeywords", e.target.value)}
              placeholder="hiring&#10;we're hiring&#10;open role"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="apply-keywords">Apply keywords</Label>
            <textarea
              id="apply-keywords"
              className={TEXTAREA_CLASS}
              value={form.applyKeywords}
              onChange={(e) => setField("applyKeywords", e.target.value)}
              placeholder="apply&#10;send your resume&#10;dm me"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="blocked-prefixes">Blocked email prefixes</Label>
            <textarea
              id="blocked-prefixes"
              className={TEXTAREA_CLASS}
              value={form.blockedEmailPrefixes}
              onChange={(e) => setField("blockedEmailPrefixes", e.target.value)}
              placeholder="no-reply&#10;noreply&#10;support"
            />
            <p className="text-xs text-muted-foreground">
              Emails starting with these prefixes are ignored when scoring (e.g. no-reply@…).
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Scoring</CardTitle>
          <CardDescription>
            Whole numbers between {SCORE_MIN} and {SCORE_MAX}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="score-email">Email score</Label>
              <Input
                id="score-email"
                type="number"
                min={SCORE_MIN}
                max={SCORE_MAX}
                value={form.scoreEmail}
                onChange={(e) => setField("scoreEmail", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="score-hiring">Hiring keyword score</Label>
              <Input
                id="score-hiring"
                type="number"
                min={SCORE_MIN}
                max={SCORE_MAX}
                value={form.scoreHiringKeyword}
                onChange={(e) => setField("scoreHiringKeyword", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="score-apply">Apply keyword score</Label>
              <Input
                id="score-apply"
                type="number"
                min={SCORE_MIN}
                max={SCORE_MAX}
                value={form.scoreApplyKeyword}
                onChange={(e) => setField("scoreApplyKeyword", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="threshold">Threshold</Label>
              <Input
                id="threshold"
                type="number"
                min={SCORE_MIN}
                max={SCORE_MAX}
                value={form.threshold}
                onChange={(e) => setField("threshold", e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={() => void handleSave()} disabled={saving || !isDirty} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save changes
        </Button>
        <Button type="button" variant="outline" onClick={handleReset} disabled={saving || !isDirty} className="gap-2">
          <RotateCcw className="h-4 w-4" />
          Reset
        </Button>
        {config?.updatedAt ? (
          <span className="text-xs text-muted-foreground">
            Last updated {new Date(config.updatedAt).toLocaleString()}
          </span>
        ) : null}
      </div>
    </div>
  );
}
