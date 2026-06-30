const {
  findBySupabaseUserId,
  findUnmappedUsersByEmail,
  updateUserProfileFromSupabase,
  insertNewUserFromSupabase,
} = require("../src/models/userModel");
const { ensureLocalUser } = require("../src/services/userSyncService");
const { extractProfileFromClaims } = require("../src/services/supabaseJwtVerifier");

jest.mock("../src/models/userModel", () => ({
  findBySupabaseUserId: jest.fn(),
  findUnmappedUsersByEmail: jest.fn(),
  updateUserProfileFromSupabase: jest.fn(),
  insertNewUserFromSupabase: jest.fn(),
  touchUserLastLogin: jest.fn(),
  getUserById: jest.fn(),
  getUserDefaults: jest.fn(),
  setUserDefaults: jest.fn(),
  autoPopulateDefaultResume: jest.fn(),
}));

describe("supabaseJwtVerifier profile extraction", () => {
  it("maps Google user_metadata to profile fields", () => {
    const profile = extractProfileFromClaims({
      sub: "sub-1",
      email: "a@example.com",
      email_verified: true,
      user_metadata: {
        full_name: "Jane Doe",
        avatar_url: "https://example.com/a.png",
      },
    });
    expect(profile.email).toBe("a@example.com");
    expect(profile.fullName).toBe("Jane Doe");
    expect(profile.avatarUrl).toBe("https://example.com/a.png");
  });
});

jest.mock("../src/observability/posthogAnalytics", () => ({
  trackUserSignedUp: jest.fn(),
}));

describe("userSyncService.ensureLocalUser", () => {
  const claims = {
    sub: "660e8400-e29b-41d4-a716-446655440001",
    email: "legacy@example.com",
    fullName: "Legacy User",
    avatarUrl: null,
  };

  const linkedRow = {
    id: "550e8400-e29b-41d4-a716-446655440000",
    supabase_user_id: claims.sub,
    email: claims.email,
    full_name: claims.fullName,
    avatar_url: null,
    created_at: new Date().toISOString(),
    last_login_at: new Date().toISOString(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("updates existing row when supabase_user_id is already linked (preserves internal id)", async () => {
    findBySupabaseUserId.mockResolvedValue(linkedRow);
    updateUserProfileFromSupabase.mockResolvedValue(linkedRow);

    const { user: row } = await ensureLocalUser(claims);

    expect(findBySupabaseUserId).toHaveBeenCalledWith(claims.sub);
    expect(updateUserProfileFromSupabase).toHaveBeenCalledWith(linkedRow.id, {
      email: claims.email,
      fullName: claims.fullName,
      avatarUrl: null,
    });
    expect(insertNewUserFromSupabase).not.toHaveBeenCalled();
    expect(row.id).toBe(linkedRow.id);
  });

  it("refuses auto-insert when one unmapped legacy user shares the email", async () => {
    findBySupabaseUserId.mockResolvedValue(null);
    findUnmappedUsersByEmail.mockResolvedValue([
      { id: "550e8400-e29b-41d4-a716-446655440000", email: claims.email },
    ]);

    await expect(ensureLocalUser(claims)).rejects.toMatchObject({
      code: "LEGACY_USER_PENDING_MANUAL_LINK",
      internalUserId: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(insertNewUserFromSupabase).not.toHaveBeenCalled();
  });

  it("inserts new user when no linked or unmapped legacy row exists", async () => {
    findBySupabaseUserId.mockResolvedValue(null);
    findUnmappedUsersByEmail.mockResolvedValue([]);
    insertNewUserFromSupabase.mockResolvedValue({
      ...linkedRow,
      id: "770e8400-e29b-41d4-a716-446655440002",
      created_at: new Date().toISOString(),
    });

    const { user: row } = await ensureLocalUser(claims);

    expect(insertNewUserFromSupabase).toHaveBeenCalled();
    expect(row.id).toBe("770e8400-e29b-41d4-a716-446655440002");
  });
});
