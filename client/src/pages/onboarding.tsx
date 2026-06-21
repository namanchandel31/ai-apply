import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { api, type ApiError } from "@/lib/api";
import { useSetupStatus } from "@/hooks/useSetupStatus";
import { useResumeParsePolling } from "@/hooks/useResumeParsePolling";
import { useActivationTracking } from "@/hooks/useActivationTracking";
import { trackOnboardingEvent } from "@/lib/onboardingEvents";
import { markOnboardingWalkthroughPending } from "@/lib/onboardingWalkthrough";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OneTapBrand } from "@/components/OneTapLogomark";
import { ExtensionInstallPrompt } from "@/components/onboarding/ExtensionInstallPrompt";
import { OnboardingConfetti } from "@/components/onboarding/OnboardingConfetti";
import { ResumeDropzone } from "@/components/onboarding/ResumeDropzone";
import { EmailStatusCard } from "@/components/EmailStatusCard";
import {
  clearEmailStepSkipped,
  clearOnboardingExtensionPending,
  hasDismissedExtensionPrompt,
  hasEmailStepSkipped,
  hasOnboardingExtensionPending,
  markEmailStepSkipped,
  markExtensionPromptDismissed,
  markOnboardingExtensionPending,
} from "@/lib/extensionPrompt";
import { AiProviderOptionLabel } from "@/components/ai/AiProviderLogo";
import { cn } from "@/lib/utils";
import { useAuth } from "@/auth/AuthContext";
import { getDisplayFirstName } from "@/lib/userDisplay";
import { setupStatusQueryOptions } from "@/queries/bootstrapQueries";
import { getAiProviderApiKeyLink } from "@/lib/aiProviderApiKeyLinks";
import {
  isProviderComingSoon,
  REMOTE_PROVIDERS,
  type RemoteProviderId,
} from "@/lib/remoteProviders";

const STEPS = [
  { id: 1, label: "Choose Model" },
  { id: 2, label: "Upload Resume" },
  { id: 3, label: "Connect Gmail" },
] as const;

const FIELD_CLASS = "flex flex-col gap-1";
const LABEL_CLASS = "block text-base font-medium leading-normal text-foreground";
const CONTROL_WRAP_CLASS = "w-full";

type OnboardingFieldProps = {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
};

function OnboardingField({ label, htmlFor, children }: OnboardingFieldProps) {
  return (
    <div className={FIELD_CLASS}>
      <Label htmlFor={htmlFor} className={LABEL_CLASS}>
        {label}
      </Label>
      <div className={CONTROL_WRAP_CLASS}>{children}</div>
    </div>
  );
}

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

type StepProgressProps = {
  activeStep: number;
  completed: [boolean, boolean, boolean];
};

