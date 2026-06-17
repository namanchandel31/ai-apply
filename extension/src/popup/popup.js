import { DEFAULT_WEB_BASE } from "../config/app.config.js";

const POPUP_STATUS_CACHE_KEY = "cachedPopupStatus";

// The website origin is independent from the API origin, so it comes straight
// from config (not derived from the stored apiBase).
function openWebApp(path) {
  chrome.tabs.create({ url: `${DEFAULT_WEB_BASE.replace(/\/$/, "")}${path}` });
}

function bgRequest(type, payload) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(payload ? { type, payload } : { type }, (res) => {
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

const statusEl = document.getElementById("status");
const metaEl = document.getElementById("meta");
const setupEl = document.getElementById("setup");
const modeEl = document.getElementById("mode");
const openBtn = document.getElementById("open");
const dashboardBtn = document.getElementById("dashboard");
const disconnectBtn = document.getElementById("disconnect");

let isConnected = false;

function applyPopupStatusToUi(setup, applyMode) {
  const incomplete = [];
  if (!setup?.hasValidResume) incomplete.push("resume");
  if (!setup?.hasEmailSetup) incomplete.push("email");
  if (!setup?.hasVerifiedAiCredential) incomplete.push("AI");
  setupEl.textContent = incomplete.length
    ? `Setup incomplete: ${incomplete.join(", ")}`
    : "Setup complete";
  modeEl.textContent = `AutoApply: ${applyMode === "auto_apply" ? "ON" : "OFF"} (read-only)`;
}

function formatConnectedAt(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

// Connected → land on /settings/extension; otherwise (first run / signed out)
// land on the dashboard, which routes unauthenticated users to sign in.
openBtn.addEventListener("click", () => {
  openWebApp(isConnected ? "/settings/extension" : "/dashboard");
});

dashboardBtn.addEventListener("click", () => {
  openWebApp("/dashboard");
});

disconnectBtn.addEventListener("click", async () => {
  disconnectBtn.disabled = true;
  try {
    await bgRequest("ONETAP_DISCONNECT");
    await render();
  } catch (err) {
    statusEl.textContent = err instanceof Error ? err.message : "Disconnect failed";
  } finally {
    disconnectBtn.disabled = false;
  }
});

async function refreshPopupStatus() {
  try {
    const status = await bgRequest("POPUP_STATUS");
    applyPopupStatusToUi(status.setup, status.applyMode);
  } catch (err) {
    const cached = await readCachedPopupStatus();
    if (!cached) {
      setupEl.textContent = err instanceof Error ? err.message : "Could not load status";
      modeEl.textContent = "";
    }
  }
}

async function render() {
  let ping;
  try {
    ping = await bgRequest("ONETAP_PING");
  } catch {
    ping = { connected: false };
  }

  if (!ping.connected) {
    isConnected = false;
    statusEl.textContent = "Not connected";
    metaEl.textContent = "Open OneTap to sign in and connect this extension.";
    setupEl.textContent = "";
    modeEl.textContent = "";
    openBtn.textContent = "Open OneTap";
    dashboardBtn.hidden = true;
    disconnectBtn.hidden = true;
    return;
  }

  isConnected = true;
  statusEl.textContent = "Connected";
  metaEl.textContent = `Version: ${ping.version || "—"} · Connected: ${formatConnectedAt(ping.connectedAt)}`;
  openBtn.textContent = "Extension Settings";
  dashboardBtn.hidden = false;
  disconnectBtn.hidden = false;

  const cached = await readCachedPopupStatus();
  if (cached?.setup) {
    applyPopupStatusToUi(cached.setup, cached.applyMode);
  } else {
    setupEl.textContent = "Loading status…";
    modeEl.textContent = "";
  }

  void refreshPopupStatus();
}

render();
