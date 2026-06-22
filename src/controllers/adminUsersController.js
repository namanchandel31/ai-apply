const { pool } = require("../db");
const { ok, error, ERROR_CODES } = require("../utils/response");
const { logError } = require("../utils/logger");
const adminUserModel = require("../models/adminUserModel");
const auditService = require("../services/auditService");

async function listAdminUsersController(req, res) {
  try {
    const search = req.query.search ? String(req.query.search) : "";
    const aiMode = req.query.aiMode ? String(req.query.aiMode) : "all";
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const days = Math.min(90, Math.max(1, Number(req.query.days) || 30));

    const { rows, total } = await adminUserModel.listUsersForAdmin({
      search,
      aiMode: aiMode === "all" ? null : aiMode,
      limit,
      offset,
      days,
    });

    return ok(res, {
      users: rows.map((r) => ({
        id: r.id,
        email: r.email,
        fullName: r.full_name,
        isBlocked: r.is_blocked,
        blockedReason: r.blocked_reason,
        planSlug: r.plan_slug,
        aiMode: r.ai_mode,
        applicationsSent: r.applications_sent,
        aiCost: Number(r.ai_cost || 0),
        primaryProvider: r.primary_provider,
        primaryModel: r.primary_model,
        adminBonusApplications: r.admin_bonus_applications,
        referralBonusApplications: r.referral_bonus_applications,
        createdAt: r.created_at,
      })),
      total,
      limit,
      offset,
      days,
    });
  } catch (err) {
    logError("ADMIN_USERS_LIST_ERROR", err, { reqId: req.requestId });
    return error(res, 500, err.message, ERROR_CODES.INTERNAL_ERROR);
  }
}

async function blockUserController(req, res) {
  try {
    const userId = req.params.userId;
    const blocked = req.body.blocked !== false;
    const reason = req.body.reason ? String(req.body.reason).trim() : null;

    const { rows: beforeRows } = await pool.query(
      `SELECT id, email, is_blocked, blocked_reason FROM users WHERE id = $1`,
      [userId]
    );
    if (!beforeRows[0]) return error(res, 404, "User not found", ERROR_CODES.NOT_FOUND);

    const row = await adminUserModel.setUserBlocked(userId, {
      blocked,
      reason: blocked ? reason : null,
      blockedAt: blocked ? new Date() : null,
    });
    if (!row) return error(res, 404, "User not found", ERROR_CODES.NOT_FOUND);

    await auditService.record({
      req,
      action: blocked ? "user.block" : "user.unblock",
      entityType: "users",
      entityId: userId,
      before: beforeRows[0],
      after: row,
    });
    return ok(res, { user: row });
  } catch (err) {
    logError("ADMIN_USER_BLOCK_ERROR", err, { reqId: req.requestId });
    return error(res, 500, err.message, ERROR_CODES.INTERNAL_ERROR);
  }
}

async function grantApplicationsController(req, res) {
  try {
    const userId = req.params.userId;
    const applicationsGranted = Number(req.body.applicationsGranted);
    const note = req.body.note ? String(req.body.note).trim() : null;

    if (!Number.isFinite(applicationsGranted) || applicationsGranted < 1) {
      return error(res, 400, "applicationsGranted must be a positive number", ERROR_CODES.BAD_REQUEST);
    }

    const grant = await adminUserModel.grantApplications(userId, {
      applicationsGranted: Math.floor(applicationsGranted),
      grantedBy: req.user.id,
      note,
    });

    await auditService.record({
      req,
      action: "user.grant_applications",
      entityType: "admin_application_grants",
      entityId: grant.id,
      before: null,
      after: grant,
    });
    return ok(res, { grant });
  } catch (err) {
    logError("ADMIN_USER_GRANT_ERROR", err, { reqId: req.requestId });
    return error(res, 500, err.message, ERROR_CODES.INTERNAL_ERROR);
  }
}

module.exports = {
  listAdminUsersController,
  blockUserController,
  grantApplicationsController,
};
