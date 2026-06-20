import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Send, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { api, type ApiError } from "@/lib/api";
import {
  EMAIL_LENGTH_OPTIONS,
  EMAIL_TONE_OPTIONS,
  resolveLengthOption,
  resolveToneOption,
  structureForLengthOption,
  toneForToneOption,
  type LengthOptionId,
  type PresetId,
  type ToneOptionId,
} from "@/lib/emailPreferencePresets";
import { trackPreferencesUpdated } from "@/lib/emailPreferenceEvents";
import {
  upsertOptimisticApplication,
  removeOptimisticApplication,
  refreshApplicationsList,
  markPendingNewApplication,
} from "@/queries/applicationsCache";
import { buildPendingApplicationRow } from "@/lib/applicationRowState";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { LoadingTimer } from "@/components/loading-timer";
import { cn } from "@/lib/utils";

const EMAIL_PREFS_QUERY_KEY = ["email-preferences"] as const;
const PREVIEW_DEBOUNCE_MS = 800;
const PANEL_HEIGHT = "h-[580px]";
const LABEL_ROW = "flex min-h-7 items-center justify-between gap-2";
const SECTION_LABEL = "text-base font-medium";
const PREVIEW_TEXT_PRIMARY = "text-base font-medium text-foreground";
const PREVIEW_TEXT_SECONDARY = "text-base font-normal text-muted-foreground";
const APPLY_BOX_RADIUS = "rounded-sm";

type Props = {
  autoApplyEnabled: boolean;
  canApply: boolean;
  applyDisabledReason: string | null;
};

