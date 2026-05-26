/**
 * SPA history fallback: serve index.html for client routes only.
 * Excludes API/health/docs and any path that looks like a static asset (has a file extension).
 * OAuth callback (/auth/callback) is frontend-only — no backend /auth routes.
 */
const SPA_FALLBACK_PATTERN =
  /^\/(?!api|health|docs|openapi\.json|.*\.[a-zA-Z0-9]+$).*/;

const isSpaFallbackRoute = (urlPath) => SPA_FALLBACK_PATTERN.test(urlPath);

module.exports = {
  SPA_FALLBACK_PATTERN,
  isSpaFallbackRoute,
};
