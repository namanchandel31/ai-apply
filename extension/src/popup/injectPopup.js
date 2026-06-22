/**
 * Floating OneTap panel — injected on toolbar click.
 * Chrome's native action popup frame cannot be styled with border-radius.
 */

const ROOT_ID = "onetap-extension-popup-root";
const BACKDROP_ID = "onetap-extension-popup-backdrop";
const CONTROLLER_KEY = "__onetapPanelController";
const PANEL_RADIUS_PX = 16;
const PANEL_WIDTH_PX = 320;
const PANEL_OFFSET_TOP_PX = 16;
const PANEL_OFFSET_RIGHT_PX = 40;
const PANEL_OFFSET_BOTTOM_PX = 24;
const PANEL_MAX_HEIGHT_PX = 480;
const POPUP_URL = chrome.runtime.getURL("src/popup/popup.html?embedded=1");

function isInjectedPopupOpen() {
  return Boolean(document.getElementById(ROOT_ID));
}

function createPanelController() {
  function removeInjectedPopup() {
    document.getElementById(BACKDROP_ID)?.remove();
    document.getElementById(ROOT_ID)?.remove();
  }

  function closeInjectedPopup() {
    removeInjectedPopup();
    window.removeEventListener("keydown", onEscapeKey, true);
    window.removeEventListener("message", onPopupMessage, false);
  }

  function onEscapeKey(event) {
    if (event.key === "Escape") {
      closeInjectedPopup();
    }
  }

  function onPopupMessage(event) {
    const iframe = document.getElementById(ROOT_ID)?.querySelector("iframe");
    if (event.source !== iframe?.contentWindow) return;

    if (event.data?.type === "ONETAP_POPUP_CLOSE") {
      closeInjectedPopup();
      return;
    }

    if (event.data?.type !== "ONETAP_POPUP_RESIZE" || typeof event.data.height !== "number") {
      return;
    }
    const maxViewportHeight = window.innerHeight - PANEL_OFFSET_TOP_PX - PANEL_OFFSET_BOTTOM_PX;
    const nextHeight = Math.min(
      event.data.height,
      Math.min(PANEL_MAX_HEIGHT_PX, maxViewportHeight)
    );
    if (iframe) {
      iframe.style.height = `${Math.max(nextHeight, 1)}px`;
    }
    const root = document.getElementById(ROOT_ID);
    if (root) {
      root.style.height = `${Math.max(nextHeight, 1)}px`;
    }
  }

  function showInjectedPopup() {
    if (isInjectedPopupOpen()) return;

    const backdrop = document.createElement("div");
    backdrop.id = BACKDROP_ID;
    backdrop.setAttribute("aria-hidden", "true");
    backdrop.style.cssText =
      "position:fixed;inset:0;z-index:2147483646;background:transparent;";
    backdrop.addEventListener("click", closeInjectedPopup);

    const root = document.createElement("div");
    root.id = ROOT_ID;
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-label", "OneTap");
    root.style.cssText = [
      "position:fixed",
      `top:${PANEL_OFFSET_TOP_PX}px`,
      `right:${PANEL_OFFSET_RIGHT_PX}px`,
      `width:${PANEL_WIDTH_PX}px`,
      `max-height:calc(100vh - ${PANEL_OFFSET_TOP_PX + PANEL_OFFSET_BOTTOM_PX}px)`,
      `border-radius:${PANEL_RADIUS_PX}px`,
      "overflow:hidden",
      "background:#fff",
      "box-shadow:0 16px 48px rgba(15,23,42,0.18),0 0 0 1px rgba(15,23,42,0.06)",
      "z-index:2147483647",
    ].join(";");

    const iframe = document.createElement("iframe");
    iframe.src = POPUP_URL;
    iframe.title = "OneTap";
    iframe.setAttribute("scrolling", "no");
    iframe.style.cssText = "display:block;width:100%;height:1px;border:0;background:#fff;";

    root.appendChild(iframe);
    document.documentElement.appendChild(backdrop);
    document.documentElement.appendChild(root);
    window.addEventListener("keydown", onEscapeKey, true);
    window.addEventListener("message", onPopupMessage, false);
  }

  function registerMessageListener() {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message?.type !== "ONETAP_OPEN_PANEL") return false;
      showInjectedPopup();
      sendResponse({ ok: true, open: isInjectedPopupOpen() });
      return true;
    });
  }

  registerMessageListener();

  return { show: showInjectedPopup, close: closeInjectedPopup };
}

function getPanelController() {
  if (!globalThis[CONTROLLER_KEY]) {
    globalThis[CONTROLLER_KEY] = createPanelController();
  }
  return globalThis[CONTROLLER_KEY];
}

getPanelController().show();
