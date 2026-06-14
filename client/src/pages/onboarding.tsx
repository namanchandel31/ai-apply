import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  FileText,
  KeyRound,
  Loader2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { api, type ApiError } from "@/lib/api";
import { useSetupStatus } from "@/hooks/useSetupStatus";
import { useResumeParsePolling } from "@/hooks/useResumeParsePolling";
import { useActivationTracking } from "@/hooks/useActivationTracking";
import {
  trackOnboardingEvent,
  WELCOME_SEEN_KEY,
} from "@/lib/onboardingEvents";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { OneTapBrand, OneTapLogomark } from "@/components/OneTapLogomark";
import { PAGE_PADDING_X } from "@/lib/pageLayout";
import { cn } from "@/lib/utils";
import { UserMenu } from "@/components/UserMenu";
import { useAuth } from "@/auth/AuthContext";
import { getDisplayFirstName } from "@/lib/userDisplay";
import { setupStatusQueryOptions } from "@/queries/bootstrapQueries";

const REMOTE_PROVIDERS = [
  { id: "openai", label: "OpenAI" },
  { id: "openrouter", label: "OpenRouter" },
  { id: "anthropic", label: "Anthropic" },
  { id: "gemini", label: "Gemini" },
  { id: "grok", label: "Grok" },
  { id: "groq", label: "Groq" },
  { id: "nvidia", label: "NVIDIA NIM" },
];

type AiUiState =
  | "idle"
  | "saving"
  | "pending_validation"
  | "valid"
  | "invalid"
  | "validation_timeout";

type ResumeUiState =
  | "idle"
  | "uploading"
  | "queued"
  | "processing"
  | "completed"
  | "failed"
  | "stalled";

