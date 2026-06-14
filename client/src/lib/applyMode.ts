export type ApplyMode = "auto_apply" | "review_apply";

export const APPLY_MODE_STORAGE_KEY = "onetap:apply-mode";

export function isApplyMode(value: string | null | undefined): value is ApplyMode {
  return value === "auto_apply" || value === "review_apply";
}

export function readStoredAutoApplyEnabled(): boolean {
  if (typeof window === "undefined") return false;
  const stored = window.localStorage.getItem(APPLY_MODE_STORAGE_KEY);
  return stored === "auto_apply";
}

export function storeAutoApplyEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(APPLY_MODE_STORAGE_KEY, enabled ? "auto_apply" : "review_apply");
}

export function applyPageDescription(autoApplyEnabled: boolean): string {
  return autoApplyEnabled
    ? "Paste a job description — we'll draft your email and send it automatically."
    : "Paste a job description, preview your tailored email, and send.";
}

export function toApplyMode(autoApplyEnabled: boolean): ApplyMode {
  return autoApplyEnabled ? "auto_apply" : "review_apply";
}
