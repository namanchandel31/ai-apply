import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useNavigate } from "react-router-dom";

import { CheckCircle2, Loader2 } from "lucide-react";

import { toast } from "sonner";

import { useQueryClient } from "@tanstack/react-query";

import { api, type SetupStatusData } from "@/lib/api";

import { useSetupStatus } from "@/hooks/useSetupStatus";

import { useActivationTracking } from "@/hooks/useActivationTracking";

import { trackOnboardingEvent } from "@/lib/onboardingEvents";

import { markOnboardingWalkthroughPending } from "@/lib/onboardingWalkthrough";

import { computeOnboardingFlow } from "@/lib/onboardingFlow";

import { Button } from "@/components/ui/button";

import { Card, CardContent } from "@/components/ui/card";

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

  markEmailStepSkipped,

  markExtensionPromptDismissed,

} from "@/lib/extensionPrompt";

import { cn } from "@/lib/utils";

import { useAuth } from "@/auth/AuthContext";

import { getDisplayFirstName } from "@/lib/userDisplay";

import { setupStatusQueryOptions } from "@/queries/bootstrapQueries";



type OnboardingStep = { id: number; label: string };



type ResumeUiState = "idle" | "uploading" | "completed" | "failed";



type StepProgressProps = {

  steps: readonly OnboardingStep[];

  activeStep: number;

  completed: boolean[];

};



