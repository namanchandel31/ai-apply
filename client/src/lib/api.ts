import { buildApplicationsListQueryString } from "@/lib/normalizeApplicationsListParams";
import {
  parseApiErrorCode,
  shouldRetryAfterAuthError,
  type AuthErrorContext,
} from "@/lib/authErrors";
import { apiUrl } from "@/lib/apiBase";
import { buildAuthorizedHeaders, logAuthRequest } from "@/lib/authRequest";
import { supabase } from "@/lib/supabaseClient";

export type ApiError = Error & {
  status?: number;
  code?: string;
  retryable?: boolean;
  retryAfterMs?: number;
  meta?: Record<string, unknown>;
};

export type RequestOptions = RequestInit & {
  signal?: AbortSignal;
  /** @internal single retry after session refresh */
  _authRetried?: boolean;
};

export type AuthFailureHandler = (ctx: AuthErrorContext) => void;

function parseRetryAfterMs(res: Response, body: Record<string, unknown>): number | undefined {
  const header = res.headers.get("Retry-After");
  if (header) {
    const seconds = Number(header);
    if (Number.isFinite(seconds) && seconds >= 0) {
      return Math.ceil(seconds * 1000);
    }
  }
  const fromBody =
    (body as { retryAfterSeconds?: number }).retryAfterSeconds ??
    (body as { retryAfter?: number }).retryAfter;
  if (typeof fromBody === "number" && Number.isFinite(fromBody) && fromBody >= 0) {
    return Math.ceil(fromBody * 1000);
  }
  return undefined;
}

/**
 * TODO(vNext-error-cleanup):
 * Remove legacy flat error parsing after all lifecycle endpoints
 * fully migrate to nested sendError() shape.
 *
 * Legacy supported temporarily:
 * - body.error as string
 * - body.code at top level
 *
 * Rollout checklist:
 * - [x] autoApplyController uses sendError
 * - [x] applicationController retry/continue/cancel/status use sendError
 * - [x] sendController / applyController / jdController migrated
 * - [x] global middleware uses nested shape
 * - [ ] flip flag + remove legacy parsing
 */
const ENABLE_LEGACY_ERROR_COMPAT = true;

let unauthorizedHandler: AuthFailureHandler | null = null;
let authFailureHandler: AuthFailureHandler | null = null;

export function setAuthFailureHandler(handler: AuthFailureHandler | null): void {
  authFailureHandler = handler;
}

export function notifyAuthFailure(ctx: AuthErrorContext): void {
  const handler = authFailureHandler ?? unauthorizedHandler;
  handler?.(ctx);
}

export function setUnauthorizedHandler(handler: AuthFailureHandler | null): void {
  unauthorizedHandler = handler;
}

function parseApiErrorBody(body: Record<string, unknown>): {
  message: string;
  code?: string;
  retryable?: boolean;
  meta?: Record<string, unknown>;
} {
  const e = (body as { error?: string | { code?: string; message?: string; retryable?: boolean; meta?: Record<string, unknown> } }).error;
  if (typeof e === "object" && e !== null) {
    return {
      message: e.message ?? "Request failed",
      code: e.code ?? parseApiErrorCode(body),
      retryable: e.retryable,
      meta: e.meta,
    };
  }
  if (ENABLE_LEGACY_ERROR_COMPAT && typeof e === "string") {
    return {
      message: e,
      code: parseApiErrorCode(body),
    };
  }
  return {
    message: (body as { message?: string }).message ?? "Request failed",
    code: ENABLE_LEGACY_ERROR_COMPAT ? parseApiErrorCode(body) : undefined,
  };
}

function dispatchAuthFailure(ctx: AuthErrorContext): void {
  const handler = authFailureHandler ?? unauthorizedHandler;
  handler?.(ctx);
}

