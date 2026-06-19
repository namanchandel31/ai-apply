const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const CONFIG_TTL_MS = 60 * 60 * 1000;
const SCAN_DEBOUNCE_MS = 400;
const MIN_POST_TEXT_LEN = 40;

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

async function getCachedConfig() {
  const stored = await chrome.storage.local.get(["detectionConfig", "detectionConfigFetchedAt"]);
  if (
    stored.detectionConfig &&
    stored.detectionConfigFetchedAt &&
    Date.now() - stored.detectionConfigFetchedAt < CONFIG_TTL_MS
  ) {
    return stored.detectionConfig;
  }
  const config = await bgRequest("DETECTION_CONFIG");
  await chrome.storage.local.set({
    detectionConfig: config,
    detectionConfigFetchedAt: Date.now(),
  });
  return config;
}

async function isConnected() {
  try {
    const ping = await bgRequest("ONETAP_PING");
    return Boolean(ping?.connected);
  } catch {
    const { accessToken } = await chrome.storage.local.get("accessToken");
    return Boolean(accessToken);
  }
}

async function isSetupComplete() {
  const { cachedPopupStatus } = await chrome.storage.local.get("cachedPopupStatus");
  if (cachedPopupStatus?.setup) {
    const s = cachedPopupStatus.setup;
    return Boolean(s.hasValidResume && s.hasEmailSetup && s.hasVerifiedAiCredential);
  }
  try {
    const status = await bgRequest("POPUP_STATUS");
    const s = status.setup;
    return Boolean(s?.hasValidResume && s?.hasEmailSetup && s?.hasVerifiedAiCredential);
  } catch {
    try {
      const status = await bgRequest("SETUP_STATUS");
      return Boolean(
        status.hasValidResume && status.hasEmailSetup && status.hasVerifiedAiCredential
      );
    } catch {
      return false;
    }
  }
}

const EMAIL_TEST_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

function countDistinctEmails(el) {
  const matches = (el.innerText || "").match(EMAIL_RE);
  if (!matches) return 0;
  return new Set(matches.map((m) => m.toLowerCase())).size;
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
    node = node.parentElement;
    depth += 1;
  }
  return best;
}

