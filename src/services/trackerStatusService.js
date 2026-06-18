const crypto = require("crypto");
const { pool } = require("../db");

const TRACKER_COLORS = ["gray", "brown", "orange", "yellow", "green", "blue", "purple", "pink", "red"];

const EMAIL_READY_TRACKER_STATUS = {
  id: "ts_email_ready",
  name: "Email Ready",
  color: "blue",
  stage: 0,
  system: true,
};

const EMAIL_SENT_TRACKER_STATUS = {
  id: "ts_email_sent",
  name: "Email Sent",
  color: "green",
  stage: 1,
  system: true,
};

/** Default status options shown in Applications status picker. */
const SYSTEM_TRACKER_STATUSES = [
  EMAIL_READY_TRACKER_STATUS,
  EMAIL_SENT_TRACKER_STATUS,
  {
    id: "ts_screening",
    name: "Screening",
    color: "yellow",
    stage: 2,
    system: true,
  },
  {
    id: "ts_interviewing",
    name: "Interviewing",
    color: "orange",
    stage: 3,
    system: true,
  },
  {
    id: "ts_offer",
    name: "Offer",
    color: "purple",
    stage: 4,
    system: true,
  },
  {
    id: "ts_withdrawn",
    name: "Withdrawn",
    color: "brown",
    stage: 5,
    system: true,
  },
  {
    id: "ts_ghosted",
    name: "Ghosted",
    color: "gray",
    stage: 6,
    system: true,
  },
  {
    id: "ts_rejected",
    name: "Rejected",
    color: "red",
    stage: 7,
    system: true,
  },
  {
    id: "ts_accepted",
    name: "Accepted",
    color: "green",
    stage: 8,
    system: true,
  },
];

const SYSTEM_STATUS_IDS = new Set(SYSTEM_TRACKER_STATUSES.map((s) => s.id));
const LEGACY_STATUS_ID_REMAP = new Map([
  ["ts_applied", "ts_email_sent"],
  ["ts_interview", "ts_interviewing"],
  ["ts_first_interview", "ts_screening"],
  ["ts_second_interview", "ts_interviewing"],
]);

/** Legacy default ids replaced by the current status set. */
const LEGACY_DEFAULT_IDS = new Set([
  "ts_applied",
  "ts_interview",
  "ts_first_interview",
  "ts_second_interview",
  "ts_rejected",
]);

const DEFAULT_TRACKER_STATUS_OPTIONS = [...SYSTEM_TRACKER_STATUSES];

function remapLegacyStatusId(id) {
  return LEGACY_STATUS_ID_REMAP.get(id) ?? id;
}

function normalizeOptions(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((o) => o && typeof o.id === "string" && typeof o.name === "string")
    .map((o) => {
      const normalizedId = remapLegacyStatusId(o.id);
      const next = {
        id: normalizedId,
        name: String(o.name).trim(),
        color: TRACKER_COLORS.includes(o.color) ? o.color : "gray",
      };
      if (o.system === true || SYSTEM_STATUS_IDS.has(normalizedId)) {
        next.system = true;
        const systemDef = SYSTEM_TRACKER_STATUSES.find((s) => s.id === normalizedId);
        next.stage = systemDef?.stage ?? (typeof o.stage === "number" ? o.stage : null);
      } else if (typeof o.stage === "number") {
        next.stage = o.stage;
      }
      return next;
    })
    .filter((o) => o.name.length > 0);
}

function sortTrackerStatusOptions(options) {
  const system = options
    .filter((o) => o.system === true)
    .sort((a, b) => (a.stage ?? 0) - (b.stage ?? 0));
  const custom = options
    .filter((o) => o.system !== true)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  return [...system, ...custom];
}

function migrateLegacyOptions(options) {
  const customById = new Map();

  for (const opt of options) {
    const normalizedId = remapLegacyStatusId(opt.id);
    if (SYSTEM_STATUS_IDS.has(normalizedId)) continue;
    if (LEGACY_DEFAULT_IDS.has(opt.id)) continue;
    if (!customById.has(normalizedId)) {
      customById.set(normalizedId, {
        id: normalizedId,
        name: opt.name,
        color: opt.color,
        system: false,
      });
    }
  }

  return sortTrackerStatusOptions([...SYSTEM_TRACKER_STATUSES, ...customById.values()]);
}

