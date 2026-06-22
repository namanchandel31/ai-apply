import { useCallback, useEffect, useState } from "react";
import { Loader2, Puzzle } from "lucide-react";
import { toast } from "sonner";
import { SetupPageShell } from "@/components/layout/SetupPageShell";
import { Button } from "@/components/ui/button";
import {
  connectExtension,
  formatExtensionConnectedAt,
  isExtensionIdConfigured,
  pingExtension,
} from "@/lib/extensionBridge";

type ExtensionStatus = {
  connected: boolean;
  version: string | null;
  connectedAt: string | null;
};

export function SettingsExtension() {
  const [status, setStatus] = useState<ExtensionStatus>({
    connected: false,
    version: null,
    connectedAt: null,
  });
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  const extensionIdConfigured = isExtensionIdConfigured();

  const refreshStatus = useCallback(async () => {
    if (!extensionIdConfigured) {
      setStatus({ connected: false, version: null, connectedAt: null });
      setStatusError("Set VITE_ONETAP_EXTENSION_ID in client/.env (from chrome://extensions).");
      setLoadingStatus(false);
      return;
    }

    setLoadingStatus(true);
    setStatusError(null);
    try {
      const ping = await pingExtension();
      setStatus({
        connected: ping.connected,
        version: ping.version || null,
        connectedAt: ping.connectedAt,
      });
    } catch (err) {
      setStatus({ connected: false, version: null, connectedAt: null });
      setStatusError(err instanceof Error ? err.message : "Could not reach extension");
    } finally {
      setLoadingStatus(false);
    }
  }, [extensionIdConfigured]);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      await connectExtension();
      toast.success("Extension connected");
      await refreshStatus();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to connect extension");
    } finally {
      setConnecting(false);
    }
  };

  return (
    <SetupPageShell
      title="Chrome Extension"
      description="Install the OneTap extension and connect it to your account for LinkedIn job discovery."
    >
      <div className="mx-auto max-w-xl space-y-8">
        <section className="space-y-3 rounded-lg border border-border p-5">
          <h2 className="text-base font-semibold">1. Install extension</h2>
          <p className="text-sm text-muted-foreground">
            For local development: open <code className="text-xs">chrome://extensions</code>, enable
            Developer mode, click <strong>Load unpacked</strong>, and select the{" "}
            <code className="text-xs">extension/</code> folder in this repository.
          </p>
          <p className="text-sm text-muted-foreground">
            Copy the extension ID into <code className="text-xs">client/.env</code> as{" "}
            <code className="text-xs">VITE_ONETAP_EXTENSION_ID</code>, then restart the Vite dev server.
          </p>
        </section>

        <section className="space-y-4 rounded-lg border border-border p-5">
          <h2 className="text-base font-semibold">2. Connect extension</h2>

          <dl className="grid gap-2 text-sm">
            <div className="flex justify-between gap-4 border-b border-border/60 py-2">
              <dt className="text-muted-foreground">Connected</dt>
              <dd className="font-medium">
                {loadingStatus ? "…" : status.connected ? "Yes" : "No"}
              </dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-border/60 py-2">
              <dt className="text-muted-foreground">Version</dt>
              <dd className="font-medium">{loadingStatus ? "…" : status.version || "-"}</dd>
            </div>
            <div className="flex justify-between gap-4 py-2">
              <dt className="text-muted-foreground">Connected at</dt>
              <dd className="font-medium text-right">
                {loadingStatus ? "…" : formatExtensionConnectedAt(status.connectedAt)}
              </dd>
            </div>
          </dl>

          {statusError ? (
            <p className="text-sm text-destructive" role="alert">
              {statusError}
            </p>
          ) : null}

          <Button
            type="button"
            onClick={() => void handleConnect()}
            disabled={connecting || !extensionIdConfigured}
            className="gap-2"
          >
            {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Puzzle className="h-4 w-4" />}
            Connect Extension
          </Button>

          {!extensionIdConfigured ? (
            <p className="text-xs text-muted-foreground">
              Configure the extension ID before connecting.
            </p>
          ) : null}
        </section>
      </div>
    </SetupPageShell>
  );
}
