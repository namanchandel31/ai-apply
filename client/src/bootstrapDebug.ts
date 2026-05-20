/** Lightweight bootstrap diagnostics (console only). */

export function installBootstrapDiagnostics() {
  if (import.meta.env.PROD) return;

  console.info("[bootstrap] starting", {
    mode: import.meta.env.MODE,
    dev: import.meta.env.DEV,
  });

  window.addEventListener("error", (event) => {
    console.error("[bootstrap] window.onerror", event.message, event.filename, event.lineno);
  });

  window.addEventListener("unhandledrejection", (event) => {
    console.error("[bootstrap] unhandledrejection", event.reason);
  });
}
