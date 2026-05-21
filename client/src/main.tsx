import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { BootstrapErrorBoundary } from "@/components/BootstrapErrorBoundary";
import { installBootstrapDiagnostics } from "@/bootstrapDebug";
import { AuthProvider } from "@/auth/AuthContext";
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
          <BrowserRouter>
            <AuthProvider>
              <App />
              <Toaster position="bottom-right" richColors />
            </AuthProvider>
          </BrowserRouter>
        </QueryClientProvider>
      </BootstrapErrorBoundary>
    </StrictMode>
  );
} catch (err) {
  console.error("[bootstrap] createRoot failed", err);
  throw err;
}
