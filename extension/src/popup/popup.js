import { DEFAULT_WEB_BASE } from "../config/app.config.js";
import { autoApplyToggleDescription, isAutoApplyMode } from "../shared/applyModeCopy.js";

const POPUP_STATUS_CACHE_KEY = "cachedPopupStatus";
const SETTINGS_PATH = "/settings/extension";
const APPLICATIONS_PATH = "/applications";

const viewLoading = document.getElementById("view-loading");
const viewMain = document.getElementById("view-main");
const connectExtensionBtn = document.getElementById("connect-extension");
const connectionStatusEl = document.getElementById("connection-status");
const openApplicationsBtn = document.getElementById("open-applications");
const autoToggleBtn = document.getElementById("auto-toggle");
const toggleHintEl = document.getElementById("toggle-hint");
const toggleLabelEl = document.getElementById("toggle-label");
const closePanelBtn = document.getElementById("close-panel");
const errorEl = document.getElementById("error");

let applyModePending = false;
let isConnected = false;

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
  viewMain.hidden = name !== "main";
  notifyPopupHeight();
}

function notifyPopupHeight() {
  if (window.parent === window) return;
  requestAnimationFrame(() => {
    const height = Math.ceil(document.documentElement.getBoundingClientRect().height);
    window.parent.postMessage({ type: "ONETAP_POPUP_RESIZE", height }, "*");
  });
}

function setError(message) {
  if (!message) {
    errorEl.hidden = true;
    errorEl.textContent = "";
    notifyPopupHeight();
    return;
  }
  errorEl.hidden = false;
  errorEl.textContent = message;
  notifyPopupHeight();
}

function setConnectionUi(connected) {
  isConnected = connected;
  connectExtensionBtn.hidden = connected;
  connectionStatusEl.hidden = !connected;
  autoToggleBtn.disabled = !connected || applyModePending;
  notifyPopupHeight();
}

async function readIsConnected() {
  try {
    const ping = await bgRequest("ONETAP_PING");
    if (ping?.connected) return true;
  } catch {
    /* fall through to storage check */
  }
  const { accessToken } = await chrome.storage.local.get("accessToken");
  return Boolean(accessToken);
}

function setAutoApplyUi(enabled) {
  autoToggleBtn.setAttribute("aria-checked", enabled ? "true" : "false");
  toggleLabelEl.textContent = enabled ? "On" : "Off";
  toggleHintEl.textContent = autoApplyToggleDescription(enabled);
  autoToggleBtn.setAttribute(
    "aria-label",
    enabled ? "Auto apply on — sends automatically" : "Auto apply off — review before sending"
  );
  openApplicationsBtn.textContent = enabled ? "Open Applications" : "Review applications";
  notifyPopupHeight();
}

function applyPopupStatus(status) {
  if (!status) return;
  setAutoApplyUi(isAutoApplyMode(status.applyMode));
}

connectExtensionBtn.addEventListener("click", () => {
  openWebApp(SETTINGS_PATH);
});

openApplicationsBtn.addEventListener("click", () => {
  openWebApp(APPLICATIONS_PATH);
});

closePanelBtn.addEventListener("click", () => {
  if (window.parent !== window) {
    window.parent.postMessage({ type: "ONETAP_POPUP_CLOSE" }, "*");
    return;
  }
  window.close();
});

autoToggleBtn.addEventListener("click", async () => {
  if (applyModePending || !isConnected) return;

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
    autoToggleBtn.disabled = !isConnected;
  }
});

async function refreshPopupStatus() {
  if (!isConnected) return;

  try {
    const status = await bgRequest("POPUP_STATUS");
    applyPopupStatus(status);
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (/not connected|401|unauthorized/i.test(message)) {
      setConnectionUi(false);
      setAutoApplyUi(false);
      return;
    }
    const cached = await readCachedPopupStatus();
    if (cached) {
      applyPopupStatus(cached);
    } else {
      setError(message || "Could not load status");
    }
  }
}

async function render() {
  showView("loading");
  setError("");

  const connected = await readIsConnected();

  showView("main");
  setConnectionUi(connected);

  if (connected) {
    const cached = await readCachedPopupStatus();
    if (cached) {
      applyPopupStatus(cached);
    }
    void refreshPopupStatus();
  } else {
    setAutoApplyUi(false);
  }
}

render();
notifyPopupHeight();
window.addEventListener("load", notifyPopupHeight);

if (window.parent !== window && typeof ResizeObserver !== "undefined") {
  const resizeObserver = new ResizeObserver(() => notifyPopupHeight());
  resizeObserver.observe(document.body);
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !changes.accessToken) return;
  void render();
});
