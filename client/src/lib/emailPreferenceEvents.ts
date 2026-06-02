import type { PresetId } from "@/lib/emailPreferencePresets";

export function trackEmailPreferenceEvent(
  name: "email_preset_selected" | "email_preferences_updated",
  props?: Record<string, string | number | boolean>
) {
  if (import.meta.env.DEV) {
    console.info("[email-preferences]", name, props ?? {});
  }
  window.dispatchEvent(
    new CustomEvent("onetap:email-preferences", { detail: { name, props } })
  );
}

export function trackPresetSelected(preset: Exclude<PresetId, "custom">) {
  trackEmailPreferenceEvent("email_preset_selected", { preset });
}

export function trackPreferencesUpdated(payload: {
  emailToneLevel: number;
  emailStructureLevel: number;
  selectedPreset: PresetId;
}) {
  trackEmailPreferenceEvent("email_preferences_updated", payload);
}
