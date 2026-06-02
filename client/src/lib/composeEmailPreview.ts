import {
  deriveLengthLabel,
  mapStructureMode,
  mapToneProfile,
  previewTargetWordRange,
} from "@/lib/emailPreferencePresets";
import {
  formatFitBlock,
  getFitPoints,
  getToneBlock,
  lengthToFitCount,
  type LengthLabel,
} from "@/lib/emailPreviewBlocks";

export function composeEmailPreview({
  emailToneLevel,
  emailStructureLevel,
  candidateName = "Candidate Name",
}: {
  emailToneLevel: number;
  emailStructureLevel: number;
  candidateName?: string;
}) {
  const toneProfile = mapToneProfile(emailToneLevel);
  const structureMode = mapStructureMode(emailStructureLevel);
  const range = previewTargetWordRange(structureMode);
  const lengthLabel = deriveLengthLabel(range.min, range.max) as LengthLabel;
  const tone = getToneBlock(toneProfile);
  const fitPoints = getFitPoints(lengthToFitCount(lengthLabel));
  const fit = formatFitBlock(structureMode, fitPoints);

  const resumeLine =
    structureMode === "conversational"
      ? "I have attached my resume for your review."
      : "I have attached my resume for your consideration.";

  let body: string;
  if (structureMode === "conversational") {
    body = [
      tone.greeting,
      "",
      tone.hook,
      "",
      fit,
      "",
      resumeLine,
      "",
      tone.cta,
      "",
      tone.closing,
      candidateName,
    ].join("\n");
  } else if (structureMode === "highly_scannable" || structureMode === "structured") {
    body = [
      tone.greeting,
      "",
      tone.hook,
      "",
      fit,
      "",
      resumeLine,
      "",
      tone.cta,
      "",
      tone.closing,
      candidateName,
    ].join("\n");
  } else {
    body = [
      tone.greeting,
      "",
      tone.hook,
      "",
      fit,
      "",
      `${resumeLine} ${tone.cta}`,
      "",
      tone.closing,
      candidateName,
    ].join("\n");
  }

  return {
    body,
    toneProfile,
    structureMode,
    lengthLabel,
    targetWordRange: range,
  };
}
