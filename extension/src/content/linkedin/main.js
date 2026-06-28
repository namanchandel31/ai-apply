/**
 * MV3 content scripts cannot use static `import` — load extension modules dynamically.
 */
(async function oneTapLinkedInMain() {
  let friendlyApplyError;
  let isAutoApplyMode;
  let isSetupCompleteFromStatus;
  let linkedInButtonTitle;
  let linkedInSuccessTitle;
  let setupIssuesFromStatus;
  let WEB_BASE;

  function isExtensionContextValid() {
    try {
      return Boolean(chrome.runtime?.id);
    } catch {
      return false;
    }
  }

  function isContextInvalidatedError(message) {
    return /extension context invalidated/i.test(String(message || ""));
  }

  async function importExtensionModule(path, attempts = 3) {
    let lastErr;
    for (let i = 0; i < attempts; i++) {
      if (!isExtensionContextValid()) {
        throw new Error("Extension context invalidated");
      }
      try {
        return await import(chrome.runtime.getURL(path));
      } catch (err) {
        lastErr = err;
        if (i < attempts - 1) {
          await new Promise((resolve) => window.setTimeout(resolve, 120 * (i + 1)));
        }
      }
    }
    throw lastErr;
  }

  try {
    const [applyModeCopy, appConfig] = await Promise.all([
      importExtensionModule("src/shared/applyModeCopy.js"),
      importExtensionModule("src/config/app.config.js"),
    ]);
    ({
      friendlyApplyError,
      isAutoApplyMode,
      isSetupCompleteFromStatus,
      linkedInButtonTitle,
      linkedInSuccessTitle,
      setupIssuesFromStatus,
    } = applyModeCopy);
    WEB_BASE = appConfig.DEFAULT_WEB_BASE.replace(/\/$/, "");
  } catch (err) {
    console.error("[OneTap] Failed to load extension modules", err);
    return;
  }

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const CONFIG_TTL_MS = 60 * 60 * 1000;
const SCAN_DEBOUNCE_MS = 400;
const MIN_POST_TEXT_LEN = 40;

const ACTION_LABELS = ["like", "comment", "repost", "send"];
const SOCIAL_CONTROL_SEL = "button, [role='button'], a";

function controlHints(btn) {
  const parts = [btn.getAttribute("aria-label"), btn.getAttribute("title"), btn.innerText];
  let node = btn.parentElement;
  for (let i = 0; i < 3 && node; i++) {
    parts.push(node.getAttribute("aria-label"));
    parts.push(node.getAttribute("title"));
    node = node.parentElement;
  }
  return parts
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function matchesLabel(btn, label) {
  const hints = controlHints(btn);
  const txt = (btn.innerText || "").trim().toLowerCase();
  const aria = (btn.getAttribute("aria-label") || "").trim().toLowerCase();
  if (txt === label || txt.startsWith(label) || aria === label || aria.startsWith(label + " ")) {
    return true;
  }
  if (label === "like") {
    return hints.includes("like") || hints.includes("react");
  }
  if (label === "send") {
    return (
      hints.includes("send") ||
      hints.includes("share") ||
      hints.includes("private message") ||
      hints.includes("paper plane")
    );
  }
  return hints.includes(label);
}

function isActionButton(btn) {
  return ACTION_LABELS.some((label) => matchesLabel(btn, label));
}

function queryActionCandidates(root) {
  return Array.from(root.querySelectorAll(SOCIAL_CONTROL_SEL)).filter(isActionButton);
}

let contextInvalidated = false;
let initialized = false;
let scanTimer = null;
let observer = null;
let scrollHandler = null;

function shutdownContentScript(reason) {
  if (contextInvalidated) return;
  contextInvalidated = true;
  if (observer) {
    observer.disconnect();
    observer = null;
  }
  if (scanTimer) {
    window.clearTimeout(scanTimer);
    scanTimer = null;
  }
  if (scrollHandler) {
    window.removeEventListener("scroll", scrollHandler);
    scrollHandler = null;
  }
  initialized = false;
  console.info(`[OneTap] Content script stopped (${reason}) — refresh this tab after updating the extension`);
}

function bgRequest(type, payload) {
  if (!isExtensionContextValid()) {
    shutdownContentScript("invalidated");
    return Promise.reject(new Error("Extension context invalidated"));
  }
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendMessage(payload ? { type, payload } : { type }, (res) => {
        if (chrome.runtime.lastError) {
          const msg = chrome.runtime.lastError.message || "Messaging failed";
          if (isContextInvalidatedError(msg)) {
            shutdownContentScript("invalidated");
          }
          reject(new Error(msg));
          return;
        }
        if (!res?.ok) {
          reject(new Error(res?.error || "Request failed"));
          return;
        }
        resolve(res.data);
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (isContextInvalidatedError(msg)) {
        shutdownContentScript("invalidated");
      }
      reject(err instanceof Error ? err : new Error(msg));
    }
  });
}

function scorePost(text, config) {
  const lower = text.toLowerCase();
  let score = 0;
  const emails = text.match(EMAIL_RE) || [];
  const blocked = (config.blockedEmailPrefixes || []).map((p) => p.toLowerCase());
  const validEmail = emails.find((e) => !blocked.some((b) => e.toLowerCase().startsWith(b)));
  if (validEmail) score += config.scoreEmail ?? 50;

  for (const kw of config.hiringKeywords || []) {
    if (lower.includes(String(kw).toLowerCase())) {
      score += config.scoreHiringKeyword ?? 30;
      break;
    }
  }
  for (const kw of config.applyKeywords || []) {
    if (lower.includes(String(kw).toLowerCase())) {
      score += config.scoreApplyKeyword ?? 20;
      break;
    }
  }
  return { score, email: validEmail || null };
}

const DEFAULT_DETECTION_CONFIG = {
  hiringKeywords: [
    "hiring",
    "we're hiring",
    "open role",
    "open position",
    "job opening",
    "now hiring",
    "join our team",
    "looking for",
  ],
  applyKeywords: [
    "apply",
    "application",
    "resume",
    "cv",
    "send your resume",
    "dm me",
    "email me",
    "reach out",
  ],
  blockedEmailPrefixes: ["noreply", "no-reply", "donotreply", "mailer-daemon"],
  scoreEmail: 50,
  scoreHiringKeyword: 30,
  scoreApplyKeyword: 20,
  threshold: 70,
};

async function getCachedConfig() {
  if (contextInvalidated || !isExtensionContextValid()) {
    return DEFAULT_DETECTION_CONFIG;
  }
  let stored;
  try {
    stored = await chrome.storage.local.get(["detectionConfig", "detectionConfigFetchedAt"]);
  } catch {
    if (!isExtensionContextValid()) shutdownContentScript("invalidated");
    return DEFAULT_DETECTION_CONFIG;
  }
  if (
    stored.detectionConfig &&
    stored.detectionConfigFetchedAt &&
    Date.now() - stored.detectionConfigFetchedAt < CONFIG_TTL_MS
  ) {
    return stored.detectionConfig;
  }
  try {
    const config = await bgRequest("DETECTION_CONFIG");
    await chrome.storage.local.set({
      detectionConfig: config,
      detectionConfigFetchedAt: Date.now(),
    });
    return config;
  } catch (err) {
    console.warn("[OneTap] detection config fetch failed — using defaults", err);
    return DEFAULT_DETECTION_CONFIG;
  }
}

async function isConnected() {
  if (contextInvalidated || !isExtensionContextValid()) return false;
  try {
    const ping = await bgRequest("ONETAP_PING");
    return Boolean(ping?.connected);
  } catch (err) {
    if (isContextInvalidatedError(err instanceof Error ? err.message : String(err))) {
      return false;
    }
    try {
      const { accessToken } = await chrome.storage.local.get("accessToken");
      return Boolean(accessToken);
    } catch {
      return false;
    }
  }
}

async function getSetupStatus() {
  const { cachedPopupStatus } = await chrome.storage.local.get("cachedPopupStatus");
  const cached = cachedPopupStatus?.setup;
  const cacheLooksCurrent =
    cached &&
    ("hasAiSetup" in cached || "canUseManagedAi" in cached);
  if (cacheLooksCurrent && isSetupCompleteFromStatus(cached)) {
    return cached;
  }

  try {
    const status = await bgRequest("POPUP_STATUS");
    return status.setup || null;
  } catch {
    try {
      return await bgRequest("SETUP_STATUS");
    } catch {
      return cached || null;
    }
  }
}

async function isSetupComplete() {
  return isSetupCompleteFromStatus(await getSetupStatus());
}

async function getApplyMode() {
  const { cachedPopupStatus } = await chrome.storage.local.get("cachedPopupStatus");
  if (cachedPopupStatus?.applyMode) {
    return cachedPopupStatus.applyMode;
  }
  try {
    const status = await bgRequest("POPUP_STATUS");
    return status.applyMode ?? "review_apply";
  } catch {
    return "review_apply";
  }
}

const EMAIL_TEST_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

function countDistinctEmails(el) {
  const matches = (el.innerText || "").match(EMAIL_RE);
  if (!matches) return 0;
  return new Set(matches.map((m) => m.toLowerCase())).size;
}

function countSocialButtons(el) {
  return queryActionCandidates(el).length;
}

function findPostContainer(emailEl) {
  let node = emailEl;
  let best = emailEl;
  let depth = 0;
  while (node && node !== document.body && depth < 16) {
    if (countDistinctEmails(node) >= 2) break;
    const len = (node.innerText || "").trim().length;
    if (len > 8000) break;
    best = node;
    if (len >= MIN_POST_TEXT_LEN && countSocialButtons(node) >= 2) break;
    node = node.parentElement;
    depth += 1;
  }
  return best;
}

function collectPostRoots() {
  if (!document.body) return [];
  const anchors = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
  let textNode;
  while ((textNode = walker.nextNode())) {
    const value = textNode.nodeValue;
    if (value && EMAIL_TEST_RE.test(value) && textNode.parentElement) {
      anchors.push(textNode.parentElement);
    }
  }

  const containers = [];
  for (const anchor of anchors) {
    const container = findPostContainer(anchor);

    for (let i = containers.length - 1; i >= 0; i--) {
      if (containers[i] !== container && containers[i].contains(container)) {
        containers.splice(i, 1);
      }
    }

    if (containers.some((c) => c !== container && container.contains(c))) {
      continue;
    }
    if (containers.includes(container)) {
      continue;
    }
    if ((container.innerText || "").length > MAX_POST_CONTAINER_TEXT) {
      continue;
    }
    containers.push(container);
  }
  return containers;
}

// The container is already a single post block (see findPostContainer), so its
// own text is the post body. LinkedIn's SDUI feed has no stable class hooks, so
// we deliberately read innerText instead of querying semantic selectors.
function extractPostText(container) {
  const raw = container.innerText?.trim() || "";
  return raw.length >= MIN_POST_TEXT_LEN ? raw : "";
}

// Permalinks are resolved from real anchor hrefs (URL-based, stable across
// LinkedIn redesigns). Falls back to the current page URL when a post has no
// dedicated permalink anchor (e.g. inline search results).
function extractPermalink(container) {
  const link = container.querySelector(
    'a[href*="/feed/update/"], a[href*="/posts/"]'
  );
  if (link?.href) {
    try {
      return new URL(link.href, location.origin).href;
    } catch {
      return link.href;
    }
  }
  return location.href;
}

// OneTap logomark (matches the website icon). Lives inside a 52x52 canvas so the
// progress ring + success checkmark can share the same coordinate space.
const ONETAP_MARK_PATH =
  "M20 44C31.0457 44 40 35.0457 40 24C40 12.9543 31.0457 4 20 4C8.95428 4 0 12.9543 0 24C0 35.0457 8.95428 44 20 44ZM26.2393 13.3168C26.543 12.2381 25.4961 11.6001 24.54 12.2813L11.1931 21.7896C10.1562 22.5283 10.3193 24 11.4381 24H14.9527V23.9728H21.8025L16.2212 25.9421L13.7607 34.6832C13.457 35.762 14.5038 36.3999 15.46 35.7187L28.8069 26.2105C29.8438 25.4718 29.6806 24 28.5619 24H23.2321L26.2393 13.3168Z";

const ONETAP_UI_VERSION = "0.1.26";

const ONETAP_STYLE_ID = `onetap-style-${ONETAP_UI_VERSION}`;

function ensureStyles() {
  document.querySelectorAll('[id^="onetap-style-"]').forEach((el) => el.remove());
  const style = document.createElement("style");
  style.id = ONETAP_STYLE_ID;
  style.textContent = `
[data-onetap-btn]{cursor:pointer;-webkit-tap-highlight-color:transparent;}
[data-onetap-btn]:disabled{cursor:default;}
.onetap-standalone{display:inline-flex;align-items:center;justify-content:center;width:48px;height:48px;padding:0;border:0;background:transparent;}
.onetap-standalone:hover{opacity:.9;}
.onetap-standalone:disabled:hover{opacity:1;}
.onetap-visual{position:relative;display:inline-flex;align-items:center;justify-content:center;width:48px;height:48px;}
.onetap-ico{display:block;overflow:visible;width:36px;height:36px;position:relative;}
.onetap-ico .ot-mark{fill:#2563eb;transition:opacity .25s ease;}
.onetap-ico .ot-ring{fill:none;stroke:#2563eb;stroke-width:3.5;stroke-linecap:round;opacity:0;transform:rotate(-90deg);transform-box:fill-box;transform-origin:center;transition:stroke .35s ease;}
.onetap-ico .ot-check{fill:none;stroke:#16a34a;stroke-width:4;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:40;stroke-dashoffset:40;opacity:0;}
.onetap-ico.is-loading .ot-mark{opacity:.2;}
.onetap-ico.is-loading .ot-ring{opacity:1;stroke-dasharray:36 145;animation:ot-spin .85s linear infinite;}
.onetap-ico.is-success{animation:ot-pop .45s ease both;}
.onetap-ico.is-success .ot-mark{opacity:0;}
.onetap-ico.is-success .ot-ring{opacity:1;stroke:#16a34a;stroke-dasharray:145;animation:ot-draw-ring .5s ease forwards;}
.onetap-ico.is-success .ot-check{opacity:1;animation:ot-draw-check .3s ease .42s forwards;}
.onetap-ico.is-error{animation:ot-shake .4s ease;}
.onetap-ico.is-error .ot-mark{fill:#dc2626;}
.onetap-action.is-error{opacity:.85;}
#onetap-linkedin-banner{position:fixed;top:52px;left:50%;transform:translateX(-50%);z-index:2147483646;display:flex;align-items:center;gap:10px;max-width:min(560px,calc(100vw - 24px));padding:10px 14px;border-radius:10px;background:#1e293b;color:#f8fafc;font:500 13px/1.4 system-ui,-apple-system,sans-serif;box-shadow:0 8px 24px rgba(15,23,42,.28);}
#onetap-linkedin-banner a{color:#93c5fd;text-decoration:none;font-weight:600;white-space:nowrap;}
#onetap-linkedin-banner a:hover{text-decoration:underline;}
#onetap-linkedin-banner button{margin-left:auto;padding:4px 10px;border:1px solid rgba(248,250,252,.25);border-radius:8px;background:transparent;color:#f8fafc;font:inherit;font-weight:600;cursor:pointer;}
#onetap-linkedin-banner button:hover{background:rgba(248,250,252,.08);}
@keyframes ot-spin{to{transform:rotate(360deg);}}
@keyframes ot-draw-ring{from{stroke-dashoffset:145;}to{stroke-dashoffset:0;}}
@keyframes ot-draw-check{from{stroke-dashoffset:40;}to{stroke-dashoffset:0;}}
@keyframes ot-pop{0%{transform:scale(.85);}55%{transform:scale(1.1);}100%{transform:scale(1);}}
@keyframes ot-shake{0%,100%{transform:translateX(0);}25%{transform:translateX(-3px);}75%{transform:translateX(3px);}}
`;
  (document.head || document.documentElement).appendChild(style);
}

const ICON_SVG = `
    <svg class="onetap-ico" viewBox="0 0 56 56" fill="none" aria-hidden="true">
      <g class="ot-mark" transform="translate(8,2)"><path fill-rule="evenodd" clip-rule="evenodd" d="${ONETAP_MARK_PATH}"/></g>
      <circle class="ot-ring" cx="28" cy="28" r="24"/>
      <path class="ot-check" d="M16 29 l7 7 l15 -15"/>
    </svg>
  `;

function buttonIconHtml() {
  return `<span class="onetap-visual">${ICON_SVG.trim()}</span>`;
}

function updateButtonIdleState(btn, autoApply) {
  if (btn.dataset.onetapAdded) return;
  const title = linkedInButtonTitle(autoApply);
  btn.title = title;
  btn.setAttribute("aria-label", title);
  btn.classList.remove("is-error");
}

async function refreshButtonApplyModeHints() {
  const autoApply = isAutoApplyMode(await getApplyMode());
  document.querySelectorAll("[data-onetap-btn]").forEach((btn) => {
    updateButtonIdleState(btn, autoApply);
  });
}

const LINKEDIN_BANNER_ID = "onetap-linkedin-banner";

function removeLinkedInBanner() {
  document.getElementById(LINKEDIN_BANNER_ID)?.remove();
}

function showLinkedInBanner(message, actionLabel, actionPath) {
  removeLinkedInBanner();
  const banner = document.createElement("div");
  banner.id = LINKEDIN_BANNER_ID;
  banner.setAttribute("role", "status");

  const text = document.createElement("span");
  text.textContent = message;
  banner.appendChild(text);

  if (actionLabel && actionPath) {
    const link = document.createElement("a");
    link.href = `${WEB_BASE}${actionPath}`;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = actionLabel;
    banner.appendChild(link);
  }

  const dismiss = document.createElement("button");
  dismiss.type = "button";
  dismiss.textContent = "Dismiss";
  dismiss.addEventListener("click", () => banner.remove());
  banner.appendChild(dismiss);

  document.documentElement.appendChild(banner);
}

async function refreshLinkedInBanner() {
  const connected = await isConnected();
  if (!connected) {
    showLinkedInBanner(
      "Connect OneTap to add jobs from LinkedIn.",
      "Connect extension",
      "/settings/extension"
    );
    return;
  }

  const setup = await getSetupStatus();
  if (!isSetupCompleteFromStatus(setup)) {
    const issues = setupIssuesFromStatus(setup);
    showLinkedInBanner(
      `Finish setup to apply: ${issues.map((issue) => issue.label).join(", ")}.`,
      "Complete setup",
      "/setup"
    );
    return;
  }

  removeLinkedInBanner();
}

// Standalone circular button — used when the action bar is found but no sibling
// item can be cloned, or as a last-resort when no social row exists.
function createStandaloneButton(autoApply) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.dataset.onetapBtn = "1";
  btn.dataset.onetapUiVersion = ONETAP_UI_VERSION;
  btn.className = "onetap-standalone";
  const title = linkedInButtonTitle(autoApply);
  btn.setAttribute("aria-label", title);
  btn.title = title;
  btn.innerHTML = buttonIconHtml();
  return btn;
}

const MIN_SOCIAL_IN_BAR = 2;
const MAX_ACTION_BAR_TEXT_LEN = 400;
const MAX_ACTION_BAR_CHILDREN = 14;

function isPlausibleActionBar(bar, postContainer, minSocial = MIN_SOCIAL_IN_BAR) {
  if (!bar || bar === postContainer) return false;
  if ((bar.innerText || "").length > MAX_ACTION_BAR_TEXT_LEN) return false;
  if (bar.childElementCount > MAX_ACTION_BAR_CHILDREN) return false;
  return queryActionCandidates(bar).length >= minSocial;
}

function findActionContainer(postContainer, candidates) {
  const valid = [];
  for (const btn of candidates) {
    let node = btn.parentElement;
    while (node && postContainer.contains(node)) {
      const socialCount = candidates.filter((c) => node.contains(c)).length;
      if (socialCount >= MIN_SOCIAL_IN_BAR) {
        valid.push({ node, socialCount });
      }
      node = node.parentElement;
    }
  }
  if (!valid.length) return null;

  const maxSocial = Math.max(...valid.map((v) => v.socialCount));
  const best = valid.filter((v) => v.socialCount === maxSocial);

  // Innermost row that still contains all social buttons (not the whole post card).
  for (const { node } of best) {
    let isInnermost = true;
    for (const { node: other } of best) {
      if (other !== node && node.contains(other)) {
        isInnermost = false;
        break;
      }
    }
    if (isInnermost && isPlausibleActionBar(node, postContainer)) {
      return node;
    }
  }
  return null;
}

function isReactionsSlot(el, index = -1, total = 0) {
  if (!el || el.dataset?.onetapItem) return false;
  const hints = slotHints(el);
  if (hints.includes("reaction")) return true;
  if (isSendSlot(el)) return false;
  if (el.matches("button, [role='button']")) {
    return hints.includes("reaction") || hints.includes("insights");
  }
  const text = (el.innerText || "").trim();
  if (/^\d+$/.test(text)) return false;
  // Left-side slots (avatar, etc.) — only match explicit reaction labels.
  if (index >= 0 && total > 0 && index < total - 3 && !hints.includes("reaction")) {
    return false;
  }
  const imgs = el.querySelectorAll("img, svg, li-icon");
  return imgs.length >= 1 && text.length < 50;
}

function slotHints(el) {
  return [el.getAttribute("aria-label"), el.getAttribute("title"), el.innerText]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function isSendSlot(el) {
  if (!el || el.dataset?.onetapItem) return false;
  const hints = controlHints(el);
  return hints.includes("send") || hints.includes("share");
}

function isSocialActionSlot(el) {
  if (!el || el.dataset?.onetapItem) return false;
  if (isReactionsSlot(el)) return false;
  if (isSendSlot(el)) return true;
  if (el.matches("button, [role='button'], a")) return true;
  return Boolean(el.querySelector("button, [role='button'], a"));
}

function isTrailingRightRailSlot(el, index, total) {
  if (!el || el.dataset?.onetapItem) return false;
  if (index < total - 2) return false;
  if (isSendSlot(el)) return false;

  const text = (el.innerText || "").trim();
  if (/^\d+$/.test(text)) return false;

  if (isReactionsSlot(el, index, total)) return true;

  // Trailing facepile link — often <a> with no aria/img when scanned early.
  if (el.tagName === "A") {
    const hints = slotHints(el);
    if (!hints.includes("send") && !hints.includes("share")) return true;
  }

  return false;
}

function findTrailingReactionsAnchor(container) {
  const children = Array.from(container.children).filter((c) => !c.dataset?.onetapItem);
  const total = children.length;
  const minIdx = Math.max(0, total - 3);
  let startIdx = -1;
  for (let i = total - 1; i >= 0; i--) {
    if (isTrailingRightRailSlot(children[i], i, total)) {
      startIdx = i;
    } else if (startIdx >= 0) {
      break;
    }
  }
  return startIdx >= minIdx ? children[startIdx] : null;
}

const WRAPPER_RAIL =
  "display:flex;align-items:center;justify-content:flex-end;flex:1 1 auto;min-width:40px;margin-left:auto;";

function findRightRailInsertAnchor(bar) {
  const trailingInBar = findTrailingReactionsAnchor(bar);
  if (trailingInBar) return { anchor: trailingInBar, mode: "before" };

  const parent = bar.parentElement;
  const trailingInParent = parent ? findTrailingReactionsAnchor(parent) : null;
  if (trailingInParent && parent && !bar.contains(trailingInParent)) {
    return { anchor: trailingInParent, mode: "before" };
  }

  return { anchor: bar, mode: "append" };
}

// Insert before trailing reactions, or append as last flex child when none exist.
function insertIntoActionBar(bar, allCandidates, node) {
  node.style.cssText = WRAPPER_RAIL;
  const point = findRightRailInsertAnchor(bar);

  if (point.mode === "before") {
    point.anchor.insertAdjacentElement("beforebegin", node);
    return;
  }

  point.anchor.appendChild(node);
}

function removeStaleOneTapUi(container) {
  for (const el of container.querySelectorAll("[data-onetap-item], [data-onetap-btn]")) {
    const root = el.closest("[data-onetap-item]") || el;
    if (root.dataset.onetapUiVersion !== ONETAP_UI_VERSION) {
      root.remove();
    }
  }
}

// LinkedIn's feed is SDUI with no stable class hooks, so we locate the social
// action row by its action buttons (Like/Comment/Repost/Send).
function findActionBarInfo(container) {
  const candidates = queryActionCandidates(container);
  if (candidates.length >= MIN_SOCIAL_IN_BAR) {
    const bar = findActionContainer(container, candidates);
    if (bar) return { bar, candidates };
  }

  if (candidates.length >= 1) {
    const bar = findLooseActionBar(container, candidates);
    if (bar) return { bar, candidates };
  }

  return null;
}

function findLooseActionBar(postContainer, candidates) {
  const anchor =
    candidates.find((c) => matchesLabel(c, "send")) || candidates[candidates.length - 1];
  let row = anchor?.parentElement;
  while (row && postContainer.contains(row)) {
    if (row !== postContainer && isPlausibleActionBar(row, postContainer, 1)) {
      return row;
    }
    row = row.parentElement;
  }
  return null;
}

function findLooseActionHost(postContainer, candidates) {
  const pool = candidates.length ? candidates : queryActionCandidates(postContainer);
  if (!pool.length) return null;

  const anchor = pool.find((c) => matchesLabel(c, "send")) || pool[pool.length - 1];
  let row = anchor.parentElement;
  while (row && postContainer.contains(row)) {
    const textLen = (row.innerText || "").length;
    if (
      row !== postContainer &&
      textLen <= MAX_ACTION_BAR_TEXT_LEN &&
      row.childElementCount <= MAX_ACTION_BAR_CHILDREN
    ) {
      return row;
    }
    row = row.parentElement;
  }
  return anchor.parentElement;
}

function insertIntoFallbackBar(container, node) {
  const host = findLooseActionHost(container, queryActionCandidates(container));
  if (!host) return false;
  node.style.cssText = WRAPPER_RAIL;
  host.appendChild(node);
  return true;
}

const MAX_POST_CONTAINER_TEXT = 2500;

function createInlineActionItem(autoApply) {
  const wrapper = document.createElement("div");
  wrapper.dataset.onetapItem = "1";
  wrapper.dataset.onetapUiVersion = ONETAP_UI_VERSION;
  const btn = createStandaloneButton(autoApply);
  wrapper.appendChild(btn);
  return { wrapper, btn };
}

async function injectButton(container, text, permalink, config) {
  removeStaleOneTapUi(container);
  if (container.querySelector("[data-onetap-btn]")) return;
  if ((container.innerText || "").length > MAX_POST_CONTAINER_TEXT) return;

  const { score, email } = scorePost(text, config);
  if (score < (config.threshold ?? 70)) return;

  ensureStyles();

  const autoApply = isAutoApplyMode(await getApplyMode());
  const barInfo = findActionBarInfo(container);
  const built = createInlineActionItem(autoApply);

  if (barInfo?.bar) {
    insertIntoActionBar(barInfo.bar, barInfo.candidates, built.wrapper);
  } else if (!insertIntoFallbackBar(container, built.wrapper)) {
    return;
  }

  wireButton(built.btn, text, permalink, email);
}

function wireButton(btn, text, permalink, email) {
  btn.addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (contextInvalidated || !isExtensionContextValid()) return;
    if (btn.dataset.busy) return;
    btn.dataset.busy = "1";
    btn.disabled = true;

    const ico = btn.querySelector(".onetap-ico");
    ico.classList.remove("is-error");
    btn.classList.remove("is-error");
    ico.classList.add("is-loading");

    const autoApply = isAutoApplyMode(await getApplyMode());

    try {
      await bgRequest("AUTO_APPLY", {
        jobDescription: text.slice(0, 10000),
        sourcePlatform: "linkedin",
        sourceUrl: permalink,
        sourceEmail: email || undefined,
        discoveredAt: new Date().toISOString(),
      });
      ico.classList.remove("is-loading");
      ico.classList.add("is-success");
      btn.dataset.onetapAdded = "1";
      const successTitle = linkedInSuccessTitle(autoApply);
      btn.title = successTitle;
      btn.setAttribute("aria-label", successTitle);
    } catch (err) {
      ico.classList.remove("is-loading");
      ico.classList.add("is-error");
      btn.classList.add("is-error");
      btn.disabled = false;
      delete btn.dataset.busy;
      const message = friendlyApplyError(err instanceof Error ? err.message : "Failed");
      btn.title = message;
      btn.setAttribute("aria-label", message);
      window.setTimeout(() => {
        ico.classList.remove("is-error");
        btn.classList.remove("is-error");
        updateButtonIdleState(btn, autoApply);
      }, 2500);
      console.error("[OneTap]", err);
    }
  });
}