export function Onboarding() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, refreshUser } = useAuth();
  const { data: status, isLoading, refetch } = useSetupStatus();
  useActivationTracking(status, "onboarding");

  const [showWelcome, setShowWelcome] = useState<boolean | null>(null);
  const [provider, setProvider] = useState("openai");
  const [selectedModel, setSelectedModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [curatedModels, setCuratedModels] = useState<
    Array<{ modelId: string; displayName: string }>
  >([]);
  const [aiUi, setAiUi] = useState<AiUiState>("idle");
  const [aiError, setAiError] = useState<string | null>(null);
  const [resumeUi, setResumeUi] = useState<ResumeUiState>("idle");
  const [redirectSeconds, setRedirectSeconds] = useState<number | null>(null);
  const redirectCancelled = useRef(false);
  const uploadStartedAt = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasVerifiedAi = !!status?.hasVerifiedAiCredential;
  const hasValidResume = !!status?.hasValidResume;
  const isActivated = hasVerifiedAi && hasValidResume;
  const parsingResume = !!status?.hasResume && !hasValidResume;

  useResumeParsePolling(parsingResume);

  useEffect(() => {
    if (!user || user.firstName?.trim() || user.fullName?.trim()) return;
    void api.seedProfileFromEmail().then(() => refreshUser());
  }, [user, refreshUser]);

  useEffect(() => {
    let cancelled = false;
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

  useEffect(() => {
    if (isLoading || !status) return;
    const seen = sessionStorage.getItem(WELCOME_SEEN_KEY) === "true";
    const skip =
      hasVerifiedAi || hasValidResume || seen;
    setShowWelcome(!skip);
  }, [isLoading, status, hasVerifiedAi, hasValidResume]);

  useEffect(() => {
    if (hasVerifiedAi) setAiUi("valid");
  }, [hasVerifiedAi]);

  useEffect(() => {
    if (hasValidResume) setResumeUi("completed");
  }, [hasValidResume]);

  useEffect(() => {
    if (!parsingResume) return;
    setResumeUi((s) => (s === "uploading" ? "processing" : s === "idle" ? "queued" : s));
  }, [parsingResume]);

  useEffect(() => {
    if (!parsingResume || !status?.activeResume?.uploadedAt) return;
    const uploaded = new Date(status.activeResume.uploadedAt).getTime();
    const tick = setInterval(() => {
      if (Date.now() - uploaded > 90_000) {
        setResumeUi("stalled");
      }
    }, 5000);
    return () => clearInterval(tick);
  }, [parsingResume, status?.activeResume?.uploadedAt]);

  useEffect(() => {
    if (!isActivated) return;
    redirectCancelled.current = false;
    setRedirectSeconds(5);
  }, [isActivated]);

  useEffect(() => {
    if (redirectSeconds === null || redirectCancelled.current) return;
    if (redirectSeconds <= 0) {
      trackOnboardingEvent("dashboard_entered");
      navigate("/dashboard", { replace: true });
      return;
    }
    const t = setTimeout(() => setRedirectSeconds((s) => (s !== null ? s - 1 : null)), 1000);
    return () => clearTimeout(t);
  }, [redirectSeconds, navigate]);

  const invalidateStatus = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: setupStatusQueryOptions.queryKey });
    refetch();
  }, [queryClient, refetch]);

  const handleGetStarted = async () => {
    sessionStorage.setItem(WELCOME_SEEN_KEY, "true");
    trackOnboardingEvent("onboarding_started");
    try {
      await api.seedProfileFromEmail();
      await refreshUser();
    } catch {
      // Non-blocking — user can set name later from the account menu.
    }
    setShowWelcome(false);
  };

  const handleSaveAi = async () => {
    if (!selectedModel) {
      toast.error("Select a certified model from the dropdown");
      return;
    }
    setAiError(null);
    setAiUi("saving");
    trackOnboardingEvent("ai_key_validation_started");
    setAiUi("pending_validation");
    try {
      await api.saveAiCredential({
        provider,
        apiKey,
        selectedModel,
        role: "primary",
        providerType: "remote",
      });
      setAiUi("valid");
      trackOnboardingEvent("ai_key_verified");
      toast.success("AI provider verified");
      invalidateStatus();
    } catch (err) {
      const e = err as ApiError;
      const timeout = e.code === "AI_VALIDATION_TIMEOUT";
      setAiUi(timeout ? "validation_timeout" : "invalid");
      setAiError(
        timeout
          ? "The provider took too long to respond. Please try again."
          : e.message || "Could not verify your API key"
      );
      trackOnboardingEvent("ai_key_validation_failed", { code: e.code ?? "unknown" });
    }
  };

  const handleResumeUpload = async (file: File) => {
    if (!hasVerifiedAi) {
      toast.error("Verify your AI key before uploading a resume");
      return;
    }
    setResumeUi("uploading");
    uploadStartedAt.current = Date.now();
    trackOnboardingEvent("resume_uploaded");
    try {
      await api.uploadResume(file, "onboarding");
      setResumeUi("queued");
      toast.success("Resume uploaded — parsing in progress");
      invalidateStatus();
    } catch (err) {
      setResumeUi("failed");
      toast.error(err instanceof Error ? err.message : "Upload failed");
    }
  };

  useEffect(() => {
    if (hasValidResume && uploadStartedAt.current) {
      trackOnboardingEvent("resume_parsed");
    }
  }, [hasValidResume]);

  if (isLoading || showWelcome === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (showWelcome) {
    const welcomeName = user ? getDisplayFirstName(user) : null;
    return (
      <div className={cn("flex min-h-screen flex-col items-center justify-center bg-background", PAGE_PADDING_X)}>
        <div className="max-w-lg text-center space-y-6">
          <OneTapLogomark className="mx-auto h-14 w-auto" />
          <h1 className="text-display font-semibold">
            {welcomeName ? `Welcome, ${welcomeName}` : "Welcome to OneTap"}
          </h1>
          <p className="text-muted-foreground">
            Connect your AI provider and upload your resume to start sending tailored applications in one tap.
          </p>
          <Button size="lg" onClick={() => void handleGetStarted()}>
            Get Started
          </Button>
        </div>
      </div>
    );
  }

  const step = status?.currentOnboardingStep ?? "ai";

  return (
    <div className="min-h-screen bg-background">
      <header className={cn("border-b border-border py-4", PAGE_PADDING_X)}>
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <OneTapBrand logomarkClassName="h-7" />
          <UserMenu />
        </div>
      </header>

      <main className={cn("mx-auto max-w-2xl space-y-6 py-10", PAGE_PADDING_X)}>
        {!isActivated && (
          <div className="flex gap-2 text-xs text-muted-foreground">
            <Badge variant={step === "ai" ? "default" : "outline"}>1. AI</Badge>
            <Badge variant={step === "resume" ? "default" : "outline"}>2. Resume</Badge>
          </div>
        )}

        {isActivated ? (
          <Card className="ring-1 ring-success/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span aria-hidden>🎉</span> You&apos;re ready to apply
              </CardTitle>
              <CardDescription>
                Your AI key and resume are set. Gmail is optional — connect it anytime from Setup to send from your own inbox.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {redirectSeconds !== null && !redirectCancelled.current && (
                <p className="text-sm text-muted-foreground">
                  Redirecting to dashboard in {redirectSeconds}s…{" "}
                  <button
                    type="button"
                    className="underline"
                    onClick={() => {
                      redirectCancelled.current = true;
                      setRedirectSeconds(null);
                    }}
                  >
                    Cancel
                  </button>
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => {
                    trackOnboardingEvent("dashboard_entered");
                    navigate("/dashboard");
                  }}
                >
                  Go To Dashboard
                </Button>
                <Button variant="outline" asChild>
                  <a
                    href="/setup?focus=email"
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => trackOnboardingEvent("gmail_setup_clicked")}
                  >
                    Setup Gmail
                  </a>
                </Button>
                <Button variant="ghost" onClick={() => redirectCancelled.current = true}>
                  Stay Here
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className={step === "ai" ? "ring-2 ring-ring/20" : ""}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <KeyRound className="h-5 w-5" />
                  AI provider
                  {hasVerifiedAi && (
                    <CheckCircle2 className="h-5 w-5 text-success" />
                  )}
                </CardTitle>
                <CardDescription>
                  Your API key is validated before resume upload. Billing goes to your provider account.
                </CardDescription>
              </CardHeader>
              {hasVerifiedAi ? (
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {status?.activeAiProvider?.provider ?? "Provider"} connected
                    {status?.activeAiProvider?.selectedModel
                      ? ` · ${status.activeAiProvider.selectedModel}`
                      : ""}
                  </p>
                </CardContent>
              ) : (
                <CardContent className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Provider</Label>
                      <select
                        className="flex h-10 w-full rounded-[10px] border border-input-border bg-input px-[14px] py-2.5 text-base"
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
                      <Label>Model</Label>
                      {curatedModels.length > 0 ? (
                        <select
                          className="flex h-10 w-full rounded-[10px] border border-input-border bg-input px-[14px] py-2.5 text-base"
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
                        <p className="rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">
                          No certified models for this provider yet. Ask your admin to certify models
                          via the dev certification tool.
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>API key</Label>
                    <Input
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      autoComplete="off"
                    />
                  </div>
                  {aiUi === "validation_timeout" && (
                    <div className="rounded-xl bg-warning/10 p-3 text-sm">
                      <p className="font-medium">Unable to verify provider.</p>
                      <p className="text-muted-foreground">{aiError}</p>
                      <div className="mt-3 flex gap-2">
                        <Button size="sm" variant="outline" onClick={handleSaveAi}>
                          Retry Validation
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setAiUi("idle");
                            setApiKey("");
                          }}
                        >
                          Change Key
                        </Button>
                      </div>
                    </div>
                  )}
                  {aiUi === "invalid" && aiError && (
                    <p className="text-sm text-destructive">{aiError}</p>
                  )}
                  <Button
                    onClick={handleSaveAi}
                    disabled={
                      !apiKey ||
                      !selectedModel ||
                      curatedModels.length === 0 ||
                      aiUi === "saving" ||
                      aiUi === "pending_validation"
                    }
                  >
                    {(aiUi === "saving" || aiUi === "pending_validation") && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    {aiUi === "pending_validation" ? "Verifying…" : "Save & Verify"}
                  </Button>
                </CardContent>
              )}
            </Card>

            <Card className={step === "resume" ? "ring-2 ring-ring/20" : ""}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <FileText className="h-5 w-5" />
                  Resume
                  {hasValidResume && (
                    <CheckCircle2 className="h-5 w-5 text-success" />
                  )}
                </CardTitle>
                <CardDescription>PDF only. Parsed with your verified AI key.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!hasVerifiedAi && (
                  <p className="text-sm text-muted-foreground">
                    Complete AI verification above to unlock resume upload.
                  </p>
                )}
                {hasValidResume && status?.activeResume && (
                  <p className="text-sm">
                    <CheckCircle2 className="mr-1 inline h-4 w-4 text-success" />
                    {status.activeResume.filename}
                  </p>
                )}
                {!hasValidResume && (
                  <>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="application/pdf"
                      className="hidden"
                      disabled={!hasVerifiedAi}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void handleResumeUpload(f);
                      }}
                    />
                    <Button
                      variant="outline"
                      disabled={!hasVerifiedAi || resumeUi === "uploading"}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {resumeUi === "uploading" ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="mr-2 h-4 w-4" />
                      )}
                      Upload PDF
                    </Button>
                    {resumeUi === "processing" && (
                      <p className="text-sm text-muted-foreground flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Parsing your resume…
                      </p>
                    )}
                    {resumeUi === "stalled" && (
                      <div className="text-sm space-y-2">
                        <p className="text-warning">
                          Parsing is taking longer than expected. You can retry upload or continue from Setup later.
                        </p>
                        <Button size="sm" variant="outline" asChild>
                          <Link to="/setup">Open Setup</Link>
                        </Button>
                      </div>
                    )}
                    {resumeUi === "failed" && (
                      <p className="text-sm text-destructive">
                        Upload failed. Check your file and try again.
                      </p>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
