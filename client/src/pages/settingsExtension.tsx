import { useCallback, useEffect, useState } from "react";
import { ExternalLink, Loader2, Puzzle } from "lucide-react";
import { toast } from "sonner";
import { SetupPageShell } from "@/components/layout/SetupPageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  connectExtension,
  getExtensionInstallState,
} from "@/lib/extensionBridge";
import { CHROME_EXTENSION_URL } from "@/lib/extensionPrompt";

export function SettingsExtension() {
  const isDev = import.meta.env.DEV;
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(true);
  const [installed, setInstalled] = useState(false);
  const [accountConnected, setAccountConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [awaitingInstall, setAwaitingInstall] = useState(false);

  const refreshStatus = useCallback(async () => {
    setLoading(true);
    const state = await getExtensionInstallState();
    setConfigured(state.configured);
    setInstalled(state.installed);
    setAccountConnected(state.accountConnected);
    setLoading(false);
    if (state.installed) {
      setAwaitingInstall(false);
    }
  }, []);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    if (!awaitingInstall) return;

    let active = true;

    const checkOnReturn = () => {
      if (!active || document.visibilityState !== "visible") return;
      void refreshStatus();
    };

    document.addEventListener("visibilitychange", checkOnReturn);
    window.addEventListener("focus", checkOnReturn);
    const intervalId = window.setInterval(checkOnReturn, 3000);

    return () => {
      active = false;
      document.removeEventListener("visibilitychange", checkOnReturn);
      window.removeEventListener("focus", checkOnReturn);
      window.clearInterval(intervalId);
    };
  }, [awaitingInstall, refreshStatus]);

  const handleInstall = () => {
    window.open(CHROME_EXTENSION_URL, "_blank", "noopener,noreferrer");
    setAwaitingInstall(true);
  };

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

  const installStatusLabel = loading
    ? "Checking…"
    : installed
      ? "Extension is installed"
      : awaitingInstall
        ? "Waiting for install…"
        : "Not installed";

  const installStatusVariant = loading
    ? "secondary"
    : installed
      ? "success"
      : awaitingInstall
        ? "warning"
        : "secondary";

  const connectStatusLabel = loading ? "Checking…" : accountConnected ? "Connected" : "Not connected";
  const connectStatusVariant = loading ? "secondary" : accountConnected ? "success" : "secondary";

  return (
    <SetupPageShell
      title="Chrome Extension"
      description="Install the OneTap extension and connect it to your account for LinkedIn job discovery."
    >
      <div className="max-w-xl space-y-4">
        <section className="space-y-4 rounded-lg border border-border p-5">
          <h2 className="text-base font-semibold">1. Install extension</h2>

          {installed ? (
            <dl className="text-sm">
              <div className="flex items-center justify-between gap-4 py-2">
                <dt className="text-muted-foreground">Status</dt>
                <dd>
                  <Badge variant={installStatusVariant}>{installStatusLabel}</Badge>
                </dd>
              </div>
            </dl>
          ) : (
            <>
              <dl className="grid gap-2 text-sm">
                <div className="flex items-center justify-between gap-4 border-b border-border/60 py-2">
                  <dt className="text-muted-foreground">Status</dt>
                  <dd>
                    <Badge variant={installStatusVariant}>{installStatusLabel}</Badge>
                  </dd>
                </div>
              </dl>

              <p className="text-sm text-muted-foreground">
                Install OneTap from the Chrome Web Store, then return to this tab to continue.
              </p>
              <Button type="button" className="gap-2" onClick={handleInstall} disabled={awaitingInstall}>
                {awaitingInstall ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Puzzle className="h-4 w-4" aria-hidden />
                )}
                {awaitingInstall ? "Waiting for installation…" : "Install Chrome Extension"}
                {!awaitingInstall ? <ExternalLink className="h-3.5 w-3.5 opacity-70" aria-hidden /> : null}
              </Button>

              {isDev ? (
                <div className="space-y-2 border-t border-border pt-4">
                  <p className="text-sm font-medium text-foreground">Local development</p>
                  {!configured ? (
                    <p className="text-sm text-muted-foreground">
                      Set <code className="text-sm">VITE_ONETAP_EXTENSION_ID</code> in{" "}
                      <code className="text-sm">client/.env</code> from{" "}
                      <code className="text-sm">chrome://extensions</code>, then restart the dev server.
                    </p>
                  ) : null}
                  <p className="text-sm text-muted-foreground">
                    To test an unpacked build: open <code className="text-sm">chrome://extensions</code>,
                    enable Developer mode, click <strong>Load unpacked</strong>, and select the{" "}
                    <code className="text-sm">extension/</code> folder in this repository.
                  </p>
                </div>
              ) : null}
            </>
          )}
        </section>

        <section className="space-y-4 rounded-lg border border-border p-5">
          <h2 className="text-base font-semibold">2. Connect extension</h2>

          <dl className="grid gap-2 text-sm">
            <div className="flex items-center justify-between gap-4 py-2">
              <dt className="text-muted-foreground">Status</dt>
              <dd>
                <Badge variant={connectStatusVariant}>{connectStatusLabel}</Badge>
              </dd>
            </div>
          </dl>

          {connectError ? (
            <p className="text-sm text-destructive" role="alert">
              {connectError}
            </p>
          ) : null}

          <Button
            type="button"
            onClick={() => void handleConnect()}
            disabled={connecting || loading || !installed || !configured}
            className="gap-2"
          >
            {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Puzzle className="h-4 w-4" />}
            Connect Extension
          </Button>
        </section>
      </div>
    </SetupPageShell>
  );
}
