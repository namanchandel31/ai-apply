/**
 * Backend API origin for production (Vercel). Leave unset in local dev to use
 * relative `/api/*` paths and the Vite dev-server proxy.
 */
const raw = import.meta.env.VITE_API_URL as string | undefined;

export const API_BASE_URL = raw?.replace(/\/$/, "") ?? "";

/** Resolve an API path (must start with `/api`). */
export function apiUrl(path: string): string {
  if (!path.startsWith("/")) {
    return `${API_BASE_URL}/${path}`;
  }
  return `${API_BASE_URL}${path}`;
}
