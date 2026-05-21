/**
 * High-confidence personalization from JD only — never hallucinate.
 */

const CONFIDENCE_THRESHOLD = 0.75;

function looksLikePersonName(name) {
  if (!name || typeof name !== "string") return false;
  const trimmed = name.trim();
  if (trimmed.length < 3 || trimmed.length > 60) return false;
  if (/@|\d|http/i.test(trimmed)) return false;
  const parts = trimmed.split(/\s+/);
  if (parts.length < 2 || parts.length > 4) return false;
  return parts.every((p) => /^[A-Za-z][A-Za-z.'-]*$/.test(p));
}

function extractMissionSnippet(rawText) {
  const text = String(rawText || "");
  const patterns = [
    /(?:about us|our mission|who we are)[:\s]*([^.!?\n]{20,200})/i,
    /(?:we are|we're)\s+([^.!?\n]{20,150})/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]) return { value: m[1].trim(), confidence: 0.78 };
  }
  return null;
}

function extractHiringManager(rawText) {
  const text = String(rawText || "");
  const m = text.match(
    /(?:hiring manager|reports to|contact)[:\s]*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})/i
  );
  if (m?.[1] && looksLikePersonName(m[1])) {
    return { value: m[1].trim(), confidence: 0.8 };
  }
  return null;
}

function extractInitiative(rawText) {
  const text = String(rawText || "");
  const patterns = [
    /(series [a-d]|recently launched|new platform|just raised|expanding team)/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[0]) return { value: m[0].trim(), confidence: 0.76 };
  }
  return null;
}

function extractProductMentions(parsedJd, rawText) {
  const fromTitle = parsedJd?.job_title ? [parsedJd.job_title] : [];
  const skills = (parsedJd?.skills || []).slice(0, 5);
  const combined = [...fromTitle, ...skills].filter(Boolean);
  if (combined.length) {
    return { value: combined, confidence: 0.7 };
  }
  return null;
}

function buildPersonalizationContext({ rawJdText, parsedJd }) {
  const fields = {};
  const used = [];

  if (parsedJd?.contact_person && looksLikePersonName(parsedJd.contact_person)) {
    fields.recruiterName = parsedJd.contact_person.trim();
    used.push("recruiterName");
  }

  const hm = extractHiringManager(rawJdText);
  if (hm && hm.confidence >= CONFIDENCE_THRESHOLD) {
    fields.hiringManagerName = hm.value;
    used.push("hiringManagerName");
  }

  const mission = extractMissionSnippet(rawJdText);
  if (mission && mission.confidence >= CONFIDENCE_THRESHOLD) {
    fields.companyMission = mission.value;
    used.push("companyMission");
  }

  const product = extractProductMentions(parsedJd, rawJdText);
  if (product && product.confidence >= CONFIDENCE_THRESHOLD && product.value?.length) {
    fields.techDomainReferences = product.value;
    used.push("techDomainReferences");
  }

  const initiative = extractInitiative(rawJdText);
  if (initiative && initiative.confidence >= CONFIDENCE_THRESHOLD) {
    fields.recentInitiative = initiative.value;
    used.push("recentInitiative");
  }

  if (parsedJd?.company_name) {
    fields.productMention = parsedJd.company_name;
    if (!used.includes("productMention")) used.push("productMention");
  }

  const personalizationContext = {};
  for (const [key, val] of Object.entries(fields)) {
    personalizationContext[key] = val;
  }

  return { personalizationContext, personalizationUsed: used };
}

module.exports = { buildPersonalizationContext, CONFIDENCE_THRESHOLD };