function ensureSystemStatuses(options) {
  const migrated = migrateLegacyOptions(options);
  const hasAllSystem = SYSTEM_TRACKER_STATUSES.every((s) =>
    migrated.some((o) => o.id === s.id && o.system === true)
  );
  if (!hasAllSystem) {
    return migrateLegacyOptions(migrated);
  }
  return migrated;
}

async function persistTrackerStatusOptions(userId, options, client = pool) {
  await client.query(`UPDATE users SET tracker_status_options = $2::jsonb WHERE id = $1`, [
    userId,
    JSON.stringify(options),
  ]);
}

async function getTrackerStatusOptions(userId, client = pool) {
  const { rows } = await client.query(
    `SELECT tracker_status_options FROM users WHERE id = $1`,
    [userId]
  );
  let options = normalizeOptions(rows[0]?.tracker_status_options);
  if (!options.length) {
    options = DEFAULT_TRACKER_STATUS_OPTIONS;
    await persistTrackerStatusOptions(userId, options, client);
    await syncLegacyApplicationTrackerStatusIds(userId, client);
    await syncDefaultApplicationTrackerStatuses(userId, client);
    return options;
  }

  const merged = ensureSystemStatuses(options);
  const serialized = JSON.stringify(merged);
  const original = JSON.stringify(sortTrackerStatusOptions(options));
  if (serialized !== original) {
    await persistTrackerStatusOptions(userId, merged, client);
  }
  await syncLegacyApplicationTrackerStatusIds(userId, client);
  await syncDefaultApplicationTrackerStatuses(userId, client);
  return merged;
}

async function syncLegacyApplicationTrackerStatusIds(userId, client = pool) {
  const legacyIds = Array.from(LEGACY_STATUS_ID_REMAP.keys());
  if (!legacyIds.length) return;
  await client.query(
    `UPDATE applications
     SET tracker_status_id = CASE tracker_status_id
       WHEN 'ts_applied' THEN 'ts_email_sent'
       WHEN 'ts_interview' THEN 'ts_interviewing'
       WHEN 'ts_first_interview' THEN 'ts_screening'
       WHEN 'ts_second_interview' THEN 'ts_interviewing'
       ELSE tracker_status_id
     END,
     updated_at = NOW()
     WHERE user_id = $1
       AND tracker_status_id = ANY($2::text[])`,
    [userId, legacyIds]
  );
}

/** Backfill missing tracker statuses for existing applications. */
async function syncDefaultApplicationTrackerStatuses(userId, client = pool) {
  await client.query(
    `UPDATE applications
     SET tracker_status_id = CASE
       WHEN application_status = 'sent' THEN $2
       WHEN application_status = 'generated' THEN $3
       WHEN application_status = 'needs_review' THEN $3
       ELSE tracker_status_id
     END,
     updated_at = NOW()
     WHERE user_id = $1
       AND tracker_status_id IS NULL
       AND application_status IN ('sent', 'generated', 'needs_review')`,
    [userId, EMAIL_SENT_TRACKER_STATUS.id, EMAIL_READY_TRACKER_STATUS.id]
  );
}

async function createTrackerStatusOption(userId, { name, color }) {
  const trimmed = String(name || "").trim();
  if (!trimmed) {
    const err = new Error("Status name is required");
    err.code = "BAD_REQUEST";
    throw err;
  }
  if (trimmed.length > 48) {
    const err = new Error("Status name must be 48 characters or fewer");
    err.code = "BAD_REQUEST";
    throw err;
  }

  const options = await getTrackerStatusOptions(userId);
  const existing = options.find((o) => o.name.toLowerCase() === trimmed.toLowerCase());
  if (existing) return existing;

  const nextColor =
    color && TRACKER_COLORS.includes(color)
      ? color
      : TRACKER_COLORS[options.length % TRACKER_COLORS.length];

  const created = {
    id: `ts_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`,
    name: trimmed,
    color: nextColor,
    system: false,
  };

  const updated = sortTrackerStatusOptions([...options, created]);
  await pool.query(`UPDATE users SET tracker_status_options = $2::jsonb WHERE id = $1`, [
    userId,
    JSON.stringify(updated),
  ]);
  return created;
}

