import { DEFAULT_WEB_BASE } from "../config/app.config.js";

const POPUP_STATUS_CACHE_KEY = "cachedPopupStatus";
const SETTINGS_PATH = "/settings/extension";

const viewLoading = document.getElementById("view-loading");
const viewDisconnected = document.getElementById("view-disconnected");
const viewConnected = document.getElementById("view-connected");
const openSettingsBtn = document.getElementById("open-settings");
const planNameEl = document.getElementById("plan-name");
const autoToggleBtn = document.getElementById("auto-toggle");
const toggleLabelEl = document.getElementById("toggle-label");
const disconnectBtn = document.getElementById("disconnect");
const errorEl = document.getElementById("error");

let applyModePending = false;

function openWebApp(path) {
  chrome.tabs.create({ url: `${DEFAULT_WEB_BASE.replace(/\/$/, "")}${path}` });
}

function bgRequest(type, fields = {}) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type, ...fields }, (res) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (!res?.ok) {
        reject(new Error(res?.error || "Request failed"));
        return;
      }
      resolve(res.data);
    });
  });
}

async function readCachedPopupStatus() {
  const { [POPUP_STATUS_CACHE_KEY]: cached } = await chrome.storage.local.get(POPUP_STATUS_CACHE_KEY);
  return cached || null;
}

function showView(name) {
  viewLoading.hidden = name !== "loading";
  viewDisconnected.hidden = name !== "disconnected";
  viewConnected.hidden = name !== "connected";
}

function setError(message) {
  if (!message) {
    errorEl.hidden = true;
    errorEl.textContent = "";
    return;
  }
  errorEl.hidden = false;
  errorEl.textContent = message;
}

function setAutoApplyUi(enabled) {
  autoToggleBtn.setAttribute("aria-checked", enabled ? "true" : "false");
  toggleLabelEl.textContent = enabled ? "On" : "Off";
}

function applyPopupStatus(status) {
  if (!status) return;
  planNameEl.textContent = status.plan?.label || "No active plan";
  setAutoApplyUi(status.applyMode === "auto_apply");
}

openSettingsBtn.addEventListener("click", () => {
  openWebApp(SETTINGS_PATH);
});

disconnectBtn.addEventListener("click", async () => {
  disconnectBtn.disabled = true;
  setError("");
  try {
    await bgRequest("ONETAP_DISCONNECT");
    await render();
  } catch (err) {
    setError(err instanceof Error ? err.message : "Disconnect failed");
  } finally {
    disconnectBtn.disabled = false;
  }
});

autoToggleBtn.addEventListener("click", async () => {
  if (applyModePending) return;

  const nextEnabled = autoToggleBtn.getAttribute("aria-checked") !== "true";
  const nextMode = nextEnabled ? "auto_apply" : "review_apply";
  const previousEnabled = !nextEnabled;

  applyModePending = true;
  autoToggleBtn.disabled = true;
  setError("");
  setAutoApplyUi(nextEnabled);

  try {
    await bgRequest("SET_APPLY_MODE", { applyMode: nextMode });
  } catch (err) {
    setAutoApplyUi(previousEnabled);
    setError(err instanceof Error ? err.message : "Could not update auto apply");
  } finally {
    applyModePending = false;
    autoToggleBtn.disabled = false;
  }
});

async function refreshPopupStatus() {
  try {
    const status = await bgRequest("POPUP_STATUS");
    applyPopupStatus(status);
  } catch (err) {
    const cached = await readCachedPopupStatus();
    if (cached) {
      applyPopupStatus(cached);
    } else {
      planNameEl.textContent = "Could not load plan";
      setError(err instanceof Error ? err.message : "Could not load status");
    }
  }
}

async function render() {
  showView("loading");
  setError("");

  let ping;
  try {
    ping = await bgRequest("ONETAP_PING");
  } catch {
    ping = { connected: false };
  }

  if (!ping.connected) {
    showView("disconnected");
    return;
  }

  showView("connected");

  const cached = await readCachedPopupStatus();
  if (cached) {
    applyPopupStatus(cached);
  }

  void refreshPopupStatus();
}

render();
