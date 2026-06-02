const {
  inferSeniorityBand,
  deriveTargetWordRange,
} = require("./emailLengthStrategy");

const SNAPSHOT_VERSION = 1;

const EMAIL_PREFERENCE_PRESETS = [
  { id: "recruiter_friendly", tone: 55, structure: 75 },
  { id: "balanced", tone: 50, structure: 60 },
  { id: "startup_friendly", tone: 35, structure: 45 },
  { id: "highly_professional", tone: 80, structure: 80 },
  { id: "executive_style", tone: 95, structure: 90 },
];

function clampLevel(n, fallback = 50) {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(0, Math.min(100, Math.round(v)));
}

function mapToneProfile(level) {
  const l = clampLevel(level);
  if (l <= 20) return "casual";
  if (l <= 50) return "balanced";
  if (l <= 80) return "professional";
  return "executive";
}

function mapStructureMode(level) {
  const l = clampLevel(level);
  if (l <= 20) return "conversational";
  if (l <= 50) return "balanced";
  if (l <= 80) return "structured";
  return "highly_scannable";
}

function resolvePresetFromLevels(emailToneLevel, emailStructureLevel) {
  const tone = clampLevel(emailToneLevel);
  const structure = clampLevel(emailStructureLevel);
  const match = EMAIL_PREFERENCE_PRESETS.find(
    (p) => p.tone === tone && p.structure === structure
  );
  return match ? match.id : "custom";
}

function blendToneContext(jdTone, toneProfile) {
  if (!jdTone) return { toneProfile };
  const formalityHint = {
    casual: "warmer and slightly informal while staying professional",
    balanced: "friendly professional, direct and approachable",
    professional: "concise business tone, precise and respectful",
    executive: "formal, measured, authoritative without fluff",
  }[toneProfile] || "balanced professional";

  return {
    ...jdTone,
    userToneProfile: toneProfile,
    communicationTone: `${jdTone.communicationTone}; user preference: ${formalityHint}`,
  };
}

function resolveEmailPreferences({
  emailToneLevel = 50,
  emailStructureLevel = 60,
  job,
  candidate,
  resumeParsedJson,
}) {
  const toneLevel = clampLevel(emailToneLevel, 50);
  const structureLevel = clampLevel(emailStructureLevel, 60);
  const toneProfile = mapToneProfile(toneLevel);
  const structureMode = mapStructureMode(structureLevel);
  const seniorityBand = inferSeniorityBand({
    jobTitle: job?.title,
    resumeParsedJson: resumeParsedJson || { experience: candidate?.experience },
  });
  const targetWordRange = deriveTargetWordRange(structureMode, seniorityBand);
  const selectedPreset = resolvePresetFromLevels(toneLevel, structureLevel);

  return {
    emailToneLevel: toneLevel,
    emailStructureLevel: structureLevel,
    toneProfile,
    structureMode,
    seniorityBand,
    targetWordRange,
    selectedPreset,
  };
}

function buildGenerationSnapshot(resolved) {
  return {
    version: SNAPSHOT_VERSION,
    toneLevel: resolved.emailToneLevel,
    toneProfile: resolved.toneProfile,
    structureLevel: resolved.emailStructureLevel,
    structureMode: resolved.structureMode,
    selectedPreset: resolved.selectedPreset,
    seniorityBand: resolved.seniorityBand,
    targetWordRange: resolved.targetWordRange,
  };
}

function buildEmailPreferencesResponse(levels) {
  const resolved = resolveEmailPreferences({
    emailToneLevel: levels.emailToneLevel,
    emailStructureLevel: levels.emailStructureLevel,
  });
  return {
    emailToneLevel: resolved.emailToneLevel,
    emailStructureLevel: resolved.emailStructureLevel,
    selectedPreset: resolved.selectedPreset,
    toneProfile: resolved.toneProfile,
    structureMode: resolved.structureMode,
  };
}

module.exports = {
  SNAPSHOT_VERSION,
  EMAIL_PREFERENCE_PRESETS,
  clampLevel,
  mapToneProfile,
  mapStructureMode,
  resolvePresetFromLevels,
  blendToneContext,
  resolveEmailPreferences,
  buildGenerationSnapshot,
  buildEmailPreferencesResponse,
};