function collectPostRoots() {
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
    if (
      containers.some(
        (c) => c === container || c.contains(container) || container.contains(c)
      )
    ) {
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

const ONETAP_STYLE_ID = "onetap-style";

function ensureStyles() {
  if (document.getElementById(ONETAP_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = ONETAP_STYLE_ID;
  style.textContent = `
[data-onetap-btn]{cursor:pointer;-webkit-tap-highlight-color:transparent;}
[data-onetap-btn]:disabled{cursor:default;}
.onetap-standalone{display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;padding:0;border:0;border-radius:50%;background:transparent;transition:background .2s ease;}
.onetap-standalone:hover{background:rgba(37,99,235,.10);}
.onetap-standalone:disabled:hover{background:transparent;}
.onetap-action{display:inline-flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;background:transparent;}
.onetap-action .onetap-label{font-weight:600;font-size:14px;line-height:1;color:var(--color-text-low-emphasis,rgba(0,0,0,.6));}
.onetap-ico{display:block;overflow:visible;}
.onetap-standalone .onetap-ico{width:28px;height:28px;}
.onetap-action .onetap-ico{width:20px;height:20px;}
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
@keyframes ot-spin{to{transform:rotate(360deg);}}
@keyframes ot-draw-ring{from{stroke-dashoffset:145;}to{stroke-dashoffset:0;}}
@keyframes ot-draw-check{from{stroke-dashoffset:40;}to{stroke-dashoffset:0;}}
@keyframes ot-pop{0%{transform:scale(.85);}55%{transform:scale(1.1);}100%{transform:scale(1);}}
@keyframes ot-shake{0%,100%{transform:translateX(0);}25%{transform:translateX(-3px);}75%{transform:translateX(3px);}}
`;
  (document.head || document.documentElement).appendChild(style);
}

const ICON_SVG = `
    <svg class="onetap-ico" viewBox="0 0 52 52" fill="none" aria-hidden="true">
      <g class="ot-mark" transform="translate(6,2)"><path fill-rule="evenodd" clip-rule="evenodd" d="${ONETAP_MARK_PATH}"/></g>
      <circle class="ot-ring" cx="26" cy="26" r="23"/>
      <path class="ot-check" d="M15 27 l7 7 l15 -15"/>
    </svg>
  `;

// Standalone circular button — fallback used only when the post's action bar
// can't be located (e.g. detail views without a Like/Comment/Repost/Send row).
function createStandaloneButton() {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.dataset.onetapBtn = "1";
  btn.className = "onetap-standalone";
  btn.setAttribute("aria-label", "Add to OneTap");
  btn.title = "Add to OneTap";
  btn.innerHTML = ICON_SVG;
  return btn;
}

const ACTION_LABELS = ["like", "comment", "repost", "send"];

function matchesLabel(btn, label) {
  const txt = (btn.innerText || "").trim().toLowerCase();
  const aria = (btn.getAttribute("aria-label") || "").trim().toLowerCase();
  return (
    txt === label || txt.startsWith(label) || aria === label || aria.startsWith(label + " ")
  );
}

function isActionButton(btn) {
  return ACTION_LABELS.some((label) => matchesLabel(btn, label));
}

// LinkedIn's feed is SDUI with no stable class hooks, so we locate the social
// action bar by its action buttons (Like/Comment/Repost/Send) and return one of
// their items to clone. Cloning inherits LinkedIn's exact flex + padding, so our
// button slots in as an equal 5th action with matching spacing.
function findActionBarInfo(container) {
  const candidates = Array.from(container.querySelectorAll("button")).filter(
    isActionButton
  );
  if (candidates.length < 3) return null;

  let bar = candidates[0].parentElement;
  while (bar && bar !== container.parentElement) {
    if (candidates.filter((c) => bar.contains(c)).length >= 3) break;
    bar = bar.parentElement;
  }
  if (!bar) return null;

  const inBar = candidates.filter((c) => bar.contains(c));
  if (inBar.length < 3) return null;

  // Prefer a structurally simple action to clone — Send/Repost sometimes carry
  // dropdown triggers, while Comment/Like are plain buttons.
  const reference =
    inBar.find((b) => matchesLabel(b, "comment")) ||
    inBar.find((b) => matchesLabel(b, "like")) ||
    inBar[0];

  let item = reference;
  while (item.parentElement && item.parentElement !== bar) {
    item = item.parentElement;
  }
  if (item.parentElement !== bar) return null;

  return { bar, item };
}

// Clone a sibling action item for exact layout parity, then swap its contents
// for the OneTap icon + label. Only the blue circular icon hints at the brand;
// everything else (size, padding, hover) is inherited from LinkedIn.
function createActionButton(item) {
  const wrapper = item.cloneNode(true);
  wrapper.removeAttribute("id");
  wrapper.querySelectorAll("[id]").forEach((n) => n.removeAttribute("id"));
  wrapper.dataset.onetapItem = "1";

  const btn = wrapper.matches("button") ? wrapper : wrapper.querySelector("button");
  if (!btn) return null;

  wrapper.querySelectorAll("button").forEach((b) => {
    if (b !== btn) b.remove();
  });

  btn.setAttribute("type", "button");
  btn.dataset.onetapBtn = "1";
  btn.classList.add("onetap-action");
  btn.setAttribute("aria-label", "Add to OneTap");
  btn.title = "Add to OneTap";
  btn.removeAttribute("aria-pressed");
  btn.innerHTML = `${ICON_SVG}<span class="onetap-label">OneTap</span>`;

  return { wrapper, btn };
}

function injectButton(container, text, permalink, config) {
  if (container.querySelector("[data-onetap-btn]")) return;

  const { score, email } = scorePost(text, config);
  if (score < (config.threshold ?? 70)) return;

  ensureStyles();

  let btn = null;
  const barInfo = findActionBarInfo(container);
  if (barInfo) {
    const built = createActionButton(barInfo.item);
    if (built) {
      barInfo.bar.appendChild(built.wrapper);
      btn = built.btn;
    }
  }

  if (!btn) {
    const row = document.createElement("div");
    row.dataset.onetapRow = "1";
    row.style.cssText = "padding:2px 6px 6px;";
    btn = createStandaloneButton();
    row.appendChild(btn);
    container.appendChild(row);
  }

  wireButton(btn, text, permalink, email);
}

function wireButton(btn, text, permalink, email) {
  btn.addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (btn.dataset.busy) return;
    btn.dataset.busy = "1";
    btn.disabled = true;

    const ico = btn.querySelector(".onetap-ico");
    const label = btn.querySelector(".onetap-label");
    ico.classList.remove("is-error");
    ico.classList.add("is-loading");

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
      if (label) label.textContent = "Added";
      btn.title = "Added to OneTap";
      btn.setAttribute("aria-label", "Added to OneTap");
    } catch (err) {
      ico.classList.remove("is-loading");
      ico.classList.add("is-error");
      btn.disabled = false;
      delete btn.dataset.busy;
      if (label) label.textContent = "OneTap";
      btn.title = err instanceof Error ? err.message : "Failed — tap to retry";
      window.setTimeout(() => ico.classList.remove("is-error"), 600);
      console.error("[OneTap]", err);
    }
  });
}

function scanFeed(config) {
  const posts = collectPostRoots();
  posts.forEach((container) => {
    const text = extractPostText(container);
    if (!text) return;
    const permalink = extractPermalink(container);
    injectButton(container, text, permalink, config);
  });
}

let scanTimer = null;
function scheduleScan(config) {
  if (scanTimer) window.clearTimeout(scanTimer);
  scanTimer = window.setTimeout(() => scanFeed(config), SCAN_DEBOUNCE_MS);
}

let initialized = false;
let observer = null;

async function init() {
  if (initialized) return;

  if (!(await isConnected())) {
    console.info("[OneTap] Not connected — connect via OneTap Settings");
    return;
  }
  if (!(await isSetupComplete())) {
    console.info("[OneTap] Setup incomplete — finish setup on the OneTap dashboard");
    return;
  }

  const config = await getCachedConfig();
  initialized = true;
  scanFeed(config);

  if (!observer) {
    observer = new MutationObserver(() => scheduleScan(config));
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("scroll", () => scheduleScan(config), { passive: true });
  }
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes.accessToken || changes.cachedPopupStatus) {
    initialized = false;
    init().catch((err) => console.error("[OneTap] re-init failed", err));
  }
});

init().catch((err) => console.error("[OneTap] init failed", err));
