export type ApiError = Error & { status?: number; code?: string };

const getToken = () => localStorage.getItem("ai_apply_token");
const setToken = (token: string | null) => {
  if (token) localStorage.setItem("ai_apply_token", token);
  else localStorage.removeItem("ai_apply_token");
};

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(path, { ...options, headers });
  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = new Error(
      (body as { error?: string }).error || `Request failed (${res.status})`
    ) as ApiError;
    err.status = res.status;
    err.code = (body as { code?: string }).code;
    throw err;
  }

  return body as T;
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
