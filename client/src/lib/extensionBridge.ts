import { api } from "@/lib/api";
import { getSupabaseAccessToken, supabase } from "@/lib/supabaseClient";

type ExtensionPingResult = {
  connected: boolean;
  connectedAt: string | null;
  version: string;
};

type ChromeRuntime = {
  sendMessage: (
    extensionId: string,
    message: unknown,
    callback?: (response: unknown) => void
  ) => void;
  lastError?: { message?: string };
};

declare const chrome: { runtime: ChromeRuntime } | undefined;

function getExtensionId(): string | null {
  const id = import.meta.env.VITE_ONETAP_EXTENSION_ID as string | undefined;
  return id?.trim() || null;
}

function extensionNotReachableError(extensionId: string): Error {
  return new Error(
    `No OneTap extension found for ID "${extensionId}". Open chrome://extensions, enable OneTap, and confirm its ID matches VITE_ONETAP_EXTENSION_ID in client/.env. For local development, use Load unpacked from the extension/ folder (not the Chrome Web Store build), copy that extension ID into client/.env, then restart the dev server.`
  );
}

function resolveApiBase(): string {
  const fromEnv = import.meta.env.VITE_API_URL as string | undefined;
  if (fromEnv?.trim()) {
    return fromEnv.trim().replace(/\/$/, "");
  }
  if (typeof window !== "undefined") {
    return window.location.origin.replace(/:5173$/, ":5000");
  }
  return "http://localhost:5000";
}

function sendExtensionMessage<T>(message: unknown): Promise<T> {
  const extensionId = getExtensionId();
  if (!extensionId) {
    return Promise.reject(new Error("Extension ID is not configured (VITE_ONETAP_EXTENSION_ID)"));
  }
  if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) {
    return Promise.reject(
      new Error("Chrome extension API is unavailable. Use Google Chrome with the extension installed.")
    );
  }

  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(extensionId, message, (response) => {
      const lastError = chrome.runtime.lastError;
      if (lastError?.message) {
        if (/could not establish connection|receiving end does not exist/i.test(lastError.message)) {
          reject(extensionNotReachableError(extensionId));
          return;
        }
        reject(new Error(lastError.message));
        return;
      }
      resolve(response as T);
    });
  });
}

export function getConfiguredExtensionId(): string | null {
  return getExtensionId();
}

export function isExtensionIdConfigured(): boolean {
  return Boolean(getExtensionId());
}

export type ExtensionInstallState = {
  configured: boolean;
  installed: boolean;
  version: string | null;
  accountConnected: boolean;
  connectedAt: string | null;
};

export async function getExtensionInstallState(): Promise<ExtensionInstallState> {
  const configured = isExtensionIdConfigured();
  if (!configured) {
    return {
      configured: false,
      installed: false,
      version: null,
      accountConnected: false,
      connectedAt: null,
    };
  }

  try {
    const ping = await pingExtension();
    return {
      configured: true,
      installed: true,
      version: ping.version || null,
      accountConnected: ping.connected,
      connectedAt: ping.connectedAt,
    };
  } catch {
    return {
      configured: true,
      installed: false,
      version: null,
      accountConnected: false,
      connectedAt: null,
    };
  }
}

export async function pingExtension(): Promise<ExtensionPingResult> {
  const response = await sendExtensionMessage<{ ok?: boolean; data?: ExtensionPingResult; error?: string }>({
    type: "ONETAP_PING",
  });
  if (!response?.ok || !response.data) {
    throw new Error(response?.error || "Extension did not respond");
  }
  return response.data;
}

export async function connectExtension(): Promise<{ connectedAt: string; version: string }> {
  const accessToken = await getSupabaseAccessToken();
  if (!accessToken) {
    throw new Error("You must be logged in to connect the extension");
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session) {
    throw new Error("Could not read session. Try signing in again.");
  }

  const session = sessionData.session;
  if (!session.refresh_token) {
    throw new Error("Session is missing refresh token. Sign out and sign in again.");
  }

  const apiBase = resolveApiBase();
  const initRes = await api.postExtensionConnectInit({
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresAt: session.expires_at ?? 0,
    apiBase,
  });

  const connectToken = initRes.data.connectToken;
  const response = await sendExtensionMessage<{
    ok?: boolean;
    connectedAt?: string;
    version?: string;
    error?: string;
  }>({
    type: "ONETAP_CONNECT",
    connectToken,
    apiBase,
  });

  if (!response?.ok) {
    throw new Error(response?.error || "Extension connect failed");
  }

  return {
    connectedAt: response.connectedAt || new Date().toISOString(),
    version: response.version || "unknown",
  };
}

export async function disconnectExtension(): Promise<void> {
  if (!isExtensionIdConfigured()) return;
  try {
    await sendExtensionMessage<{ ok?: boolean }>({ type: "ONETAP_DISCONNECT" });
  } catch {
    // Best-effort during logout — extension may be uninstalled
  }
}

/** Best-effort: refresh extension cache after dashboard apply-mode change. */
export async function notifyExtensionApplyModeSync(): Promise<void> {
  if (!isExtensionIdConfigured()) return;
  try {
    await sendExtensionMessage<{ ok?: boolean }>({ type: "ONETAP_APPLY_MODE_SYNC" });
  } catch {
    // Extension may be uninstalled or on another browser profile
  }
}

export function formatExtensionConnectedAt(iso: string | null): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function getSettingsExtensionUrl(): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/settings/extension`;
  }
  return "/settings/extension";
}