function OnboardingStepProgress({ steps, activeStep, completed }: StepProgressProps) {

  return (

    <div className="mx-auto flex w-fit items-start justify-center">

      {steps.map((step, index) => {

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

                  "max-w-[4.5rem] text-center text-xs font-medium leading-tight sm:max-w-none sm:whitespace-nowrap",

                  current ? "text-foreground" : done ? "text-success" : "text-muted-foreground"

                )}

              >

                {step.label}

              </span>

            </div>

            {index < steps.length - 1 ? (

              <div

                className={cn(

                  "mx-2 mt-4 h-px w-8 shrink-0 sm:mx-3 sm:w-12",

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



  const [resumeUi, setResumeUi] = useState<ResumeUiState>("idle");

  const [emailSkipped, setEmailSkipped] = useState(false);

  const [extensionDone, setExtensionDone] = useState(() => hasDismissedExtensionPrompt());

  const [celebrating, setCelebrating] = useState(false);
  const [parseStalled, setParseStalled] = useState(false);
  const celebrationStartedRef = useRef(false);

  const uploadStartedAt = useRef<number | null>(null);

  const startedRef = useRef(false);



  const flow = useMemo(

    () =>

      computeOnboardingFlow(status, {

        emailSkipped,

        extensionDone,

      }),

    [status, emailSkipped, extensionDone]

  );



  const canUseManagedAi =

    status?.canUseManagedAi ?? status?.entitlements?.can_use_managed_ai === true;

  const hasResume = !!status?.hasResume;
  const hasValidResume = !!status?.hasValidResume;
  const hasEmailSetup = !!status?.hasEmailSetup;
  const emailStepResolved = hasEmailSetup || emailSkipped || hasEmailStepSkipped();
  const parsingResume = hasResume && !hasValidResume;



  const steps = flow.steps;

  const activeStep = flow.stepIndex;

  const currentStepKind = flow.step;

  const isComplete = flow.complete;

  const completedSteps = [hasResume, emailStepResolved, extensionDone];

  const completedCount = completedSteps.filter(Boolean).length;

  const remainingCount = steps.length - completedCount;

  const finishOnboarding = useCallback(() => {
    clearOnboardingExtensionPending();
    markOnboardingWalkthroughPending();
    trackOnboardingEvent("dashboard_entered");
    navigate("/dashboard", { replace: true });
  }, [navigate]);

  const handleGoToDashboard = useCallback(() => {
    if (!hasEmailSetup && !emailStepResolved) {
      markEmailStepSkipped();
      setEmailSkipped(true);
    }
    markExtensionPromptDismissed();
    setExtensionDone(true);
    trackOnboardingEvent("onboarding_completed");
    finishOnboarding();
  }, [hasEmailSetup, emailStepResolved, finishOnboarding]);



  const beginOnboardingCompletion = useCallback(() => {

    if (celebrationStartedRef.current) return;

    celebrationStartedRef.current = true;

    trackOnboardingEvent("onboarding_completed");

    setCelebrating(true);

  }, []);



  const completeAfterCelebration = useCallback(() => {

    setCelebrating(false);

    finishOnboarding();

  }, [finishOnboarding]);



  useEffect(() => {

    if (!isLoading && isComplete && !celebrating && !celebrationStartedRef.current) {

      beginOnboardingCompletion();

    }

  }, [isLoading, isComplete, celebrating, beginOnboardingCompletion]);



  useEffect(() => {

    if (!user || user.firstName?.trim() || user.fullName?.trim()) return;

    void api.seedProfileFromEmail().then(() => refreshUser());

  }, [user, refreshUser]);



  useEffect(() => {

    if (startedRef.current || (isLoading && !status)) return;

    startedRef.current = true;

    trackOnboardingEvent("onboarding_started");

    void api.seedProfileFromEmail().then(() => refreshUser()).catch(() => {});

  }, [isLoading, refreshUser]);



  useEffect(() => {
    if (hasResume) setResumeUi("completed");
  }, [hasResume]);

  useEffect(() => {
    if (!parsingResume) {
      setParseStalled(false);
      return;
    }

    const uploadedAt = status?.activeResume?.uploadedAt;
    if (!uploadedAt) return;

    const uploaded = new Date(uploadedAt).getTime();
    const tick = setInterval(() => {
      if (Date.now() - uploaded > 90_000) {
        setParseStalled(true);
      }
    }, 5000);

    return () => clearInterval(tick);
  }, [parsingResume, status?.activeResume?.uploadedAt]);



  useEffect(() => {

    if (!isLoading && hasEmailStepSkipped()) {

      setEmailSkipped(true);

    }

  }, [isLoading]);



  useEffect(() => {

    if (hasValidResume && uploadStartedAt.current) {

      trackOnboardingEvent("resume_parsed");

    }

  }, [hasValidResume]);



  useEffect(() => {

    if (!celebrating) return;

    const timer = window.setTimeout(completeAfterCelebration, 2500);

    return () => window.clearTimeout(timer);

  }, [celebrating, completeAfterCelebration]);



  const invalidateStatus = useCallback(() => {

    queryClient.invalidateQueries({ queryKey: setupStatusQueryOptions.queryKey });

    refetch();

  }, [queryClient, refetch]);



  const handleResumeUpload = async (file: File) => {
    setResumeUi("uploading");
    uploadStartedAt.current = Date.now();
    trackOnboardingEvent("resume_uploaded");
    try {
      const res = await api.uploadResume(file, "onboarding");
      setResumeUi("completed");
      toast.success("Resume uploaded - continue to the next step");

      queryClient.setQueryData(setupStatusQueryOptions.queryKey, (old: SetupStatusData | undefined) => {
        if (!old) return old;
        const uploadedAt = new Date().toISOString();
        return {
          ...old,
          hasResume: true,
          activeResume: old.activeResume ?? {
            id: res.data.resumeId ?? "",
            fileHash: "",
            filename: file.name,
            uploadedAt,
          },
        };
      });

      void invalidateStatus();
    } catch (err) {
      setResumeUi("failed");
      toast.error(err instanceof Error ? err.message : "Upload failed");
    }
  };



  const handleSkipEmail = () => {

    trackOnboardingEvent("email_setup_skipped");

    markEmailStepSkipped();

    setEmailSkipped(true);

  };



  const handleExtensionContinue = () => {
    markExtensionPromptDismissed();
    setExtensionDone(true);
    beginOnboardingCompletion();
  };



  const statusLoading = isLoading && !status;

  const welcomeName = user ? getDisplayFirstName(user) : null;

  const currentStepMeta = steps.find((s) => s.id === activeStep);

  const welcomeDescription = statusLoading
    ? "Getting your setup ready…"
    : remainingCount === 0

      ? "Almost ready to apply."

      : currentStepKind === "email"

        ? "Connect Gmail so OneTap can send applications from your address."

        : currentStepKind === "extension"

          ? "Install the Chrome extension to apply from LinkedIn."

          : remainingCount === 1

            ? "One step left, then you can explore OneTap."

            : `${remainingCount} steps left. Finish setup to get started.`;



  if (celebrating) {
    return (

      <div className="min-h-screen bg-background">

        <OnboardingConfetti active onComplete={completeAfterCelebration} />

        <div className="pointer-events-none fixed inset-0 z-[9998] flex items-center justify-center bg-white/75">

          <p className="text-xl font-semibold text-foreground">You&apos;re all set!</p>

        </div>

      </div>

    );

  }



  return (

    <div className="min-h-screen bg-background">

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

            <OnboardingStepProgress

              steps={steps}

              activeStep={activeStep}

              completed={completedSteps}

            />

          </div>



          <Card className="w-full border border-border bg-white shadow-none">

            <CardContent className="p-8">
              {statusLoading ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : activeStep > 0 && currentStepMeta ? (
                <>
                  {parsingResume && currentStepKind !== "resume" ? (
                    <p className="mb-4 flex items-center gap-2 rounded-[10px] bg-muted px-3 py-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                      Still reading your resume in the background - you can keep going.
                    </p>
                  ) : null}

                  {parseStalled && parsingResume ? (
                    <p className="mb-4 text-sm text-warning">
                      Resume parsing is taking longer than expected. You can continue setup; we&apos;ll
                      keep trying in the background.
                    </p>
                  ) : null}

                  {currentStepKind !== "extension" ? (

                    <h2 className="text-base font-medium text-foreground">{currentStepMeta.label}</h2>

                  ) : null}



                  {currentStepKind === "resume" ? (

                    <div className="mt-5 space-y-4">

                      {canUseManagedAi ? (

                        <p className="rounded-[10px] bg-muted px-3 py-2 text-sm text-muted-foreground">

                          You&apos;re on <span className="font-medium text-foreground">OneTap AI</span> - no API

                          key needed. Upload your resume to continue.

                        </p>

                      ) : null}

                      <ResumeDropzone
                        busy={resumeUi === "uploading"}
                        onFile={(file) => void handleResumeUpload(file)}
                      />
                      {resumeUi === "failed" ? (
                        <p className="text-base text-destructive">
                          Upload failed. Check your file and try again.
                        </p>
                      ) : null}

                    </div>

                  ) : null}



                  {currentStepKind === "email" ? (

                    <div className="mt-4 space-y-4">

                      <p className="text-base text-muted-foreground">

                        Connect Gmail so OneTap can send applications from your address. OAuth is

                        recommended; app password is available under Advanced.

                      </p>

                      <EmailStatusCard

                        email={status?.email}

                        onUpdate={() => {

                          clearEmailStepSkipped();

                          setEmailSkipped(false);

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



                  {currentStepKind === "extension" ? (

                    <ExtensionInstallPrompt embedded onContinue={handleExtensionContinue} />

                  ) : null}

                  {hasResume && !isComplete && currentStepKind !== "resume" ? (
                    <div className="mt-6 border-t border-border pt-4">
                      <Button type="button" variant="ghost" className="w-full" onClick={handleGoToDashboard}>
                        Explore dashboard
                      </Button>
                      <p className="mt-2 text-center text-xs text-muted-foreground">
                        Resume parsing continues in the background. You can apply once it&apos;s ready.
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


