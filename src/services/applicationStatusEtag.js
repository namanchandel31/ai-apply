const crypto = require("crypto");

/**
 * Build a stable fingerprint string from bundle row columns (no serialize).
 */
function buildSnapshotFingerprint(row) {
  if (!row) return "";
  const parts = [
    row.application_status ?? "",
    row.review_reason ?? "",
    String(row.retry_count ?? 0),
    String(row.orchestration_version ?? 0),
    String(row.orchestration_epoch ?? 0),
    row.updated_at ? new Date(row.updated_at).toISOString() : "",
    row.match_score != null ? String(row.match_score) : "",
  ];
  return parts.join("|");
}

function buildStatusFingerprint(row) {
  if (!row) return "";
  const parts = [
    row.application_status ?? "",
    row.review_reason ?? "",
    String(row.retry_count ?? 0),
    String(row.orchestration_version ?? 0),
    String(row.orchestration_epoch ?? 0),
    row.updated_at ? new Date(row.updated_at).toISOString() : "",
    row.process_job_status ?? "",
    row.process_job_updated_at
      ? new Date(row.process_job_updated_at).toISOString()
      : "",
    row.send_job_status ?? "",
    row.send_job_updated_at ? new Date(row.send_job_updated_at).toISOString() : "",
    row.match_score != null ? String(row.match_score) : "",
  ];
  return parts.join("|");
}

function computeStatusEtag(fingerprint) {
  const hash = crypto.createHash("sha256").update(fingerprint).digest("hex").slice(0, 32);
  return `W/"${hash}"`;
}

function etagMatches(ifNoneMatch, etag) {
  if (!ifNoneMatch || !etag) return false;
  const candidates = ifNoneMatch.split(",").map((s) => s.trim());
  return candidates.includes(etag) || candidates.includes("*");
}

function parseIfNoneMatch(header) {
  if (!header || typeof header !== "string") return null;
  return header.trim() || null;
}

module.exports = {
  buildStatusFingerprint,
  buildSnapshotFingerprint,
  computeStatusEtag,
  etagMatches,
  parseIfNoneMatch,
};
