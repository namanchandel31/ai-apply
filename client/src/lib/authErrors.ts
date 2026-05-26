export type AuthErrorContext = {
  status: number;
  code?: string;
};

/** API response codes that must not trigger session teardown. */
const NON_LOGOUT_AUTH_CODES = new Set([
  "EMAIL_NOT_VERIFIED",
  "LEGACY_USER_PENDING_MANUAL_LINK",
  "LEGACY_USER_AMBIGUOUS_EMAIL",
]);

const SESSION_INVALID_CODES = new Set([
  "UNAUTHORIZED",
  "TOKEN_EXPIRED",
  "INVALID_TOKEN",
  "INVALID_ISSUER",
  "INVALID_AUDIENCE",
  "MALFORMED_AUTH_HEADER",
]);

/** Missing bearer on request — often race before hydration; do not always force logout. */
const SOFT_AUTH_CODES = new Set(["MISSING_AUTH_HEADER", "MISSING_AUTH_TOKEN"]);

export function parseApiErrorCode(body: Record<string, unknown>): string | undefined {
  const top = body.code;
  if (typeof top === "string" && top) return top;
  const err = body.error;
  if (typeof err === "object" && err !== null && typeof (err as { code?: string }).code === "string") {
    return (err as { code: string }).code;
  }
  return undefined;
}

export function shouldForceLogout({ status, code }: AuthErrorContext): boolean {
  if (status >= 500) return false;
  if (status === 403) return false;
  if (code && NON_LOGOUT_AUTH_CODES.has(code)) return false;
  if (status === 401) {
    if (code && SOFT_AUTH_CODES.has(code)) return false;
    if (code && SESSION_INVALID_CODES.has(code)) return true;
    if (!code) return true;
    return !NON_LOGOUT_AUTH_CODES.has(code);
  }
  return false;
}

export function shouldRetryAfterAuthError({ status, code }: AuthErrorContext): boolean {
  if (status >= 500) return true;
  if (code === "TOKEN_EXPIRED") return true;
  return false;
}

export function isLegacyMigrationBlocked({ status, code }: AuthErrorContext): boolean {
  return (
    status === 403 &&
    (code === "LEGACY_USER_PENDING_MANUAL_LINK" || code === "LEGACY_USER_AMBIGUOUS_EMAIL")
  );
}
