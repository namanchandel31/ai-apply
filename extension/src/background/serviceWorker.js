/**
 * Extension background service worker — API client + website-driven auth (Phase 0.5b).
 */

import {
  DEFAULT_API_BASE,
  DEFAULT_WEB_BASE,
  REFRESH_ALARM_MINUTES,
  SUPABASE_ANON_KEY,
  SUPABASE_URL,
  TOKEN_REFRESH_BUFFER_SEC,
} from "../config/app.config.js";

const AUTH_STORAGE_KEYS = [
  "accessToken",
  "refreshToken",
  "expiresAt",
  "apiBase",
  "connectedAt",
];

const POPUP_STATUS_CACHE_KEY = "cachedPopupStatus";

const REFRESH_ALARM_NAME = "onetap-token-refresh";

async function getStoredAuth() {
  return chrome.storage.local.get(AUTH_STORAGE_KEYS);
}

async function clearAuthStorage() {
  await chrome.storage.local.remove([...AUTH_STORAGE_KEYS, POPUP_STATUS_CACHE_KEY]);
}

async function getCachedPopupStatus() {
  const { [POPUP_STATUS_CACHE_KEY]: cached } = await chrome.storage.local.get(POPUP_STATUS_CACHE_KEY);
  return cached || null;
}

async function setCachedPopupStatus(status) {
  await chrome.storage.local.set({
    [POPUP_STATUS_CACHE_KEY]: {
      ...status,
      fetchedAt: new Date().toISOString(),
    },
  });
}

async function fetchPopupStatus({ writeCache = true } = {}) {
  const res = await apiFetch("/api/extension/popup-status");
  const data = res.data;
  if (writeCache && data) {
    await setCachedPopupStatus(data);
  }
  return data;
}

async function getApiBase() {
  const { apiBase } = await getStoredAuth();
  return apiBase || DEFAULT_API_BASE;
}

function sessionNeedsRefresh(expiresAt) {
  if (!Number.isFinite(expiresAt)) return true;
  const nowSec = Math.floor(Date.now() / 1000);
  return expiresAt - nowSec < TOKEN_REFRESH_BUFFER_SEC;
}

async function refreshAccessToken() {
  const stored = await getStoredAuth();
  const { refreshToken } = stored;
  if (!refreshToken) {
    throw new Error("NOT_CONNECTED");
  }
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Extension Supabase config missing — update app.config.js");
  }

  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    await clearAuthStorage();
    const message = body.error_description || body.error || body.message || "Token refresh failed";
    throw new Error(message);
  }

  const accessToken = body.access_token?.trim();
  const nextRefresh = body.refresh_token?.trim() || refreshToken;
  const expiresAt = body.expires_at ?? stored.expiresAt;

  if (!accessToken) {
    await clearAuthStorage();
    throw new Error("Token refresh returned no access token");
  }

  await chrome.storage.local.set({
    accessToken,
    refreshToken: nextRefresh,
    expiresAt,
  });

  return accessToken;
}

async function refreshAccessTokenIfNeeded() {
  const { accessToken, expiresAt } = await getStoredAuth();
  if (!accessToken) {
    throw new Error("NOT_CONNECTED");
  }
  if (!sessionNeedsRefresh(expiresAt)) {
    return accessToken;
  }
  return refreshAccessToken();
}

async function getAccessToken() {
  return refreshAccessTokenIfNeeded();
}

function parseApiError(body, status) {
  return body.error || body.message || `API ${status}`;
}