async function deleteTrackerStatusOption(userId, statusId) {
  const trimmed = String(statusId || "").trim();
  if (!trimmed) {
    const err = new Error("Status id is required");
    err.code = "BAD_REQUEST";
    throw err;
  }
  if (SYSTEM_STATUS_IDS.has(trimmed)) {
    const err = new Error("This status cannot be deleted");
    err.code = "BAD_REQUEST";
    throw err;
  }

  const options = await getTrackerStatusOptions(userId);
  const match = options.find((o) => o.id === trimmed);
  if (!match) {
    const err = new Error("Unknown tracker status");
    err.code = "NOT_FOUND";
    throw err;
  }

  const updated = options.filter((o) => o.id !== trimmed);
  await persistTrackerStatusOptions(userId, updated);

  await pool.query(
    `UPDATE applications
     SET tracker_status_id = NULL, updated_at = NOW()
     WHERE user_id = $1 AND tracker_status_id = $2`,
    [userId, trimmed]
  );

  return { id: trimmed, name: match.name };
}

async function setApplicationTrackerStatus(userId, applicationId, trackerStatusId) {
  const { rows: appRows } = await pool.query(
    `SELECT id FROM applications WHERE id = $1 AND user_id = $2`,
    [applicationId, userId]
  );
  if (!appRows.length) {
    const err = new Error("Application not found");
    err.code = "NOT_FOUND";
    throw err;
  }

  if (trackerStatusId == null || trackerStatusId === "") {
    await pool.query(
      `UPDATE applications SET tracker_status_id = NULL, updated_at = NOW()
       WHERE id = $1 AND user_id = $2`,
      [applicationId, userId]
    );
    return { trackerStatusId: null };
  }

  const options = await getTrackerStatusOptions(userId);
  const match = options.find((o) => o.id === trackerStatusId);
  if (!match) {
    const err = new Error("Unknown tracker status");
    err.code = "BAD_REQUEST";
    throw err;
  }

  await pool.query(
    `UPDATE applications SET tracker_status_id = $3, updated_at = NOW()
     WHERE id = $1 AND user_id = $2`,
    [applicationId, userId, trackerStatusId]
  );
  return { trackerStatusId };
}

function stageForStatusId(statusId, optionById) {
  if (statusId == null) return null;
  const option = optionById.get(statusId);
  if (option?.system === true && typeof option.stage === "number") {
    return option.stage;
  }
  return null;
}

async function getTrackerStatusSummary(userId, client = pool) {
  const options = await getTrackerStatusOptions(userId, client);
  const optionById = new Map(options.map((o) => [o.id, o]));

  const { rows } = await client.query(
    `SELECT tracker_status_id, COUNT(*)::int AS count
     FROM applications
     WHERE user_id = $1
     GROUP BY tracker_status_id`,
    [userId]
  );

  let total = 0;
  const buckets = [];
  const stageCounts = new Map();

  for (const row of rows) {
    const count = row.count ?? 0;
    if (count <= 0) continue;
    total += count;

    if (row.tracker_status_id == null) {
      buckets.push({
        statusId: null,
        name: "No status",
        color: "gray",
        count,
        system: false,
      });
      continue;
    }

    const option = optionById.get(row.tracker_status_id);
    const stage = stageForStatusId(row.tracker_status_id, optionById);
    if (stage != null) {
      stageCounts.set(stage, (stageCounts.get(stage) ?? 0) + count);
    }

    buckets.push({
      statusId: row.tracker_status_id,
      name: option?.name ?? "Unknown",
      color: option?.color ?? "gray",
      count,
      system: option?.system === true,
      stage: stage ?? null,
    });
  }

  buckets.sort((a, b) => b.count - a.count);

  const funnel = SYSTEM_TRACKER_STATUSES.map((systemDef) => {
    const stage = systemDef.stage;
    let cumulativeCount = 0;
    for (const [s, c] of stageCounts.entries()) {
      if (s >= stage) cumulativeCount += c;
    }
    const currentCount = stageCounts.get(stage) ?? 0;
    return {
      statusId: systemDef.id,
      name: systemDef.name,
      color: systemDef.color,
      stage,
      cumulativeCount,
      currentCount,
    };
  });

  const sideBuckets = buckets.filter((b) => {
    if (b.statusId == null) return true;
    return b.system !== true;
  });

  return { total, buckets, funnel, sideBuckets };
}

module.exports = {
  TRACKER_COLORS,
  EMAIL_READY_TRACKER_STATUS,
  EMAIL_SENT_TRACKER_STATUS,
  SYSTEM_TRACKER_STATUSES,
  SYSTEM_STATUS_IDS,
  DEFAULT_TRACKER_STATUS_OPTIONS,
  getTrackerStatusOptions,
  createTrackerStatusOption,
  deleteTrackerStatusOption,
  getTrackerStatusSummary,
  setApplicationTrackerStatus,
  sortTrackerStatusOptions,
  syncDefaultApplicationTrackerStatuses,
};
