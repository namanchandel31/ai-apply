import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Mail, Star } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { composeEmailPreview } from "@/lib/composeEmailPreview";
import {
  EMAIL_PREFERENCE_PRESETS,
  RECOMMENDED_PRESET_ID,
  formatStructureBucketLabel,
  formatToneBucketLabel,
  getPresetDisplayName,
  resolvePresetFromLevels,
  type PresetId,
} from "@/lib/emailPreferencePresets";
import { trackPresetSelected, trackPreferencesUpdated } from "@/lib/emailPreferenceEvents";
import { EmailPreferenceSlider } from "@/components/EmailPreferenceSlider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const QUERY_KEY = ["email-preferences"] as const;
const SETUP_BOX_RADIUS = "rounded-sm";

type Props = {
  /** default = full Setup onboarding; compact = Dashboard quick controls */
  variant?: "default" | "compact";
};

function CurrentStyleBlock({
  presetId,
  compact = false,
}: {
  presetId: PresetId;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <p className="text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Current style: </span>
        {getPresetDisplayName(presetId)}
      </p>
    );
  }
  return (
    <div className="space-y-1">
      <p className="text-base font-normal text-muted-foreground">Current style</p>
      <p className="text-base font-medium text-foreground">{getPresetDisplayName(presetId)}</p>
    </div>
  );
}

export function EmailPreferencesCard({ variant = "default" }: Props) {
  const isCompact = variant === "compact";
  const queryClient = useQueryClient();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const res = await api.getEmailPreferences();
      return res.data;
    },
  });

  const [tone, setTone] = useState(50);
  const [structure, setStructure] = useState(60);

  useEffect(() => {
    if (data) {
      setTone(data.emailToneLevel);
      setStructure(data.emailStructureLevel);
    }
  }, [data]);

  const patchMutation = useMutation({
    mutationFn: (body: { emailToneLevel: number; emailStructureLevel: number }) =>
      api.patchEmailPreferences(body),
    onSuccess: (res) => {
      queryClient.setQueryData(QUERY_KEY, res.data);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to save preferences");
    },
  });

  const schedulePatch = useCallback(
    (nextTone: number, nextStructure: number) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        patchMutation.mutate(
          { emailToneLevel: nextTone, emailStructureLevel: nextStructure },
          {
            onSuccess: (res) => {
              trackPreferencesUpdated({
                emailToneLevel: res.data.emailToneLevel,
                emailStructureLevel: res.data.emailStructureLevel,
                selectedPreset: res.data.selectedPreset as PresetId,
              });
            },
          }
        );
      }, 400);
    },
    [patchMutation]
  );

  const selectedPreset = resolvePresetFromLevels(tone, structure);

  const preview = useMemo(
    () =>
      isCompact
        ? null
        : composeEmailPreview({ emailToneLevel: tone, emailStructureLevel: structure }),
    [isCompact, tone, structure]
  );

  const applyPreset = (preset: (typeof EMAIL_PREFERENCE_PRESETS)[number]) => {
    setTone(preset.tone);
    setStructure(preset.structure);
    trackPresetSelected(preset.id);
    patchMutation.mutate(
      { emailToneLevel: preset.tone, emailStructureLevel: preset.structure },
      {
        onSuccess: (res) => {
          queryClient.setQueryData(QUERY_KEY, res.data);
          trackPreferencesUpdated({
            emailToneLevel: res.data.emailToneLevel,
            emailStructureLevel: res.data.emailStructureLevel,
            selectedPreset: preset.id,
          });
        },
      }
    );
  };

  const sliders = (
    <div className={cn("space-y-3", isCompact && "space-y-2.5")}>
      <EmailPreferenceSlider
        label="Tone"
        value={tone}
        minEndpoint="Casual"
        maxEndpoint="Executive"
        bucketLabel={formatToneBucketLabel(tone)}
        compact={isCompact}
        onValueChange={(v) => {
          setTone(v);
          schedulePatch(v, structure);
        }}
      />
      <EmailPreferenceSlider
        label="Structure"
        value={structure}
        minEndpoint="Conversational"
        maxEndpoint={isCompact ? "Scannable" : "Highly Scannable"}
        bucketLabel={formatStructureBucketLabel(structure)}
        compact={isCompact}
        onValueChange={(v) => {
          setStructure(v);
          schedulePatch(tone, v);
        }}
      />
    </div>
  );

  if (isLoading && !data) {
    return (
      <Card className={isCompact ? undefined : SETUP_BOX_RADIUS}>
        <CardContent className={cn("flex items-center justify-center", isCompact ? "py-8" : "py-12")}>
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (isCompact) {
    return (
      <Card>
        <CardHeader className="space-y-0 px-4 py-3">
          <CardTitle className="text-sm font-semibold">Email style</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2.5 px-4 pb-3 pt-0">
          <CurrentStyleBlock presetId={selectedPreset} compact />
          {sliders}
          {patchMutation.isPending && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              Saving…
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={SETUP_BOX_RADIUS}>
      <CardHeader className="gap-1">
        <CardTitle className="flex items-center gap-2 text-base font-medium">
          <Mail className="h-5 w-5" />
          Email style
        </CardTitle>
        <CardDescription>
          Choose how application emails sound and how they are laid out. These settings apply to
          every new email you generate. Use presets for a quick start, then fine-tune with the
          sliders.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <CurrentStyleBlock presetId={selectedPreset} />

        <div className="flex flex-wrap gap-2">
          {EMAIL_PREFERENCE_PRESETS.map((preset) => {
            const active = selectedPreset === preset.id;
            const recommended = preset.id === RECOMMENDED_PRESET_ID;
            return (
              <Button
                key={preset.id}
                type="button"
                variant={active ? "default" : "outline"}
                className={cn(SETUP_BOX_RADIUS, recommended && !active && "ring-1 ring-ring/30")}
                onClick={() => applyPreset(preset)}
              >
                {recommended && <Star className="mr-1 h-3 w-3 fill-current" aria-hidden />}
                {preset.label}
                {recommended && (
                  <span className="ml-1 text-base uppercase tracking-wide opacity-80">
                    Recommended
                  </span>
                )}
              </Button>
            );
          })}
        </div>

        {sliders}

        {preview && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-base">
              <span className="font-medium">Preview</span>
              <span className="text-muted-foreground capitalize">
                Estimated length: {preview.lengthLabel}
              </span>
            </div>
            <pre className={cn("whitespace-pre-wrap border bg-muted/30 p-4 text-base leading-relaxed font-sans", SETUP_BOX_RADIUS)}>
              {preview.body}
            </pre>
            <p className="text-base text-muted-foreground">
              Preview is educational, not predictive. Actual emails are tailored to each job by AI.
            </p>
          </div>
        )}

        {patchMutation.isPending && (
          <p className="text-base text-muted-foreground flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Saving…
          </p>
        )}
      </CardContent>
    </Card>
  );
}
