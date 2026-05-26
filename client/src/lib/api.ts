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
} {
  const e = (body as { error?: string | { code?: string; message?: string; retryable?: boolean } }).error;
  if (typeof e === "object" && e !== null) {
    return {
      message: e.message ?? "Request failed",
      code: e.code ?? parseApiErrorCode(body),
      retryable: e.retryable,
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
    const { message, code, retryable } = parseApiErrorBody(body);
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
    const { message, code, retryable } = parseApiErrorBody(body);
    const authCtx: AuthErrorContext = { status: res.status, code };

    if (res.status === 401 || res.status === 403) {
      dispatchAuthFailure(authCtx);
    }

    const err = new Error(message) as ApiError;
    err.status = res.status;
    err.code = code;
    err.retryable = retryable ?? shouldRetryAfterAuthError(authCtx);
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

export type UserMe = {
  id: string;
  email: string;
  fullName?: string | null;
  avatarUrl?: string | null;
  subscriptionTier: string;
  flags: Record<string, unknown>;
  createdAt: string;
};

export const api = {
  setUnauthorizedHandler,

  getMe() {
    return request<{ success: boolean; data: UserMe }>("/api/user/me");
  },

  saveCredentials(email: string, appPassword: string) {
    return request("/api/save-email-credentials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, appPassword }),
    });
  },

  uploadResume(file: File) {
    const form = new FormData();
    form.append("resume", file);
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

  autoApply(jobDescription: string) {
    return request<{
      success: boolean;
      applicationId: string;
      status: string;
      jobId?: string;
    }>("/api/auto-apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobDescription }),
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

  getSetupStatus() {
    return request<{
      success: boolean;
      data: {
        hasResume: boolean;
        hasValidResume?: boolean;
        hasEmailSetup: boolean;
        hasAiSetup?: boolean;
        activeResume?: { id: string; filename: string; uploadedAt: string; fileHash: string } | null;
        email?: string | null;
        activeAiProvider?: {
          id?: string;
          provider: string;
          selectedModel?: string | null;
          label?: string | null;
          providerType?: string;
          allowPlatformFallback?: boolean;
          healthStatus?: string;
          inFallbackChain?: boolean;
          priority?: number;
        } | null;
        aiCredentialChain?: AiCredentialSummary[];
      };
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
  reviewReason?: string | null;
  version?: number;
  orchestrationEpoch?: number;
  updatedAt?: string;
  role?: string | null;
  company?: string | null;
  matchScore?: number | null;
  jdEnrichment?: JdEnrichmentState;
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

export type ApplicationRecord = {
  id: string;
  status: string;
  uiStatus?: string;
  terminal?: boolean;
  executionTerminal?: boolean;
  pollable?: boolean;
  canRetry?: boolean;
  canContinue?: boolean;
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