async function tryRefreshSupabaseSession(): Promise<boolean> {
  const { data, error } = await supabase.auth.refreshSession();
  return !error && Boolean(data.session?.access_token);
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { headers, hasToken } = await buildAuthorizedHeaders(options.headers);
  logAuthRequest(path, hasToken);

  const res = await fetch(apiUrl(path), {
    ...options,
    headers,
    mode: "cors",
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;

  if (!res.ok) {
    const { message, code, retryable, meta } = parseApiErrorBody(body);
    const authCtx: AuthErrorContext = { status: res.status, code };

    if (
      !options._authRetried &&
      res.status === 401 &&
      (code === "TOKEN_EXPIRED" ||
        code === "MISSING_AUTH_HEADER" ||
        code === "MISSING_AUTH_TOKEN") &&
      (await tryRefreshSupabaseSession())
    ) {
      return request<T>(path, { ...options, _authRetried: true });
    }

    if (res.status === 401 || res.status === 403) {
      dispatchAuthFailure(authCtx);
    }

    const err = new Error(message) as ApiError;
    err.status = res.status;
    err.code = code;
    err.retryable = retryable ?? shouldRetryAfterAuthError(authCtx);
    if (meta) err.meta = meta;
    if (res.status === 429) {
      err.retryAfterMs = parseRetryAfterMs(res, body) ?? 60_000;
    }
    throw err;
  }

  return body as T;
}

export type ApplicationStatusResponse =
  | { notModified: true; etag: string }
  | { notModified: false; data: ApplicationStatusPayload; etag?: string };

async function requestApplicationStatus(
  applicationId: string,
  options?: { signal?: AbortSignal; ifNoneMatch?: string }
): Promise<ApplicationStatusResponse> {
  const path = `/api/applications/${applicationId}/status`;
  const { headers, hasToken } = await buildAuthorizedHeaders();
  logAuthRequest(path, hasToken);
  if (options?.ifNoneMatch) {
    headers.set("If-None-Match", options.ifNoneMatch);
  }

  const res = await fetch(apiUrl(path), {
    method: "GET",
    headers,
    mode: "cors",
    signal: options?.signal,
  });

  if (res.status === 304) {
    return {
      notModified: true,
      etag: res.headers.get("ETag") ?? options?.ifNoneMatch ?? "",
    };
  }

  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;

  if (!res.ok) {
    const { message, code, retryable, meta } = parseApiErrorBody(body);
    const authCtx: AuthErrorContext = { status: res.status, code };

    if (res.status === 401 || res.status === 403) {
      dispatchAuthFailure(authCtx);
    }

    const err = new Error(message) as ApiError;
    err.status = res.status;
    err.code = code;
    err.retryable = retryable ?? shouldRetryAfterAuthError(authCtx);
    if (meta) err.meta = meta;
    if (res.status === 429) {
      err.retryAfterMs = parseRetryAfterMs(res, body) ?? 60_000;
    }
    throw err;
  }

  const data = (body as { data: ApplicationStatusPayload }).data;
  return {
    notModified: false,
    data,
    etag: res.headers.get("ETag") ?? undefined,
  };
}

export type EmailPreferencesData = {
  emailToneLevel: number;
  emailStructureLevel: number;
  selectedPreset: string;
  toneProfile: string;
  structureMode: string;
};

export type SetupStatusData = {
  hasResume: boolean;
  hasValidResume?: boolean;
  hasEmailSetup: boolean;
  hasAiSetup?: boolean;
  hasVerifiedAiCredential?: boolean;
  hasValidUserAiCredential?: boolean;
  credentialLastValidatedAt?: string | null;
  onboardingRequired?: boolean;
  currentOnboardingStep?: "ai" | "resume" | "ready";
  activeResume?: { id: string; filename: string; uploadedAt: string; fileHash: string } | null;
  email?: string | null;
  activeAiProvider?: AiCredentialSummary | null;
  aiCredentialChain?: AiCredentialSummary[];
};

export type UserMe = {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
  avatarUrl?: string | null;
  applyMode?: "auto_apply" | "review_apply";
  subscriptionTier: string;
  isAdmin?: boolean;
  flags: Record<string, unknown>;
  createdAt: string;
};

export type ExtensionDetectionConfig = {
  hiringKeywords: string[];
  applyKeywords: string[];
  blockedEmailPrefixes: string[];
  scoreEmail: number;
  scoreHiringKeyword: number;
  scoreApplyKeyword: number;
  threshold: number;
  updatedAt?: string | null;
};

export type ExtensionDetectionConfigPatch = Partial<
  Omit<ExtensionDetectionConfig, "updatedAt">
>;

export const api = {
  setUnauthorizedHandler,

  getMe() {
    return request<{ success: boolean; data: UserMe }>("/api/user/me");
  },

  patchApplyMode(applyMode: "auto_apply" | "review_apply") {
    return request<{ success: boolean; data: UserMe }>("/api/user/apply-mode", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ applyMode }),
    });
  },

  postExtensionConnectInit(body: {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
    apiBase?: string;
  }) {
    return request<{
      success: boolean;
      data: { connectToken: string; expiresIn: number };
    }>("/api/extension/connect/init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  },

  getExtensionDetectionConfig() {
    return request<{ success: boolean; data: ExtensionDetectionConfig }>(
      "/api/extension/detection-config",
      { method: "GET" }
    );
  },

  updateExtensionDetectionConfig(body: ExtensionDetectionConfigPatch) {
    return request<{ success: boolean; data: ExtensionDetectionConfig }>(
      "/api/admin/extension-detection-config",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );
  },

  patchProfile(body: { firstName?: string; lastName?: string }) {
    return request<{ success: boolean; data: UserMe }>("/api/user/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  },

  seedProfileFromEmail() {
    return request<{ success: boolean; data: UserMe }>("/api/user/profile/seed-from-email", {
      method: "POST",
    });
  },

  saveCredentials(email: string, appPassword: string) {
    return request("/api/save-email-credentials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, appPassword }),
    });
  },

  uploadResume(file: File, context: "onboarding" | "profile_update" = "profile_update") {
    const form = new FormData();
    form.append("resume", file);
    form.append("context", context);
    return request<{
      success: boolean;
      data: {
        resumeId: string;
        data: ParsedResume;
        message?: string;
      };
    }>("/api/upload-resume", { method: "POST", body: form });
  },

  uploadJD(text: string, title?: string) {
    return request<{
      success: boolean;
      data: {
        jobDescriptionId: string;
        data: ParsedJD;
        message?: string;
      };
    }>("/api/upload-jd", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, title: title || undefined }),
    });
  },

  previewEmail(jobDescription: string) {
    return request<{
      success: boolean;
      data: {
        subject: string;
        body: string;
        match: { score: number; matchedSkills: string[]; missingSkills: string[] };
        jobTitle?: string | null;
        company?: string | null;
        contactEmail?: string | null;
      };
    }>("/api/preview-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobDescription }),
    });
  },

  autoApply(
    jobDescription: string,
    options?: { emailSubject?: string; emailBody?: string; resumeId?: string }
  ) {
    return request<{
      success: boolean;
      applicationId: string;
      status: string;
      jobId?: string;
    }>("/api/auto-apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jobDescription,
        ...(options?.emailSubject ? { emailSubject: options.emailSubject } : {}),
        ...(options?.emailBody ? { emailBody: options.emailBody } : {}),
        ...(options?.resumeId ? { resumeId: options.resumeId } : {}),
      }),
    });
  },

  apply(resumeId: string, jobDescriptionId: string) {
    return request<{
      success: boolean;
      idempotent?: boolean;
      data: {
        applicationId: string;
        match: { score: number; matchedSkills: string[]; missingSkills: string[] };
        email: { subject: string; body: string };
      };
    }>("/api/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resumeId, jobDescriptionId }),
    });
  },

  send(applicationId: string, recipientEmail?: string) {
    return request<{
      success: boolean;
      data: { status: string; message?: string; messageId?: string };
    }>(`/api/send-application/${applicationId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(recipientEmail ? { recipientEmail } : {}),
    });
  },

  patchApplicationEmail(
    applicationId: string,
    body: { emailSubject: string; emailBody: string }
  ) {
    return request<{ success: boolean; data: ApplicationDetailRecord }>(
      `/api/applications/${applicationId}/email`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );
  },

  patchApplicationCompany(applicationId: string, body: { companyName: string }) {
    return request<{ success: boolean; data: ApplicationDetailRecord }>(
      `/api/applications/${applicationId}/company`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );
  },

  getEmailPreferences() {
    return request<{ success: boolean; data: EmailPreferencesData }>(
      "/api/user/email-preferences",
      { method: "GET" }
    );
  },

  patchEmailPreferences(body: { emailToneLevel?: number; emailStructureLevel?: number }) {
    return request<{ success: boolean; data: EmailPreferencesData }>(
      "/api/user/email-preferences",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );
  },

  getSetupStatus() {
    return request<{
      success: boolean;
      data: SetupStatusData;
    }>("/api/user/setup-status", { method: "GET" });
  },

  getAiProviders() {
    return request<{
      success: boolean;
      data: { providers: Array<{ id: string; providerType: string; capabilities: Record<string, boolean> }> };
    }>("/api/ai/providers", { method: "GET" });
  },

  listAiCredentials() {
    return request<{ success: boolean; data: AiCredentialSummary[] }>("/api/ai/credentials", {
      method: "GET",
    });
  },

  reorderAiCredentialChain(orderedIds: string[]) {
    return request<{ success: boolean; data: { credentials: AiCredentialSummary[] } }>(
      "/api/ai/credentials/chain",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds }),
      }
    );
  },

  patchAiCredential(
    id: string,
    body: { inFallbackChain?: boolean; label?: string; selectedModel?: string }
  ) {
    return request(`/api/ai/credentials/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  },

  healthCheckAiCredential(id: string) {
    return request<{ success: boolean; data: { ok: boolean; error?: string } }>(
      `/api/ai/credentials/${id}/health-check`,
      { method: "POST" }
    );
  },

  saveAiCredential(body: {
    provider: string;
    apiKey?: string;
    selectedModel?: string;
    baseUrl?: string;
    label?: string;
    allowPlatformFallback?: boolean;
    providerType?: string;
    role?: "primary" | "backup";
  }) {
    return request<{ success: boolean; data: unknown }>("/api/ai/credentials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  },

  testAiCredential(body: {
    provider: string;
    apiKey?: string;
    selectedModel?: string;
    baseUrl?: string;
    providerType?: string;
  }) {
    return request<{ success: boolean; data: { ok: boolean; error?: string } }>("/api/ai/credentials/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  },

  activateAiCredential(id: string) {
    return request(`/api/ai/credentials/${id}/activate`, { method: "POST" });
  },

  deleteAiCredential(id: string) {
    return request(`/api/ai/credentials/${id}`, { method: "DELETE" });
  },

  getCuratedAiModels(provider?: string) {
    const qs = provider ? `?provider=${encodeURIComponent(provider)}` : "";
    return request<{
      success: boolean;
      data: { models: Array<{ provider: string; modelId: string; displayName: string }> };
    }>(`/api/ai/curated-models${qs}`, { method: "GET" });
  },

  runModelCertification(body: {
    provider: string;
    model: string;
    apiKey: string;
    resumeSource: "active" | "upload";
    resumeFile?: File;
  }) {
    const form = new FormData();
    form.append("provider", body.provider);
    form.append("model", body.model);
    form.append("apiKey", body.apiKey);
    form.append("resumeSource", body.resumeSource);
    if (body.resumeFile) form.append("resume", body.resumeFile);
    return request<{ success: boolean; data: ModelCertificationResult }>(
      "/api/dev/model-certification/run",
      { method: "POST", body: form }
    );
  },

  listModelCertificationRuns() {
    return request<{ success: boolean; data: { runs: ModelCertificationRunSummary[] } }>(
      "/api/dev/model-certification/runs",
      { method: "GET" }
    );
  },

  listCuratedModelsAdmin() {
    return request<{ success: boolean; data: { models: CuratedAiModelRow[] } }>(
      "/api/dev/model-certification/curated",
      { method: "GET" }
    );
  },

  promoteCuratedModel(certificationRunId: string, displayName?: string) {
    return request("/api/dev/model-certification/curated/promote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ certificationRunId, displayName }),
    });
  },

  patchCuratedModel(id: string, body: { isActive?: boolean; sortOrder?: number }) {
    return request(`/api/dev/model-certification/curated/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  },

  deactivateCuratedModel(id: string) {
    return request(`/api/dev/model-certification/curated/${id}`, { method: "DELETE" });
  },

  getApplicationsList(params: ApplicationsListParams, options?: { signal?: AbortSignal }) {
    const qs = buildApplicationsListQueryString(params);
    const path = qs ? `/api/applications?${qs}` : "/api/applications";
    return request<{
      success: boolean;
      data: ApplicationsListResponse;
    }>(path, { method: "GET", signal: options?.signal });
  },

  getApplication(applicationId: string, options?: { signal?: AbortSignal }) {
    return request<{
      success: boolean;
      data: ApplicationDetailRecord;
    }>(`/api/applications/${applicationId}`, { method: "GET", signal: options?.signal });
  },

  getOrchestrationActive() {
    return request<{
      success: boolean;
      data: {
        states: Array<{
          applicationId: string;
          version: number;
          orchestrationEpoch: number;
          updatedAt: string;
          terminal: boolean;
          pollable: boolean;
          uiStatus: string;
          status: string;
        }>;
      };
    }>("/api/orchestration/active", { method: "GET" });
  },

  getApplicationStatus(
    applicationId: string,
    options?: { signal?: AbortSignal; ifNoneMatch?: string }
  ): Promise<ApplicationStatusResponse> {
    return requestApplicationStatus(applicationId, options);
  },

  retryApplication(applicationId: string) {
    return request<{ success: boolean; data: { applicationId: string; status: string; jobId?: string } }>(
      `/api/applications/${applicationId}/retry`,
      { method: "POST" }
    );
  },

  continueApplication(applicationId: string, contactEmail: string) {
    return request<{ success: boolean; data: { applicationId: string; status: string; jobId?: string } }>(
      `/api/applications/${applicationId}/continue`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactEmail }),
      }
    );
  },

  getTrackerStatuses() {
    return request<{
      success: boolean;
      data: {
        options: Array<{
          id: string;
          name: string;
          color: string;
          stage?: number | null;
          system?: boolean;
        }>;
      };
    }>("/api/user/tracker-statuses", { method: "GET" });
  },

  createTrackerStatus(name: string, color?: string) {
    return request<{
      success: boolean;
      data: {
        option: {
          id: string;
          name: string;
          color: string;
          stage?: number | null;
          system?: boolean;
        };
      };
    }>("/api/user/tracker-statuses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, ...(color ? { color } : {}) }),
    });
  },

  deleteTrackerStatus(statusId: string) {
    return request<{
      success: boolean;
      data: { id: string; name: string };
    }>(`/api/user/tracker-statuses/${encodeURIComponent(statusId)}`, {
      method: "DELETE",
    });
  },

  patchApplicationTrackerStatus(applicationId: string, trackerStatusId: string | null) {
    return request<{
      success: boolean;
      data: { trackerStatusId: string | null };
    }>(`/api/applications/${applicationId}/tracker-status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trackerStatusId }),
    });
  },

  bulkSetApplicationTrackerStatus(applicationIds: string[], trackerStatusId: string | null) {
    return request<{
      success: boolean;
      data: { updatedCount: number; trackerStatusId: string | null };
    }>("/api/applications/bulk/tracker-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ applicationIds, trackerStatusId }),
    });
  },

  bulkDeleteApplications(applicationIds: string[]) {
    return request<{
      success: boolean;
      data: { deletedCount: number; deletedIds: string[] };
    }>("/api/applications/bulk/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ applicationIds }),
    });
  },

  getTrackerStatusSummary() {
    return request<{
      success: boolean;
      data: TrackerStatusSummary;
    }>("/api/applications/tracker-status-summary", { method: "GET" });
  },
};

