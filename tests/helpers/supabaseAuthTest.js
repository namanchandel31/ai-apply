const TEST_INTERNAL_USER_ID = "550e8400-e29b-41d4-a716-446655440000";
const TEST_SUPABASE_USER_ID = "660e8400-e29b-41d4-a716-446655440001";

/**
 * Install auth test doubles before requiring the Express app.
 */
function installSupabaseAuthTestMocks() {
  jest.mock("../../src/services/supabaseJwtVerifier", () => ({
    verifySupabaseAccessToken: jest.fn().mockResolvedValue({
      sub: TEST_SUPABASE_USER_ID,
      email: "security-test@example.com",
      fullName: "Security Test",
      avatarUrl: null,
      emailVerified: true,
    }),
  }));

  jest.mock("../../src/services/userMeService", () => ({
    buildUserMeResponse: jest.fn().mockResolvedValue({
      id: TEST_INTERNAL_USER_ID,
      email: "security-test@example.com",
      fullName: "Security Test",
      avatarUrl: null,
      subscriptionTier: "free",
      flags: {},
      createdAt: new Date().toISOString(),
    }),
  }));

  jest.mock("../../src/services/userSyncService", () => ({
    ensureLocalUser: jest.fn().mockResolvedValue({
      id: TEST_INTERNAL_USER_ID,
      supabase_user_id: TEST_SUPABASE_USER_ID,
      email: "security-test@example.com",
      full_name: "Security Test",
      avatar_url: null,
    }),
    touchLastLogin: jest.fn().mockResolvedValue(undefined),
    resetUserSyncStateForTests: jest.fn(),
  }));
}

module.exports = {
  TEST_INTERNAL_USER_ID,
  TEST_SUPABASE_USER_ID,
  installSupabaseAuthTestMocks,
};
