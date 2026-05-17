/**
 * SPA history fallback: serve index.html for client routes only.
 * Excludes API/auth/health/docs and any path that looks like a static asset (has a file extension).
 */
const SPA_FALLBACK_PATTERN =
  /^\/(?!api|auth|health|docs|openapi\.json|.*\.[a-zA-Z0-9]+$).*/;

const isSpaFallbackRoute = (urlPath) => SPA_FALLBACK_PATTERN.test(urlPath);

module.exports = {
  SPA_FALLBACK_PATTERN,
  isSpaFallbackRoute,
};