export type JdEnrichmentState = "pending" | "complete";

export type ApplicationStatusPayload = {
  applicationId: string;
  status: string;
  uiStatus: string;
  terminal: boolean;
  executionTerminal?: boolean;
  pollable: boolean;
  canRetry: boolean;
  canContinue: boolean;
  canSend?: boolean;
  reviewReason?: string | null;
  version?: number;
  orchestrationEpoch?: number;
  updatedAt?: string;
  role?: string | null;
  company?: string | null;
  matchScore?: number | null;
  jdEnrichment?: JdEnrichmentState;
  trackerStatusId?: string | null;
};

export type ApplicationsListSortField =
  | "created_at"
  | "updated_at"
  | "match_score"
  | "normalized_company_name"
  | "application_status";

export type ApplicationsListParams = {
  page: number;
  pageSize: number;
  sort?: ApplicationsListSortField;
  order?: "asc" | "desc";
  status?: string[];
  datePreset?: "today" | "last7" | "last30" | "custom";
  dateFrom?: string;
  dateTo?: string;
  q?: string;
};

export type ApplicationsListResponse = {
  items: ApplicationRecord[];
  totalItems: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
};

export type TrackerStatusSummaryBucket = {
  statusId: string | null;
  name: string;
  color: string;
  count: number;
  system?: boolean;
  stage?: number | null;
};