function scanFeed(config) {
  if (contextInvalidated) return;
  const posts = collectPostRoots();
  posts.forEach((container) => {
    const text = extractPostText(container);
    if (!text) return;
    const permalink = extractPermalink(container);
    void injectButton(container, text, permalink, config);
  });
}

function scheduleScan(config) {
  if (contextInvalidated) return;
  if (scanTimer) window.clearTimeout(scanTimer);
  scanTimer = window.setTimeout(() => scanFeed(config), SCAN_DEBOUNCE_MS);
}

async function init() {
  if (contextInvalidated || initialized) return;
  if (!isExtensionContextValid()) {
    shutdownContentScript("invalidated");
    return;
  }

  await refreshLinkedInBanner();

  if (!(await isConnected())) {
    console.info("[OneTap] Not connected — connect via OneTap Settings");
    return;
  }
  if (!(await isSetupComplete())) {
    console.info("[OneTap] Setup incomplete — finish setup on the OneTap dashboard");
    return;
  }

  let config;
  try {
    config = await getCachedConfig();
  } catch (err) {
    console.error("[OneTap] Could not load detection config", err);
    config = DEFAULT_DETECTION_CONFIG;
  }
  initialized = true;
  console.info(`[OneTap] LinkedIn UI ${ONETAP_UI_VERSION} active`);
  scanFeed(config);
  void refreshButtonApplyModeHints();

  if (!observer && document.body) {
    observer = new MutationObserver(() => scheduleScan(config));
    observer.observe(document.body, { childList: true, subtree: true });
    scrollHandler = () => scheduleScan(config);
    window.addEventListener("scroll", scrollHandler, { passive: true });
  }
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (contextInvalidated || area !== "local") return;
  if (!isExtensionContextValid()) {
    shutdownContentScript("invalidated");
    return;
  }
  if (changes.accessToken) {
    initialized = false;
    init().catch((err) => console.error("[OneTap] re-init failed", err));
    return;
  }
  if (changes.cachedPopupStatus) {
    void refreshLinkedInBanner();
    void refreshButtonApplyModeHints();
    if (!initialized && isSetupCompleteFromStatus(changes.cachedPopupStatus.newValue?.setup)) {
      initialized = false;
      init().catch((err) => console.error("[OneTap] re-init failed", err));
    }
  }
});

init().catch((err) => console.error("[OneTap] init failed", err));

})().catch((err) => console.error("[OneTap] bootstrap failed", err));
