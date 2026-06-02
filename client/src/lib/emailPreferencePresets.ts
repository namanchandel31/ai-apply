export type PresetId =
  | "balanced"
  | "recruiter_friendly"
  | "startup_friendly"
  | "highly_professional"
  | "executive_style"
  | "custom";

export const RECOMMENDED_PRESET_ID: PresetId = "recruiter_friendly";

export type EmailPreferencePreset = {
  id: Exclude<PresetId, "custom">;
  label: string;
  tone: number;
  structure: number;
};

/** UI display order — recommended preset first. */
export const EMAIL_PREFERENCE_PRESETS: EmailPreferencePreset[] = [
  { id: "recruiter_friendly", label: "Recruiter Friendly", tone: 55, structure: 75 },
  { id: "balanced", label: "Balanced", tone: 50, structure: 60 },
  { id: "startup_friendly", label: "Startup Friendly", tone: 35, structure: 45 },
  { id: "highly_professional", label: "Highly Professional", tone: 80, structure: 80 },
  { id: "executive_style", label: "Executive Style", tone: 95, structure: 90 },
];

export function resolvePresetFromLevels(
  emailToneLevel: number,
  emailStructureLevel: number
): PresetId {
  const match = EMAIL_PREFERENCE_PRESETS.find(
    (p) => p.tone === emailToneLevel && p.structure === emailStructureLevel
  );
  return match ? match.id : "custom";
}

export function mapToneProfile(level: number): string {
  if (level <= 20) return "casual";
  if (level <= 50) return "balanced";
  if (level <= 80) return "professional";
  return "executive";
}

export function mapStructureMode(level: number): string {
  if (level <= 20) return "conversational";
  if (level <= 50) return "balanced";
  if (level <= 80) return "structured";
  return "highly_scannable";
}

const TONE_BUCKET_LABELS: Record<string, string> = {
  casual: "Casual",
  balanced: "Balanced",
  professional: "Professional",
  executive: "Executive",
};

const STRUCTURE_BUCKET_LABELS: Record<string, string> = {
  conversational: "Conversational",
  balanced: "Balanced",
  structured: "Structured",
  highly_scannable: "Highly Scannable",
};

export function formatToneBucketLabel(level: number): string {
  return TONE_BUCKET_LABELS[mapToneProfile(level)] ?? "Balanced";
}

export function formatStructureBucketLabel(level: number): string {
  return STRUCTURE_BUCKET_LABELS[mapStructureMode(level)] ?? "Balanced";
}

export function getPresetDisplayName(presetId: PresetId): string {
  if (presetId === "custom") return "Custom";
  const preset = EMAIL_PREFERENCE_PRESETS.find((p) => p.id === presetId);
  return preset?.label ?? "Custom";
}

export function deriveLengthLabel(min: number, max: number): "short" | "medium" | "long" {
  const mid = (min + max) / 2;
  if (mid < 130) return "short";
  if (mid < 175) return "medium";
  return "long";
}

/** Illustrative target ranges for preview (mid seniority). */
export function previewTargetWordRange(structureMode: string): { min: number; max: number } {
  const table: Record<string, [number, number]> = {
    conversational: [100, 140],
    balanced: [120, 180],
    structured: [140, 200],
    highly_scannable: [160, 220],
  };
  const [min, max] = table[structureMode] || table.balanced;
  return { min, max };
}
