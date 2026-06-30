const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;
const STORAGE_KEY = "onetap_attribution";

export type Attribution = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  referral_code?: string;
  signup_source?: string;
};

function readStored(): Attribution {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Attribution) : {};
  } catch {
    return {};
  }
}

function writeStored(data: Attribution) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function captureAttributionFromUrl(search: string): Attribution {
  const params = new URLSearchParams(search);
  const stored = readStored();
  const next: Attribution = { ...stored };

  for (const key of UTM_KEYS) {
    const v = params.get(key);
    if (v) next[key] = v;
  }

  const ref = params.get("ref");
  if (ref) next.referral_code = ref.trim().toUpperCase();

  if (next.referral_code) next.signup_source = "referral";
  else if (next.utm_source) next.signup_source = "utm";
  else if (!next.signup_source) next.signup_source = "organic";

  writeStored(next);
  return next;
}

export function getAttribution(): Attribution {
  return readStored();
}

export function getWorkflowId(): string {
  const key = "onetap_workflow_id";
  let id = sessionStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(key, id);
  }
  return id;
}

export function resetWorkflowId() {
  sessionStorage.removeItem("onetap_workflow_id");
}
