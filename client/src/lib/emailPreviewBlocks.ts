export type ToneProfile = "casual" | "balanced" | "professional" | "executive";
export type StructureMode = "conversational" | "balanced" | "structured" | "highly_scannable";
export type LengthLabel = "short" | "medium" | "long";

const TONE_BLOCKS: Record<
  ToneProfile,
  { greeting: string; hook: string; cta: string; closing: string }
> = {
  casual: {
    greeting: "Hi Hiring Team,",
    hook: "I saw the Flutter Developer role and wanted to reach out. It looks like a strong match for my background.",
    cta: "Happy to chat if you think I could be a fit.",
    closing: "Best,",
  },
  balanced: {
    greeting: "Hi Hiring Team,",
    hook: "I am reaching out regarding the Flutter Developer opportunity at your company.",
    cta: "I would welcome a quick conversation about the role.",
    closing: "Best regards,",
  },
  professional: {
    greeting: "Hi Hiring Team,",
    hook: "I am reaching out regarding the Flutter Developer opportunity.",
    cta: "I would welcome the opportunity to discuss my background further.",
    closing: "Kind regards,",
  },
  executive: {
    greeting: "Dear Hiring Team,",
    hook: "I am writing to express my interest in the Flutter Developer position.",
    cta: "I would appreciate the opportunity to discuss how my experience aligns with your needs.",
    closing: "Sincerely,",
  },
};

const FIT_POINTS = [
  "5+ years of Flutter experience",
  "Firebase and backend integration",
  "Led production mobile applications",
  "Strong collaboration with product and design",
  "Experience shipping features end-to-end",
];

export function getToneBlock(profile: string) {
  return TONE_BLOCKS[profile as ToneProfile] || TONE_BLOCKS.balanced;
}

export function getFitPoints(count: number): string[] {
  return FIT_POINTS.slice(0, Math.max(2, Math.min(count, FIT_POINTS.length)));
}

export function formatFitBlock(
  structureMode: string,
  points: string[]
): string {
  if (structureMode === "highly_scannable" || structureMode === "structured") {
    return points.map((p) => `- ${p}`).join("\n");
  }
  if (structureMode === "conversational") {
    return `My background includes ${points.slice(0, 2).join(", ")}${points.length > 2 ? `, and ${points[2]}` : ""}.`;
  }
  return points.join(" ");
}

export function lengthToFitCount(label: LengthLabel): number {
  if (label === "short") return 2;
  if (label === "long") return 5;
  return 3;
}