export type TrackerStatusFunnelStage = {
  statusId: string;
  name: string;
  color: string;
  stage: number;
  cumulativeCount: number;
  currentCount: number;
};

export type TrackerStatusSummary = {
  total: number;
  buckets: TrackerStatusSummaryBucket[];
  funnel: TrackerStatusFunnelStage[];
  sideBuckets: TrackerStatusSummaryBucket[];
};

export type ApplicationRecord = {
  id: string;
  status: string;
  uiStatus?: string;
  terminal?: boolean;
  executionTerminal?: boolean;
  pollable?: boolean;
  canRetry?: boolean;
  canContinue?: boolean;
  canSend?: boolean;
  reviewReason?: string | null;
  lastError?: string | null;
  retryCount?: number;
  createdAt: string;
  updatedAt?: string;
  sentAt?: string | null;
  completedAt?: string | null;
  role?: string | null;
  company?: string | null;
  matchScore?: number | null;
  normalizedCompanyName?: string | null;
  normalizedJobTitle?: string | null;
  jdEnrichment?: JdEnrichmentState;
  trackerStatusId?: string | null;
};

export type ApplicationEventRecord = {
  id: string;
  eventType: string;
  actorType: string;
  actorId?: string | null;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

export type ApplicationDetailRecord = ApplicationRecord & {
  matchScore?: number | null;
  emailSubject?: string | null;
  emailBody?: string | null;
  error?: unknown;
  llmRawOutput?: string | null;
  llmRawOutputTruncated?: boolean;
  smtpMessageId?: string | null;
  providerMessageId?: string | null;
  orchestrationVersion?: number;
  orchestrationEpoch?: number;
  processingAttempts?: number | null;
  failureStage?: string | null;
  recipientEmail?: string | null;
  parsedJdSnapshot?: unknown;
  parsedResumeSnapshot?: unknown;
  emailMetadata?: unknown;
  emailFeedbackSignals?: unknown;
  failedAt?: string | null;
  events?: ApplicationEventRecord[];
};

export type AiCredentialSummary = {
  id: string;
  provider: string;
  selectedModel?: string | null;
  label?: string | null;
  providerType?: string;
  allowPlatformFallback?: boolean;
  priority: number;
  healthStatus?: string;
  inFallbackChain?: boolean;
  hasApiKey?: boolean;
};

export type ModelCertificationResult = {
  runId: string;
  provider: string;
  model: string;
  resumeScore: number;
  emailScore: number;
  certificationScore: number;
  reliabilityScore: number;
  judgeConfidence: number;
  valueScore: number;
  overallScore: number;
  passed: boolean;
  recommended: boolean;
  totalCostUsd: number;
  costPer100Runs: number;
  costPer1000Runs: number;
  totalLatencyMs: number;
  scores: Record<string, unknown>;
};

export type ModelCertificationRunSummary = {
  id: string;
  provider: string;
  model: string;
  resume_source?: string;
  certification_score: number;
  reliability_score: number;
  value_score: number;
  overall_score: number;
  passed: boolean;
  recommended: boolean;
  scores_json?: Record<string, unknown>;
  error_message?: string | null;
  created_at: string;
};

export type CuratedAiModelRow = {
  id: string;
  provider: string;
  model_id: string;
  display_name: string;
  certification_score: number;
  reliability_score: number;
  overall_score: number;
  is_active: boolean;
  sort_order: number;
};

export type ParsedResume = {
  name?: string;
  skills?: string[];
};

export type ParsedJD = {
  job_title?: string;
  roles?: string[];
  company_name?: string;
  contact_email?: string;
  skills?: string[];
  parseOutcome?: string;
  parseConfidence?: number;
};
