const { JdLlmOutputSchema, createEmptyLlmContract } = require("../domain/jd/jdParseContract");

const NULL_STRINGS = new Set(["null", "none", "n/a", "na", "undefined", ""]);

function coerceString(value) {
  if (value == null) return null;
  if (typeof value !== "string") return String(value).trim() || null;
  const trimmed = value.trim();
  if (NULL_STRINGS.has(trimmed.toLowerCase())) return null;
  return trimmed || null;
}

function coerceStringArray(value) {
  if (value == null) return [];
  if (typeof value === "string") {
    return value
      .split(/[,;|]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (!Array.isArray(value)) return [];
  return value
    .flatMap((item) => {
      if (typeof item === "string") return [item.trim()];
      if (item && typeof item === "object" && item.name) return [String(item.name).trim()];
      return [];
    })
    .filter(Boolean);
}

const JOB_TYPE_MAP = {
  remote: "Remote",
  hybrid: "Hybrid",
  onsite: "Onsite",
  "on-site": "Onsite",
  "on site": "Onsite",
  unknown: "Unknown",
};

function coerceJobType(value) {
  const s = coerceString(value);
  if (!s) return null;
  const mapped = JOB_TYPE_MAP[s.toLowerCase()];
  if (mapped) return mapped;
  if (["Remote", "Hybrid", "Onsite", "Unknown"].includes(s)) return s;
  return null;
}

/**
 * Normalize provider-specific JSON into the JD parse contract.
 * @param {unknown} raw
 * @param {{ provider?: string, model?: string }} meta
 */
function normalizeProviderPayload(raw, meta = {}) {
  const base = createEmptyLlmContract();
  if (!raw || typeof raw !== "object") {
    return { data: base, rawLlmResponse: raw ?? null, provider: meta };
  }

  const obj = /** @type {Record<string, unknown>} */ (raw);
  const nested =
    obj.parsed && typeof obj.parsed === "object"
      ? obj.parsed
      : obj.data && typeof obj.data === "object"
        ? obj.data
        : obj;

  const source = /** @type {Record<string, unknown>} */ (
    typeof nested === "object" && nested ? nested : obj
  );

  const roles = [
    ...coerceStringArray(source.roles),
    ...coerceStringArray(source.role_candidates),
    ...coerceStringArray(source.open_positions),
  ];

  const normalized = {
    job_title: coerceString(source.job_title ?? source.title ?? source.position),
    roles: [...new Set(roles)],
    company_name: coerceString(source.company_name ?? source.company),
    contact_person: coerceString(source.contact_person ?? source.recruiter),
    location: coerceString(source.location),
    contact_email: coerceString(source.contact_email ?? source.email),
    contact_number: coerceString(source.contact_number ?? source.phone),
    job_type: coerceJobType(source.job_type ?? source.work_mode),
    skills: coerceStringArray(source.skills ?? source.technologies ?? source.tech_stack),
  };

  const validation = JdLlmOutputSchema.safeParse(normalized);
  const data = validation.success ? validation.data : base;

  return {
    data,
    rawLlmResponse: raw,
    provider: { name: meta.provider, model: meta.model },
  };
}

module.exports = {
  normalizeProviderPayload,
  coerceString,
  coerceStringArray,
};
