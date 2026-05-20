import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { BootstrapErrorBoundary } from "@/components/BootstrapErrorBoundary";
import { installBootstrapDiagnostics } from "@/bootstrapDebug";
import App from "./App";
import "./index.css";

installBootstrapDiagnostics();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

const rootEl = document.getElementById("root");

if (!rootEl) {
  throw new Error("Root element #root not found in index.html");
}

try {
  createRoot(rootEl).render(
    <StrictMode>
      <BootstrapErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <App />
          <Toaster position="bottom-right" richColors />
        </QueryClientProvider>
      </BootstrapErrorBoundary>
    </StrictMode>
  );
} catch (err) {
  console.error("[bootstrap] createRoot failed", err);
  throw err;
}