export function ApplyComposer({ autoApplyEnabled, canApply, applyDisabledReason }: Props) {
  const isAutoMode = autoApplyEnabled;
  const queryClient = useQueryClient();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewRequestRef = useRef(0);
  const autoSubmitJdRef = useRef<string | null>(null);
  const [jdText, setJdText] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [previewJd, setPreviewJd] = useState<string | null>(null);
  const [previewMeta, setPreviewMeta] = useState<{
    jobTitle?: string | null;
    company?: string | null;
    matchScore?: number;
  } | null>(null);
  const [toneOverride, setToneOverride] = useState<number | null>(null);
  const [structureOverride, setStructureOverride] = useState<number | null>(null);
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [emailStyleOpen, setEmailStyleOpen] = useState(true);

  const { data: emailPrefs } = useQuery({
    queryKey: EMAIL_PREFS_QUERY_KEY,
    queryFn: async () => {
      const res = await api.getEmailPreferences();
      return res.data;
    },
  });

  const toneLevel = toneOverride ?? emailPrefs?.emailToneLevel ?? 50;
  const structureLevel = structureOverride ?? emailPrefs?.emailStructureLevel ?? 60;
  const lengthOption = resolveLengthOption(structureLevel);
  const toneOption = resolveToneOption(toneLevel);
  const lengthLabel =
    EMAIL_LENGTH_OPTIONS.find((o) => o.id === lengthOption)?.label ?? "Medium";
  const toneLabel = EMAIL_TONE_OPTIONS.find((o) => o.id === toneOption)?.label ?? "Balanced";

  const patchMutation = useMutation({
    mutationFn: (body: { emailToneLevel: number; emailStructureLevel: number }) =>
      api.patchEmailPreferences(body),
    onSuccess: (res) => {
      queryClient.setQueryData(EMAIL_PREFS_QUERY_KEY, res.data);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to save email style");
    },
  });

  const schedulePatch = useCallback(
    (nextTone: number, nextStructure: number) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        patchMutation.mutate(
          { emailToneLevel: nextTone, emailStructureLevel: nextStructure },
          {
            onSuccess: (res) => {
              trackPreferencesUpdated({
                emailToneLevel: res.data.emailToneLevel,
                emailStructureLevel: res.data.emailStructureLevel,
                selectedPreset: res.data.selectedPreset as PresetId,
              });
            },
          }
        );
      }, 400);
    },
    [patchMutation]
  );

  const handleLengthChange = (id: LengthOptionId) => {
    const nextStructure = structureForLengthOption(id);
    setStructureOverride(nextStructure);
    schedulePatch(toneLevel, nextStructure);
  };

  const handleToneChange = (id: ToneOptionId) => {
    const nextTone = toneForToneOption(id);
    setToneOverride(nextTone);
    schedulePatch(nextTone, structureLevel);
  };

  const trimmedJd = jdText.trim();
  const hasJdContent = trimmedJd.length > 0;
  const hasPreview = previewJd !== null && emailSubject.trim() && emailBody.trim();
  const previewStale = hasJdContent && trimmedJd !== previewJd;
  const busy = generating || sending;
  const showEmailStyle = hasPreview && !isAutoMode;

  useEffect(() => {
    autoSubmitJdRef.current = null;
    if (isAutoMode) {
      setToneOverride(null);
      setStructureOverride(null);
    }
  }, [autoApplyEnabled, isAutoMode]);

  const clearComposer = useCallback(() => {
    setJdText("");
    setEmailSubject("");
    setEmailBody("");
    setPreviewJd(null);
    setPreviewMeta(null);
    autoSubmitJdRef.current = null;
  }, []);

  const submitApplication = useCallback(async (): Promise<boolean> => {
    if (!canApply || generating || sending) return false;

    if (!trimmedJd) {
      toast.error("Paste the job description first.");
      return false;
    }
    if (!hasPreview || previewStale) {
      toast.error("Wait for the email preview to finish updating.");
      return false;
    }

    setSending(true);
    const optimisticId = `pending-${crypto.randomUUID()}`;
    upsertOptimisticApplication(
      queryClient,
      buildPendingApplicationRow({
        id: optimisticId,
        uiStatus: "processing",
        role: previewMeta?.jobTitle ?? null,
        company: previewMeta?.company ?? null,
        matchScore: previewMeta?.matchScore ?? null,
      })
    );

    try {
      const applyRes = await api.autoApply(trimmedJd, {
        emailSubject: emailSubject.trim(),
        emailBody: emailBody.trim(),
      });
      removeOptimisticApplication(queryClient, optimisticId);
      upsertOptimisticApplication(
        queryClient,
        buildPendingApplicationRow({
          id: applyRes.applicationId,
          status: applyRes.status || "draft",
          uiStatus: "processing",
          role: previewMeta?.jobTitle ?? null,
          company: previewMeta?.company ?? null,
          matchScore: previewMeta?.matchScore ?? null,
        })
      );

      if (isAutoMode) {
        toast.success("Application sent. Your email is going out automatically.", {
          description: `Application ${applyRes.applicationId.slice(0, 8)}…`,
        });
      } else {
        toast.success("Application queued. We'll send your email in the background.", {
          description: `Application ${applyRes.applicationId.slice(0, 8)}…`,
        });
      }

      markPendingNewApplication(applyRes.applicationId);
      clearComposer();
      void refreshApplicationsList(queryClient);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Application flow failed";
      const applicationId =
        err instanceof Error && "meta" in err
          ? (err as ApiError).meta?.applicationId as string | undefined
          : undefined;

      removeOptimisticApplication(queryClient, optimisticId);
      if (applicationId) {
        upsertOptimisticApplication(
          queryClient,
          buildPendingApplicationRow({
            id: applicationId,
            uiStatus: "failed",
            status: "failed",
            terminal: true,
            pollable: false,
            canRetry: true,
            lastError: message,
            role: previewMeta?.jobTitle ?? null,
            company: previewMeta?.company ?? null,
            matchScore: previewMeta?.matchScore ?? null,
          })
        );
      } else {
        upsertOptimisticApplication(
          queryClient,
          buildPendingApplicationRow({
            id: optimisticId,
            uiStatus: "failed",
            status: "failed",
            terminal: true,
            pollable: false,
            canRetry: false,
            lastError: message,
            role: previewMeta?.jobTitle ?? null,
            company: previewMeta?.company ?? null,
            matchScore: previewMeta?.matchScore ?? null,
          })
        );
      }
      toast.error(message);
      return false;
    } finally {
      setSending(false);
    }
  }, [
    canApply,
    generating,
    sending,
    trimmedJd,
    hasPreview,
    previewStale,
    emailSubject,
    emailBody,
    previewMeta,
    isAutoMode,
    queryClient,
    clearComposer,
  ]);

  useEffect(() => {
    if (!isAutoMode || !canApply || !hasPreview || previewStale || generating || sending) {
      return;
    }
    if (autoSubmitJdRef.current === trimmedJd) return;

    autoSubmitJdRef.current = trimmedJd;

    void submitApplication();
  }, [
    isAutoMode,
    canApply,
    hasPreview,
    previewStale,
    generating,
    sending,
    trimmedJd,
    submitApplication,
  ]);

  useEffect(() => {
    if (!trimmedJd) {
      setPreviewJd(null);
      setEmailSubject("");
      setEmailBody("");
      setPreviewMeta(null);
      setGenerating(false);
      autoSubmitJdRef.current = null;
      return;
    }

    if (!canApply) return;

    const timer = setTimeout(() => {
      const reqId = ++previewRequestRef.current;
      setGenerating(true);

      void (async () => {
        try {
          const res = await api.previewEmail(trimmedJd);
          if (reqId !== previewRequestRef.current) return;

          setEmailSubject(res.data.subject);
          setEmailBody(res.data.body);
          setPreviewJd(trimmedJd);
          setPreviewMeta({
            jobTitle: res.data.jobTitle,
            company: res.data.company,
            matchScore: res.data.match.score,
          });
        } catch (err) {
          if (reqId !== previewRequestRef.current) return;
          toast.error(err instanceof Error ? err.message : "Failed to generate preview");
        } finally {
          if (reqId === previewRequestRef.current) {
            setGenerating(false);
          }
        }
      })();
    }, PREVIEW_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [trimmedJd, canApply, toneLevel, structureLevel]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitApplication();
  };

  return (
    <form data-tour="apply-composer" onSubmit={handleSend} className="space-y-6">
      <div className="grid w-full grid-cols-1 items-start gap-6 lg:grid-cols-2 lg:gap-8">
        <div className="flex min-w-0 flex-col gap-3">
          <div className={LABEL_ROW}>
            <Label htmlFor="jd-text" className={SECTION_LABEL}>
              Job description
            </Label>
          </div>
          <Textarea
            id="jd-text"
            name="jdText"
            value={jdText}
            onChange={(e) => setJdText(e.target.value)}
            placeholder="Paste the complete job description here..."
            className={cn(
              PANEL_HEIGHT,
              APPLY_BOX_RADIUS,
              "w-full resize-none text-base p-4 focus-visible:ring-ring/12"
            )}
            disabled={busy}
            required
          />
          {isAutoMode && !canApply && applyDisabledReason && (
            <p className={PREVIEW_TEXT_SECONDARY}>{applyDisabledReason}</p>
          )}
        </div>

        {isAutoMode ? (
          <div className="flex min-w-0 flex-col gap-3">
            <div className={LABEL_ROW}>
              <Label className={SECTION_LABEL}>Email preview</Label>
              {hasJdContent && generating && (
                <span className={cn(PREVIEW_TEXT_SECONDARY, "flex items-center gap-1")}>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Preparing…
                </span>
              )}
              {hasJdContent && sending && !generating && (
                <span className={cn(PREVIEW_TEXT_SECONDARY, "flex items-center gap-1")}>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Sending…
                </span>
              )}
            </div>

            <div className={cn(PANEL_HEIGHT, "flex w-full flex-col gap-3 overflow-hidden")}>
              {!hasJdContent ? (
                <div
                  className={cn(
                    "flex h-full flex-col items-center justify-center border border-dashed border-border bg-muted/10 px-6 text-center",
                    APPLY_BOX_RADIUS
                  )}
                >
                  <p className={cn("max-w-sm", PREVIEW_TEXT_SECONDARY)}>
                    Paste a job description. We'll prepare and send your application automatically
                  </p>
                </div>
              ) : (
                <div
                  className={cn(
                    "flex h-full flex-col items-center justify-center border border-dashed border-border bg-muted/50 px-4 py-6",
                    APPLY_BOX_RADIUS
                  )}
                >
                  {generating || !hasPreview ? (
                    <LoadingTimer
                      label="Preparing your application email…"
                      labelShimmer
                      className="max-w-sm"
                    />
                  ) : (
                    <LoadingTimer
                      label="Sending your application automatically…"
                      className="max-w-sm"
                    />
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex min-w-0 flex-col gap-3">
            <div className={LABEL_ROW}>
              <Label htmlFor="email-subject" className={SECTION_LABEL}>
                Email preview
              </Label>
              {hasJdContent && previewMeta?.matchScore != null && !generating && (
                <span className={PREVIEW_TEXT_SECONDARY}>
                  Match {Math.round(previewMeta.matchScore)}%
                </span>
              )}
              {hasJdContent && generating && (
                <span className={cn(PREVIEW_TEXT_SECONDARY, "flex items-center gap-1")}>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Drafting…
                </span>
              )}
            </div>

            <div className={cn(PANEL_HEIGHT, "flex w-full flex-col gap-3 overflow-hidden")}>
              {!hasJdContent ? (
                <div
                  className={cn(
                    "flex h-full flex-col items-center justify-center border border-dashed border-border bg-muted/10 px-6 text-center",
                    APPLY_BOX_RADIUS
                  )}
                >
                  <p className={cn("max-w-sm", PREVIEW_TEXT_SECONDARY)}>
                    Paste a job description to preview the email copy
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
                    {showEmailStyle && (
                      <div
                        className={cn(
                          "overflow-hidden border border-input-border bg-input",
                          APPLY_BOX_RADIUS
                        )}
                      >
                        <button
                          type="button"
                          className="flex w-full items-center justify-between gap-2 p-3 text-left transition-colors hover:bg-black/[0.04]"
                          onClick={() => setEmailStyleOpen((open) => !open)}
                          aria-expanded={emailStyleOpen}
                        >
                          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                            <p className={PREVIEW_TEXT_PRIMARY}>Email style</p>
                            {!emailStyleOpen && (
                              <span
                                className={cn(
                                  PREVIEW_TEXT_SECONDARY,
                                  "transition-opacity duration-150 ease-in"
                                )}
                              >
                                {lengthLabel} · {toneLabel}
                              </span>
                            )}
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            {patchMutation.isPending && (
                              <span className={cn(PREVIEW_TEXT_SECONDARY, "flex items-center gap-1")}>
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                Saving…
                              </span>
                            )}
                            <ChevronDown
                              className={cn(
                                "h-4 w-4 text-muted-foreground transition-transform duration-150 ease-in",
                                emailStyleOpen && "rotate-180"
                              )}
                              aria-hidden
                            />
                          </div>
                        </button>
                        <div
                          className={cn(
                            "grid transition-[grid-template-rows] duration-150 ease-in",
                            emailStyleOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                          )}
                        >
                          <div className="overflow-hidden">
                            <div className="grid grid-cols-2 gap-3 px-3 pb-3 pt-3 mt-3 border-t border-black/[0.06]">
                              <SegmentedControl
                                label="Length"
                                value={lengthOption}
                                options={EMAIL_LENGTH_OPTIONS.map((o) => ({
                                  value: o.id,
                                  label: o.label,
                                }))}
                                onValueChange={handleLengthChange}
                                disabled={busy}
                              />
                              <SegmentedControl
                                label="Tone"
                                value={toneOption}
                                options={EMAIL_TONE_OPTIONS.map((o) => ({
                                  value: o.id,
                                  label: o.label,
                                }))}
                                onValueChange={handleToneChange}
                                disabled={busy}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {generating && !hasPreview ? (
                      <div
                        className={cn(
                          "flex flex-1 min-h-32 flex-col items-center justify-center border border-dashed border-border bg-muted/50 px-4 py-6",
                          APPLY_BOX_RADIUS
                        )}
                      >
                        <LoadingTimer
                          label="Generating your email preview…"
                          labelShimmer
                          className="max-w-sm"
                        />
                      </div>
                    ) : (
                      <div className="flex min-h-0 flex-1 flex-col gap-3">
                        <Input
                          id="email-subject"
                          value={emailSubject}
                          onChange={(e) => setEmailSubject(e.target.value)}
                          placeholder={generating ? "Generating subject…" : "Email subject"}
                          className={cn(APPLY_BOX_RADIUS, "shrink-0")}
                          disabled={busy || generating}
                        />
                        <Textarea
                          id="email-body"
                          value={emailBody}
                          onChange={(e) => setEmailBody(e.target.value)}
                          placeholder={generating ? "Generating email body…" : "Email body"}
                          className={cn(
                            APPLY_BOX_RADIUS,
                            "min-h-0 flex-1 resize-none text-base font-normal leading-relaxed p-4 focus-visible:ring-ring/12 font-sans"
                          )}
                          disabled={busy || generating}
                        />
                      </div>
                    )}

                    {generating && hasPreview && (
                      <LoadingTimer label="Updating your email preview…" />
                    )}
                  </div>

                  <div className="shrink-0 space-y-2">
                    <Button
                      type="submit"
                      size="lg"
                      className={cn("h-12 w-full font-medium", APPLY_BOX_RADIUS)}
                      disabled={!canApply || busy || !hasPreview || previewStale}
                    >
                      {sending ? (
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      ) : (
                        <Send className="mr-2 h-5 w-5" />
                      )}
                      {canApply ? "Send application" : "Complete Setup To Apply"}
                    </Button>

                    {applyDisabledReason && (
                      <p className={PREVIEW_TEXT_SECONDARY}>{applyDisabledReason}</p>
                    )}

                    {sending && <LoadingTimer label="Queuing your application…" />}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </form>
  );
}
