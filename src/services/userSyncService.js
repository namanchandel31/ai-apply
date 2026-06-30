const {
  findBySupabaseUserId,
  findUnmappedUsersByEmail,
  updateUserProfileFromSupabase,
  insertNewUserFromSupabase,
  touchUserLastLogin,
} = require("../models/userModel");
const { logAuthSyncFailed } = require("./authObservability");
const { trackUserSignedUp } = require("../observability/posthogAnalytics");

const LOGIN_TOUCH_DEBOUNCE_MS = 5 * 60 * 1000;
const lastTouchByUserId = new Map();

/**
 * Resolve local user by supabase_user_id — preserves existing users.id for manual links.
 * Does not create a duplicate when a legacy row awaits manual mapping (same email).
 *
 * @param {{ sub: string, email: string, fullName?: string|null, avatarUrl?: string|null }} claims
 * @param {{ attribution?: Record<string, string> }} [opts]
 * @returns {Promise<{ user: object, isNewSignup: boolean }>}
 */
async function ensureLocalUser(claims, opts = {}) {
  try {
    const profile = {
      email: claims.email,
      fullName: claims.fullName ?? null,
      avatarUrl: claims.avatarUrl ?? null,
    };

    const linked = await findBySupabaseUserId(claims.sub);
    if (linked) {
      const user = await updateUserProfileFromSupabase(linked.id, profile);
      return { user, isNewSignup: false };
    }

    const unmapped = await findUnmappedUsersByEmail(claims.email);
    if (unmapped.length === 1) {
      const err = new Error(
        "Legacy account must be manually linked to this Google sign-in before API access. " +
          "See docs/migrations/supabase-auth-legacy-user-linking.md"
      );
      err.code = "LEGACY_USER_PENDING_MANUAL_LINK";
      err.internalUserId = unmapped[0].id;
      throw err;
    }
    if (unmapped.length > 1) {
      const err = new Error("Multiple legacy users share this email; resolve manually before sign-in");
      err.code = "LEGACY_USER_AMBIGUOUS_EMAIL";
      throw err;
    }

    const user = await insertNewUserFromSupabase({
      supabaseUserId: claims.sub,
      ...profile,
    });

    const createdMs = user.created_at ? Date.now() - new Date(user.created_at).getTime() : Infinity;
    const isNewSignup = createdMs >= 0 && createdMs < 10_000;
    if (isNewSignup) {
      trackUserSignedUp(user.id, {
        signup_method: "google",
        ...opts.attribution,
      });
    }

    return { user, isNewSignup };
  } catch (err) {
    if (err.code !== "LEGACY_USER_PENDING_MANUAL_LINK" && err.code !== "LEGACY_USER_AMBIGUOUS_EMAIL") {
      logAuthSyncFailed({
        supabaseUserId: claims.sub,
        requestId: null,
        errorClass: err?.name || "Error",
      });
    }
    throw err;
  }
}

/**
 * Debounced last_login_at touch (reduces write churn on SSE-heavy sessions).
 */
async function touchLastLogin(userId) {
  const now = Date.now();
  const last = lastTouchByUserId.get(userId) ?? 0;
  if (now - last < LOGIN_TOUCH_DEBOUNCE_MS) return;
  lastTouchByUserId.set(userId, now);
  await touchUserLastLogin(userId);
}

function resetUserSyncStateForTests() {
  lastTouchByUserId.clear();
}

module.exports = {
  ensureLocalUser,
  touchLastLogin,
  resetUserSyncStateForTests,
};
