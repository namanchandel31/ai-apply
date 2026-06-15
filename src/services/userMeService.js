const { getUserById } = require("../models/userModel");

/**
 * Build /api/user/me response from verified local user id.
 */
async function buildUserMeResponse(userId) {
  const row = await getUserById(userId);
  if (!row) {
    const err = new Error("User not found");
    err.code = "NOT_FOUND";
    throw err;
  }

  return {
    id: row.id,
    email: row.email,
    firstName: row.first_name ?? null,
    lastName: row.last_name ?? null,
    fullName: row.full_name ?? null,
    avatarUrl: row.avatar_url ?? null,
    applyMode: row.apply_mode ?? "review_apply",
    subscriptionTier: "free",
    isAdmin: row.is_admin === true,
    flags: {},
    createdAt: row.created_at,
  };
}

module.exports = {
  buildUserMeResponse,
};