function OnboardingStepProgress({ activeStep, completed }: StepProgressProps) {
  return (
    <div className="mx-auto flex w-fit items-start justify-center">
      {STEPS.map((step, index) => {
        const done = completed[index];
        const current = activeStep === step.id;
        const upcoming = !done && !current;

        return (
          <div key={step.id} className="flex items-start">
            <div className="flex flex-col items-center gap-1.5 px-0.5">
              <span
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors",
                  done && "bg-success/15 text-success",
                  current && !done && "bg-foreground text-background",
                  upcoming && "bg-black/[0.06] text-muted-foreground"
                )}
              >
                {done ? <CheckCircle2 className="h-4 w-4" aria-hidden /> : step.id}
              </span>
              <span
                className={cn(
                  "whitespace-nowrap text-xs font-medium",
                  current ? "text-foreground" : done ? "text-success" : "text-muted-foreground"
                )}
              >
                {step.label}
              </span>
            </div>
            {index < STEPS.length - 1 ? (
              <div
                className={cn(
                  "mx-2 mt-4 h-px w-10 shrink-0 sm:mx-3 sm:w-14",
                  completed[index] ? "bg-success/40" : "bg-border"
                )}
                aria-hidden
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function Onboarding() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, refreshUser } = useAuth();
  const { data: status, isLoading, refetch } = useSetupStatus();
  useActivationTracking(status, "onboarding");

  const [provider, setProvider] = useState<RemoteProviderId | "">("");
  const [selectedModel, setSelectedModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [curatedModels, setCuratedModels] = useState<
    Array<{ modelId: string; displayName: string }>
  >([]);
  const [aiUi, setAiUi] = useState<AiUiState>("idle");
  const [aiError, setAiError] = useState<string | null>(null);
  const [resumeUi, setResumeUi] = useState<ResumeUiState>("idle");
  const [emailSkipped, setEmailSkipped] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const [showExtensionPrompt, setShowExtensionPrompt] = useState(false);
  const celebrationStartedRef = useRef(false);
  const extensionPromptTrackedRef = useRef(false);
  const extensionStepStartedRef = useRef(false);
  const uploadStartedAt = useRef<number | null>(null);
  const startedRef = useRef(false);

  const hasVerifiedAi = !!status?.hasVerifiedAiCredential;
  const hasValidResume = !!status?.hasValidResume;
  const hasEmailSetup = !!status?.hasEmailSetup;
  const emailStepResolved = hasEmailSetup || emailSkipped || hasEmailStepSkipped();
  const isComplete = hasVerifiedAi && hasValidResume && emailStepResolved;
  const parsingResume = !!status?.hasResume && !hasValidResume;

  const completedSteps: [boolean, boolean, boolean] = [
    hasVerifiedAi,
    hasValidResume,
    hasEmailSetup,
  ];
  const completedCount = completedSteps.filter(Boolean).length;
  const activeStep = !hasVerifiedAi
    ? 1
    : !hasValidResume
      ? 2
      : !emailStepResolved
        ? 3
        : 0;
  const remainingCount = 3 - completedCount;

  useResumeParsePolling(parsingResume);

  useEffect(() => {
    if (!user || user.firstName?.trim() || user.fullName?.trim()) return;
    void api.seedProfileFromEmail().then(() => refreshUser());
  }, [user, refreshUser]);

  useEffect(() => {
    if (startedRef.current || isLoading) return;
    startedRef.current = true;
    trackOnboardingEvent("onboarding_started");
    void api.seedProfileFromEmail().then(() => refreshUser()).catch(() => {});
  }, [isLoading, refreshUser]);

  useEffect(() => {
    if (!provider || isProviderComingSoon(provider)) {
      setCuratedModels([]);
      return;
    }

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

  const finishOnboarding = useCallback(() => {
    clearOnboardingExtensionPending();
    clearEmailStepSkipped();
    markOnboardingWalkthroughPending();
    trackOnboardingEvent("dashboard_entered");
    navigate("/dashboard", { replace: true });
  }, [navigate]);

  const beginOnboardingCompletion = useCallback(() => {
    if (celebrationStartedRef.current) return;
    celebrationStartedRef.current = true;
    markOnboardingExtensionPending();
    trackOnboardingEvent("onboarding_completed");
    setCelebrating(true);
  }, []);

  const continueAfterExtensionPrompt = useCallback(() => {
    markExtensionPromptDismissed();
    setShowExtensionPrompt(false);
    finishOnboarding();
  }, [finishOnboarding]);

  const showExtensionStep = useCallback(() => {
    if (extensionStepStartedRef.current) return;
    extensionStepStartedRef.current = true;
    setCelebrating(false);
    const shouldShowExtension =
      hasOnboardingExtensionPending() || !hasDismissedExtensionPrompt();
    if (!shouldShowExtension) {
      finishOnboarding();
      return;
    }
    setShowExtensionPrompt(true);
    if (!extensionPromptTrackedRef.current) {
      extensionPromptTrackedRef.current = true;
      trackOnboardingEvent("extension_prompt_shown");
    }
  }, [finishOnboarding]);

  useEffect(() => {
    if (!isLoading && hasEmailStepSkipped()) {
      setEmailSkipped(true);
    }
  }, [isLoading]);

  useEffect(() => {
    if (!isComplete || celebrationStartedRef.current) return;
    beginOnboardingCompletion();
  }, [isComplete, beginOnboardingCompletion]);

  useEffect(() => {
    if (isLoading || !hasVerifiedAi || !hasValidResume || !emailStepResolved) return;
    if (!hasOnboardingExtensionPending() || showExtensionPrompt || celebrating) return;
    if (extensionStepStartedRef.current) {
      setShowExtensionPrompt(true);
      return;
    }
    if (!celebrationStartedRef.current) {
      beginOnboardingCompletion();
    }
  }, [
    isLoading,
    hasVerifiedAi,
    hasValidResume,
    emailStepResolved,
    showExtensionPrompt,
    celebrating,
    beginOnboardingCompletion,
  ]);

  useEffect(() => {
    if (hasValidResume && uploadStartedAt.current) {
      trackOnboardingEvent("resume_parsed");
    }
  }, [hasValidResume]);

  const invalidateStatus = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: setupStatusQueryOptions.queryKey });
    refetch();
  }, [queryClient, refetch]);

  useEffect(() => {
    if (!celebrating) return;
    const timer = window.setTimeout(() => {
      showExtensionStep();
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [celebrating, showExtensionStep]);

  const handleSaveAi = async () => {
    if (!provider) {
      toast.error("Select a model provider");
      return;
    }
    if (!selectedModel) {
      toast.error("Select a model from the dropdown");
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
      toast.error("Verify your AI provider before uploading a resume");
      return;
    }
    setResumeUi("uploading");
    uploadStartedAt.current = Date.now();
    trackOnboardingEvent("resume_uploaded");
    try {
      await api.uploadResume(file, "onboarding");
      setResumeUi("queued");
      toast.success("Resume uploaded. Parsing in progress");
      invalidateStatus();
    } catch (err) {
      setResumeUi("failed");
      toast.error(err instanceof Error ? err.message : "Upload failed");
    }
  };

  const handleSkipEmail = () => {
    trackOnboardingEvent("email_setup_skipped");
    markEmailStepSkipped();
    markOnboardingExtensionPending();
    setEmailSkipped(true);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const welcomeName = user ? getDisplayFirstName(user) : null;
  const currentStepMeta = STEPS.find((s) => s.id === activeStep);
  const apiKeyLink = getAiProviderApiKeyLink(provider);
  const welcomeDescription =
    remainingCount === 0
      ? "Almost ready to apply."
      : activeStep === 3
        ? "Optional — connect Gmail to send applications."
        : remainingCount === 1
          ? "One step left, then you can explore OneTap."
          : `${remainingCount} steps left. Finish setup to get started.`;

  if (showExtensionPrompt) {
    return (
      <div className="min-h-screen bg-background">
        <div className="flex min-h-screen items-center justify-center px-6 py-12">
          <ExtensionInstallPrompt onContinue={continueAfterExtensionPrompt} />
        </div>
      </div>
    );
  }

  if (isComplete) {
    return (
      <div className="min-h-screen bg-background">
        {celebrating ? (
          <>
            <OnboardingConfetti active onComplete={showExtensionStep} />
            <div className="pointer-events-none fixed inset-0 z-[9998] flex items-center justify-center bg-white/75">
              <p className="text-xl font-semibold text-foreground">You&apos;re all set!</p>
            </div>
          </>
        ) : (
          <div className="flex min-h-screen items-center justify-center bg-background">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {celebrating ? (
        <>
          <OnboardingConfetti active onComplete={showExtensionStep} />
          <div className="pointer-events-none fixed inset-0 z-[9998] flex items-center justify-center bg-white/75">
            <p className="text-xl font-semibold text-foreground">You&apos;re all set!</p>
          </div>
        </>
      ) : null}

      <div className="flex min-h-screen items-center justify-center px-6 py-12">
        <div className="w-full max-w-lg">
          <div className="flex flex-col items-center text-center">
            <OneTapBrand className="mb-6 justify-center" />

            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {welcomeName ? `Welcome, ${welcomeName}` : "Welcome to OneTap"}
            </h1>
            <p className="mt-3 text-base text-muted-foreground">{welcomeDescription}</p>
          </div>

          <div className="mb-6 mt-10 flex justify-center">
            <OnboardingStepProgress activeStep={activeStep} completed={completedSteps} />
          </div>

          <Card className="w-full border border-border bg-white shadow-none">
            <CardContent className="p-8">
              {activeStep > 0 && currentStepMeta ? (
                <>
                  <h2 className="text-base font-medium text-foreground">{currentStepMeta.label}</h2>

                {activeStep === 1 ? (
                  <div className="mt-5 space-y-4">
                    <OnboardingField label="Model provider">
                      <Select
                        value={provider || undefined}
                        onValueChange={(value) => {
                          setProvider(value as RemoteProviderId);
                          setSelectedModel("");
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select your model provider" />
                        </SelectTrigger>
                        <SelectContent>
                          {[...REMOTE_PROVIDERS]
                            .sort(
                              (a, b) =>
                                Number(isProviderComingSoon(a.id)) -
                                Number(isProviderComingSoon(b.id)),
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
                    </OnboardingField>

                    <OnboardingField label="Model">
                      <Select
                        value={selectedModel || undefined}
                        onValueChange={setSelectedModel}
                        disabled={!provider || curatedModels.length === 0}
                      >
                        <SelectTrigger>
                          <SelectValue
                            placeholder={
                              !provider
                                ? "Select a provider first"
                                : curatedModels.length > 0
                                  ? "Select model"
                                  : "No certified models for this provider yet."
                            }
                          />
                        </SelectTrigger>
                        {curatedModels.length > 0 ? (
                          <SelectContent>
                            {curatedModels.map((m) => (
                              <SelectItem key={m.modelId} value={m.modelId}>
                                {m.displayName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        ) : null}
                      </Select>
                    </OnboardingField>

                    <OnboardingField label="API key" htmlFor="onboarding-api-key">
                      <div className="flex flex-col gap-1">
                        <Input
                          id="onboarding-api-key"
                          type="password"
                          value={apiKey}
                          onChange={(e) => setApiKey(e.target.value)}
                          autoComplete="off"
                          placeholder="Paste your API key"
                        />
                        {apiKeyLink ? (
                          <p className="text-base text-muted-foreground">
                            You can get your {apiKeyLink.providerName} API key from{" "}
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
                    </OnboardingField>

                    {aiUi === "validation_timeout" && (
                      <div className="rounded-[10px] bg-warning/10 p-3 text-base">
                        <p className="font-medium">Unable to verify provider.</p>
                        <p className="text-muted-foreground">{aiError}</p>
                        <div className="mt-3 flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => void handleSaveAi()}>
                            Retry
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setAiUi("idle");
                              setApiKey("");
                            }}
                          >
                            Change key
                          </Button>
                        </div>
                      </div>
                    )}
                    {aiUi === "invalid" && aiError ? (
                      <p className="text-base text-destructive">{aiError}</p>
                    ) : null}

                    <Button
                      className="w-full"
                      onClick={() => void handleSaveAi()}
                      disabled={
                        !provider ||
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
                      {aiUi === "pending_validation" ? "Verifying…" : "Save & verify"}
                    </Button>
                  </div>
                ) : null}

                {activeStep === 2 ? (
                  <div className="mt-5 space-y-4">
                    <ResumeDropzone
                      busy={resumeUi === "uploading"}
                      onFile={(file) => void handleResumeUpload(file)}
                    />
                    {resumeUi === "processing" && (
                      <p className="flex items-center gap-2 text-base text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Parsing your resume…
                      </p>
                    )}
                    {resumeUi === "stalled" && (
                      <p className="text-base text-warning">
                        Parsing is taking longer than expected. Try uploading again.
                      </p>
                    )}
                    {resumeUi === "failed" && (
                      <p className="text-base text-destructive">
                        Upload failed. Check your file and try again.
                      </p>
                    )}
                  </div>
                ) : null}

                {activeStep === 3 ? (
                  <div className="mt-4 space-y-4">
                    <p className="text-base text-muted-foreground">
                      Connect Gmail so OneTap can send applications from your address. OAuth is
                      recommended; app password is available under Advanced.
                    </p>
                    <EmailStatusCard
                      email={status?.email}
                      onUpdate={() => {
                        clearEmailStepSkipped();
                        markOnboardingExtensionPending();
                        invalidateStatus();
                        trackOnboardingEvent("gmail_setup_clicked");
                      }}
                      oauthReturnTo="onboarding"
                    />
                    <Button type="button" variant="outline" className="w-full" onClick={handleSkipEmail}>
                      Skip for now
                    </Button>
                    <p className="text-center text-xs text-muted-foreground">
                      You can connect Gmail later in Setup when you&apos;re ready to send.
                    </p>
                  </div>
                ) : null}
                </>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
