import { useCallback, useEffect, useState } from "react";
import { ExternalLink, Loader2, Puzzle } from "lucide-react";
import { toast } from "sonner";
import { SetupPageShell } from "@/components/layout/SetupPageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  connectExtension,
  getConfiguredExtensionId,
  getExtensionInstallState,
} from "@/lib/extensionBridge";
import { CHROME_EXTENSION_URL, CHROME_WEB_STORE_EXTENSION_ID } from "@/lib/extensionPrompt";

export function SettingsExtension() {
  const isDev = import.meta.env.DEV;
  const configuredExtensionId = getConfiguredExtensionId();
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(true);
  const [installed, setInstalled] = useState(false);
  const [accountConnected, setAccountConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  const refreshStatus = useCallback(async () => {
    setLoading(true);
    const state = await getExtensionInstallState();
    setConfigured(state.configured);
    setInstalled(state.installed);
    setAccountConnected(state.accountConnected);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    const checkOnReturn = () => {
      if (document.visibilityState !== "visible") return;
      void refreshStatus();
    };

    document.addEventListener("visibilitychange", checkOnReturn);
    window.addEventListener("focus", checkOnReturn);
    return () => {
      document.removeEventListener("visibilitychange", checkOnReturn);
      window.removeEventListener("focus", checkOnReturn);
    };
  }, [refreshStatus]);

  const handleConnect = async () => {
    setConnecting(true);
    setConnectError(null);
    try {
      await connectExtension();
      toast.success("Extension connected");
      await refreshStatus();
    } catch (err) {
      setConnectError(err instanceof Error ? err.message : "Failed to connect extension");
    } finally {
      setConnecting(false);
    }
  };

  const connectStatusLabel = loading ? "Checking…" : accountConnected ? "Connected" : "Not connected";
  const connectStatusVariant = loading ? "secondary" : accountConnected ? "success" : "secondary";
  const showLocalDevHelp = isDev && configured && !installed && !loading;

  return (
    <SetupPageShell
      title="Chrome Extension"
      description="Connect the OneTap extension to apply to jobs directly from LinkedIn."
    >
      <div className="max-w-xl">
        <section className="space-y-5 rounded-lg border border-border p-6">
          <div className="flex items-center justify-between gap-4">
            <p className="text-base font-medium text-foreground">Status</p>
            <Badge variant={connectStatusVariant} className="px-3 py-1 text-sm">
              {connectStatusLabel}
            </Badge>
          </div>

          {connectError ? (
            <p className="text-base text-destructive" role="alert">
              {connectError}
            </p>
          ) : null}

          {accountConnected && !loading ? (
            <p className="text-base leading-relaxed text-muted-foreground">
              You&apos;re connected. Open LinkedIn, find a hiring post, and tap OneTap to apply.
            </p>
          ) : (
            <>
              <p className="text-base leading-relaxed text-muted-foreground">
                Link the extension to this account, then apply from LinkedIn in one tap.
              </p>
              <Button
                type="button"
                size="lg"
                className="h-11 w-full gap-2 text-base"
                onClick={() => void handleConnect()}
                disabled={connecting || loading || !configured}
              >
                {connecting ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Puzzle className="h-4 w-4" aria-hidden />
                )}
                Connect Extension
              </Button>

              {isDev ? (
                <p className="text-center text-base text-muted-foreground">
                  Local dev: open <code className="text-sm">chrome://extensions</code>, enable Developer
                  mode, click <strong>Load unpacked</strong>, and select the{" "}
                  <code className="text-sm">extension/</code> folder in this repo.
                </p>
              ) : (
                <p className="text-center text-base text-muted-foreground">
                  Don&apos;t have the extension yet?{" "}
                  <a
                    href={CHROME_EXTENSION_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-base font-medium text-primary underline-offset-4 hover:underline"
                  >
                    Install from the Chrome Web Store
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                  </a>
                </p>
              )}
            </>
          )}

          {showLocalDevHelp ? (
            <div className="space-y-2 rounded-md border border-border/80 bg-muted/30 p-4">
              <p className="text-sm font-medium text-foreground">Extension not detected</p>
              <p className="text-sm text-muted-foreground">
                This page is looking for extension ID{" "}
                <code className="text-sm">{configuredExtensionId}</code>. The Chrome Web Store build uses
                ID <code className="text-sm">{CHROME_WEB_STORE_EXTENSION_ID}</code> and cannot connect to
                localhost.
              </p>
              <p className="text-sm text-muted-foreground">
                Load the local <code className="text-sm">extension/</code> folder via{" "}
                <strong>Load unpacked</strong>, copy its ID into{" "}
                <code className="text-sm">VITE_ONETAP_EXTENSION_ID</code> in{" "}
                <code className="text-sm">client/.env</code>, reload the extension, then restart the dev
                server.
              </p>
            </div>
          ) : null}

          {isDev && !configured ? (
            <div className="space-y-2 border-t border-border pt-4">
              <p className="text-sm font-medium text-foreground">Local development</p>
              <p className="text-sm text-muted-foreground">
                Set <code className="text-sm">VITE_ONETAP_EXTENSION_ID</code> in{" "}
                <code className="text-sm">client/.env</code> from{" "}
                <code className="text-sm">chrome://extensions</code>, then restart the dev server.
                Load unpacked from the <code className="text-sm">extension/</code> folder.
              </p>
            </div>
          ) : null}
        </section>
      </div>
    </SetupPageShell>
  );
}
