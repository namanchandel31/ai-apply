export type ApiError = Error & {
  status?: number;
  code?: string;
  retryable?: boolean;
  retryAfterMs?: number;
};

export type RequestOptions = RequestInit & {
  signal?: AbortSignal;
};

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

const getToken = () => localStorage.getItem("ai_apply_token");
const setToken = (token: string | null) => {
  if (token) localStorage.setItem("ai_apply_token", token);
  else localStorage.removeItem("ai_apply_token");
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(path, { ...options, headers });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;

  if (!res.ok) {
    const e = (body as { error?: string | { code?: string; message?: string; retryable?: boolean } }).error;
    let message: string;
    let code: string | undefined;
    let retryable: boolean | undefined;

    if (typeof e === "object" && e !== null) {
      message = e.message ?? "Request failed";
      code = e.code;
      retryable = e.retryable;
    } else if (ENABLE_LEGACY_ERROR_COMPAT && typeof e === "string") {
      message = e;
      code = (body as { code?: string }).code;
    } else {
      message = (body as { message?: string }).message ?? `Request failed (${res.status})`;
      if (ENABLE_LEGACY_ERROR_COMPAT) {
        code = (body as { code?: string }).code;
      }
    }

    const err = new Error(message) as ApiError;
    err.status = res.status;
    err.code = code;
    err.retryable = retryable;
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
  const headers = new Headers();
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (options?.ifNoneMatch) {
    headers.set("If-None-Match", options.ifNoneMatch);
  }

  const res = await fetch(`/api/applications/${applicationId}/status`, {
    method: "GET",
    headers,
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
    const e = (body as { error?: string | { code?: string; message?: string; retryable?: boolean } }).error;
    let message: string;
    let code: string | undefined;
    let retryable: boolean | undefined;

    if (typeof e === "object" && e !== null) {
      message = e.message ?? "Request failed";
      code = e.code;
      retryable = e.retryable;
    } else if (ENABLE_LEGACY_ERROR_COMPAT && typeof e === "string") {
      message = e;
      code = (body as { code?: string }).code;
    } else {
      message = (body as { message?: string }).message ?? `Request failed (${res.status})`;
      if (ENABLE_LEGACY_ERROR_COMPAT) {
        code = (body as { code?: string }).code;
      }
    }

    const err = new Error(message) as ApiError;
    err.status = res.status;
    err.code = code;
    err.retryable = retryable;
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

export const api = {
  getToken,
  setToken,

  signup(email: string, password: string) {
    return request<{ success: boolean; data: { user: { id: string; email: string } } }>(
      "/auth/signup",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      }
    );
  },

  login(email: string, password: string) {
    return request<{
      success: boolean;
      data: { token: string; user: { id: string; email: string } };
    }>("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
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

  getApplications() {
    return request<{
      success: boolean;
      data: ApplicationRecord[];
    }>("/api/applications", { method: "GET" });
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
  createdAt: string;
  sentAt?: string | null;
  role?: string | null;
  company?: string | null;
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
  company_name?: string;
  contact_email?: string;
  skills?: string[];
};
