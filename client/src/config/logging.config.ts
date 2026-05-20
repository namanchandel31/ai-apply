const ALLOWLIST = new Set(["orchestration", "query", "llm"]);

function parseScopes(raw: string | undefined): Set<string> {
  const valid = new Set<string>();
  if (!raw) return valid;
  for (const part of raw.split(",")) {
    const s = part.trim().toLowerCase();
    if (ALLOWLIST.has(s)) valid.add(s);
  }
  return valid;
}

const debugScopes = parseScopes(import.meta.env.VITE_DEBUG as string | undefined);

function hasDebugScope(scope: string): boolean {
  if (debugScopes.has(scope)) return true;
  return false;
}

function isOrchestrationDebugEnabled(_component?: string): boolean {
  return hasDebugScope("orchestration");
}

export default {
  debugScopes,
  hasDebugScope,
  isOrchestrationDebugEnabled,
};
