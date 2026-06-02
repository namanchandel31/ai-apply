const {
  resolvePresetFromLevels,
  mapToneProfile,
  mapStructureMode,
  resolveEmailPreferences,
  buildGenerationSnapshot,
  buildEmailPreferencesResponse,
} = require("../src/services/emailPreferenceMapper");

describe("resolvePresetFromLevels", () => {
  it("resolves known presets", () => {
    expect(resolvePresetFromLevels(55, 75)).toBe("recruiter_friendly");
    expect(resolvePresetFromLevels(50, 60)).toBe("balanced");
  });

  it("returns custom for non-matching levels", () => {
    expect(resolvePresetFromLevels(55, 76)).toBe("custom");
  });
});

describe("tone and structure buckets", () => {
  it("maps tone boundaries", () => {
    expect(mapToneProfile(20)).toBe("casual");
    expect(mapToneProfile(21)).toBe("balanced");
    expect(mapToneProfile(80)).toBe("professional");
    expect(mapToneProfile(81)).toBe("executive");
  });

  it("maps structure boundaries", () => {
    expect(mapStructureMode(20)).toBe("conversational");
    expect(mapStructureMode(51)).toBe("structured");
    expect(mapStructureMode(81)).toBe("highly_scannable");
  });
});

describe("buildGenerationSnapshot", () => {
  it("includes version 1 and no length label", () => {
    const resolved = resolveEmailPreferences({
      emailToneLevel: 55,
      emailStructureLevel: 75,
    });
    const snap = buildGenerationSnapshot(resolved);
    expect(snap.version).toBe(1);
    expect(snap.selectedPreset).toBe("recruiter_friendly");
    expect(snap.targetWordRange).toMatchObject({ min: expect.any(Number), max: expect.any(Number) });
    expect(snap.estimatedLengthLabel).toBeUndefined();
  });
});

describe("buildEmailPreferencesResponse", () => {
  it("does not include recommendedPreset", () => {
    const res = buildEmailPreferencesResponse({ emailToneLevel: 55, emailStructureLevel: 75 });
    expect(res.recommendedPreset).toBeUndefined();
    expect(res.selectedPreset).toBe("recruiter_friendly");
    expect(res.toneProfile).toBe("professional");
  });
});
