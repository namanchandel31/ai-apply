import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type EmailPreferencesData } from "@/lib/api";
import { trackPreferencesUpdated } from "@/lib/emailPreferenceEvents";
import {
  EMAIL_LENGTH_OPTIONS,
  EMAIL_TONE_OPTIONS,
  mapStructureMode,
  mapToneProfile,
  resolveLengthOption,
  resolvePresetFromLevels,
  resolveToneOption,
  structureForLengthOption,
  toneForToneOption,
  type LengthOptionId,
  type PresetId,
  type ToneOptionId,
} from "@/lib/emailPreferencePresets";

export const EMAIL_PREFS_QUERY_KEY = ["email-preferences"] as const;

const PATCH_DEBOUNCE_MS = 400;

const DEFAULT_TONE_LEVEL = 50;
const DEFAULT_STRUCTURE_LEVEL = 50;

type PatchPayload = {
  emailToneLevel: number;
  emailStructureLevel: number;
};

function buildOptimisticPreferences(
  _prev: EmailPreferencesData | undefined,
  payload: PatchPayload
): EmailPreferencesData {
  const { emailToneLevel, emailStructureLevel } = payload;
  return {
    emailToneLevel,
    emailStructureLevel,
    selectedPreset: resolvePresetFromLevels(emailToneLevel, emailStructureLevel),
    toneProfile: mapToneProfile(emailToneLevel),
    structureMode: mapStructureMode(emailStructureLevel),
  };
}

function payloadsEqual(a: PatchPayload | null, b: PatchPayload | null): boolean {
  if (!a || !b) return false;
  return a.emailToneLevel === b.emailToneLevel && a.emailStructureLevel === b.emailStructureLevel;
}

export function useEmailPreferences() {
  const queryClient = useQueryClient();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPayloadRef = useRef<PatchPayload | null>(null);
  const lastSentRef = useRef<PatchPayload | null>(null);
  const initializedRef = useRef(false);
  const [patchError, setPatchError] = useState<Error | null>(null);

  const { data: emailPrefs, isLoading } = useQuery({
    queryKey: EMAIL_PREFS_QUERY_KEY,
    queryFn: async () => {
      const res = await api.getEmailPreferences();
      return res.data;
    },
  });

  const toneLevel = emailPrefs?.emailToneLevel ?? DEFAULT_TONE_LEVEL;
  const structureLevel = emailPrefs?.emailStructureLevel ?? DEFAULT_STRUCTURE_LEVEL;

  const lengthOption = resolveLengthOption(structureLevel);
  const toneOption = resolveToneOption(toneLevel);

  const lengthLabel =
    EMAIL_LENGTH_OPTIONS.find((o) => o.id === lengthOption)?.label ?? "Medium";
  const toneLabel = EMAIL_TONE_OPTIONS.find((o) => o.id === toneOption)?.label ?? "Balanced";

  const patchMutation = useMutation({
    mutationFn: (body: PatchPayload) => api.patchEmailPreferences(body),
    onSuccess: (res) => {
      setPatchError(null);
      queryClient.setQueryData(EMAIL_PREFS_QUERY_KEY, res.data);
      lastSentRef.current = {
        emailToneLevel: res.data.emailToneLevel,
        emailStructureLevel: res.data.emailStructureLevel,
      };
      trackPreferencesUpdated({
        emailToneLevel: res.data.emailToneLevel,
        emailStructureLevel: res.data.emailStructureLevel,
        selectedPreset: res.data.selectedPreset as PresetId,
      });
    },
    onError: async (err: Error) => {
      setPatchError(err);
      const optimistic = queryClient.getQueryData<EmailPreferencesData>(EMAIL_PREFS_QUERY_KEY);
      try {
        const res = await api.getEmailPreferences();
        queryClient.setQueryData(EMAIL_PREFS_QUERY_KEY, {
          ...res.data,
          emailToneLevel: optimistic?.emailToneLevel ?? res.data.emailToneLevel,
          emailStructureLevel: optimistic?.emailStructureLevel ?? res.data.emailStructureLevel,
          selectedPreset: resolvePresetFromLevels(
            optimistic?.emailToneLevel ?? res.data.emailToneLevel,
            optimistic?.emailStructureLevel ?? res.data.emailStructureLevel
          ),
          toneProfile: mapToneProfile(optimistic?.emailToneLevel ?? res.data.emailToneLevel),
          structureMode: mapStructureMode(
            optimistic?.emailStructureLevel ?? res.data.emailStructureLevel
          ),
        });
      } catch {
        // Keep optimistic cache on background refetch failure
      }
    },
    onSettled: () => {
      const pending = pendingPayloadRef.current;
      const sent = lastSentRef.current;
      if (pending && !payloadsEqual(pending, sent)) {
        flushPatchRef.current();
      }
    },
  });

  const flushPatch = useCallback(() => {
    const pending = pendingPayloadRef.current;
    if (!pending) return;
    if (payloadsEqual(pending, lastSentRef.current)) return;
    if (patchMutation.isPending) return;

    patchMutation.mutate(pending);
  }, [patchMutation]);

  const flushPatchRef = useRef(flushPatch);
  flushPatchRef.current = flushPatch;

  const schedulePatch = useCallback((payload: PatchPayload) => {
    pendingPayloadRef.current = payload;

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      flushPatchRef.current();
    }, PATCH_DEBOUNCE_MS);
  }, []);

  const applyOptimistic = useCallback(
    (payload: PatchPayload) => {
      queryClient.setQueryData<EmailPreferencesData>(EMAIL_PREFS_QUERY_KEY, (prev) =>
        buildOptimisticPreferences(prev, payload)
      );
      schedulePatch(payload);
    },
    [queryClient, schedulePatch]
  );

  const setLengthOption = useCallback(
    (id: LengthOptionId) => {
      const current = queryClient.getQueryData<EmailPreferencesData>(EMAIL_PREFS_QUERY_KEY);
      const nextStructure = structureForLengthOption(id);
      applyOptimistic({
        emailToneLevel: current?.emailToneLevel ?? DEFAULT_TONE_LEVEL,
        emailStructureLevel: nextStructure,
      });
    },
    [applyOptimistic, queryClient]
  );

  const setToneOption = useCallback(
    (id: ToneOptionId) => {
      const current = queryClient.getQueryData<EmailPreferencesData>(EMAIL_PREFS_QUERY_KEY);
      const nextTone = toneForToneOption(id);
      applyOptimistic({
        emailToneLevel: nextTone,
        emailStructureLevel: current?.emailStructureLevel ?? DEFAULT_STRUCTURE_LEVEL,
      });
    },
    [applyOptimistic, queryClient]
  );

  useEffect(() => {
    if (emailPrefs && !initializedRef.current) {
      lastSentRef.current = {
        emailToneLevel: emailPrefs.emailToneLevel,
        emailStructureLevel: emailPrefs.emailStructureLevel,
      };
      initializedRef.current = true;
    }
  }, [emailPrefs]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return useMemo(
    () => ({
      toneLevel,
      structureLevel,
      toneOption,
      lengthOption,
      toneLabel,
      lengthLabel,
      setToneOption,
      setLengthOption,
      isSaving: patchMutation.isPending,
      isLoading,
      error: patchError,
    }),
    [
      toneLevel,
      structureLevel,
      toneOption,
      lengthOption,
      toneLabel,
      lengthLabel,
      setToneOption,
      setLengthOption,
      patchMutation.isPending,
      isLoading,
      patchError,
    ]
  );
}