async function apiFetch(path, options = {}) {
  const token = await getAccessToken();
  const base = await getApiBase();
  const res = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });

  if (res.status === 401) {
    try {
      const retryToken = await refreshAccessToken();
      const retryRes = await fetch(`${base}${path}`, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${retryToken}`,
          ...(options.headers || {}),
        },
      });
      if (!retryRes.ok) {
        const retryBody = await retryRes.json().catch(() => ({}));
        if (retryRes.status === 401) {
          await clearAuthStorage();
        }
        throw new Error(parseApiError(retryBody, retryRes.status));
      }
      return retryRes.json();
    } catch (err) {
      if (err.message === "NOT_CONNECTED") {
        throw err;
      }
      await clearAuthStorage();
      throw err;
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(parseApiError(body, res.status));
  }
  return res.json();
}

async function exchangeConnectToken(connectToken, apiBase) {
  const base = (apiBase || DEFAULT_API_BASE).replace(/\/$/, "");
  const res = await fetch(`${base}/api/extension/connect/exchange`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ connectToken }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(parseApiError(body, res.status));
  }
  const data = body.data || body;
  if (!data.accessToken || !data.refreshToken) {
    throw new Error("Invalid connect exchange response");
  }
  return { ...data, apiBase: data.apiBase || base };
}

async function storeAuthSession(session) {
  const connectedAt = new Date().toISOString();
  await chrome.storage.local.set({
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    expiresAt: session.expiresAt,
    apiBase: session.apiBase || DEFAULT_API_BASE,
    connectedAt,
  });
  scheduleRefreshAlarm();
  return connectedAt;
}

function scheduleRefreshAlarm() {
  chrome.alarms.create(REFRESH_ALARM_NAME, {
    periodInMinutes: REFRESH_ALARM_MINUTES,
  });
}

function getExtensionVersion() {
  return chrome.runtime.getManifest().version;
}

async function getConnectionStatus() {
  const { accessToken, connectedAt } = await getStoredAuth();
  return {
    connected: Boolean(accessToken),
    connectedAt: connectedAt || null,
    version: getExtensionVersion(),
  };
}

async function handleConnect(message) {
  const session = await exchangeConnectToken(message.connectToken, message.apiBase);
  const connectedAt = await storeAuthSession(session);
  fetchPopupStatus().catch(() => {
    /* cache warm is best-effort */
  });
  return {
    ok: true,
    connectedAt,
    version: getExtensionVersion(),
  };
}

async function handleDisconnect() {
  await clearAuthStorage();
  await chrome.alarms.clear(REFRESH_ALARM_NAME);
  return { ok: true };
}

export async function fetchSetupStatus() {
  const res = await apiFetch("/api/user/setup-status");
  return res.data;
}

export async function fetchDetectionConfig() {
  const res = await apiFetch("/api/extension/detection-config");
  return res.data;
}

export async function submitAutoApply(payload) {
  return apiFetch("/api/auto-apply", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchApplyMode() {
  const res = await apiFetch("/api/user/me");
  return res.data.applyMode;
}

export async function fetchPopupStatusFromApi() {
  return fetchPopupStatus();
}

export async function patchApplyMode(applyMode) {
  const res = await apiFetch("/api/user/apply-mode", {
    method: "PATCH",
    body: JSON.stringify({ applyMode }),
  });
  await fetchPopupStatus();
  return res.data;
}

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason !== "install") return;
  const webBase = DEFAULT_WEB_BASE.replace(/\/$/, "");
  chrome.tabs.create({ url: `${webBase}/settings/extension` });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== REFRESH_ALARM_NAME) return;
  refreshAccessTokenIfNeeded().catch(() => {
    // refreshAccessToken clears storage on hard failure
  });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const handlers = {
    SETUP_STATUS: () => fetchSetupStatus(),
    DETECTION_CONFIG: () => fetchDetectionConfig(),
    AUTO_APPLY: () => submitAutoApply(message.payload),
    APPLY_MODE: () => fetchApplyMode(),
    POPUP_STATUS: () => fetchPopupStatus(),
    SET_APPLY_MODE: () => patchApplyMode(message.applyMode),
    ONETAP_PING: () => getConnectionStatus(),
    ONETAP_DISCONNECT: () => handleDisconnect(),
  };
  const fn = handlers[message?.type];
  if (!fn) return false;
  fn()
    .then((data) => sendResponse({ ok: true, data }))
    .catch((err) => sendResponse({ ok: false, error: err.message }));
  return true;
});

chrome.runtime.onMessageExternal.addListener((message, _sender, sendResponse) => {
  const type = message?.type;
  if (type === "ONETAP_CONNECT" && message.connectToken) {
    handleConnect(message)
      .then((result) => sendResponse(result))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }
  if (type === "ONETAP_DISCONNECT") {
    handleDisconnect()
      .then((result) => sendResponse(result))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }
  if (type === "ONETAP_PING") {
    getConnectionStatus()
      .then((data) => sendResponse({ ok: true, data }))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }
  if (type === "ONETAP_APPLY_MODE_SYNC") {
    fetchPopupStatus()
      .then((data) => sendResponse({ ok: true, data }))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }
  return false;
});

const INJECTED_POPUP_SCRIPT = "src/popup/injectPopup.js";

function isInjectableTabUrl(url) {
  if (!url) return false;
  return (
    url.startsWith("http://") ||
    url.startsWith("https://") ||
    url.startsWith("file://")
  );
}

async function openInjectedPopup(tab) {
  if (!tab?.id || !isInjectableTabUrl(tab.url)) {
    await chrome.windows.create({
      url: chrome.runtime.getURL("src/popup/popup.html"),
      type: "popup",
      width: 336,
      height: 480,
      focused: true,
    });
    return;
  }

  try {
    await chrome.tabs.sendMessage(tab.id, { type: "ONETAP_OPEN_PANEL" });
    return;
  } catch {
    // Controller not injected yet on this page — inject once, then it opens.
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: [INJECTED_POPUP_SCRIPT],
    });
  } catch {
    await chrome.windows.create({
      url: chrome.runtime.getURL("src/popup/popup.html"),
      type: "popup",
      width: 336,
      height: 480,
      focused: true,
    });
  }
}

chrome.action.onClicked.addListener((tab) => {
  void openInjectedPopup(tab);
});
