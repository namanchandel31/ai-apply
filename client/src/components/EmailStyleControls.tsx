import { Loader2 } from "lucide-react";
import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  EMAIL_LENGTH_OPTIONS,
  EMAIL_TONE_OPTIONS,
  type LengthOptionId,
  type ToneOptionId,
} from "@/lib/emailPreferencePresets";
import { cn } from "@/lib/utils";

type Props = {
  lengthOption: LengthOptionId;
  toneOption: ToneOptionId;
  onLengthChange: (id: LengthOptionId) => void;
  onToneChange: (id: ToneOptionId) => void;
  disabled?: boolean;
  className?: string;
  isSaving?: boolean;
};

export function EmailStyleControls({
  lengthOption,
  toneOption,
  onLengthChange,
  onToneChange,
  disabled = false,
  className,
  isSaving = false,
}: Props) {
  return (
    <div className={cn("space-y-3", className)}>
      {isSaving ? (
        <p className="flex items-center gap-1 text-base text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          Saving…
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-3">
        <SegmentedControl
          label="Length"
          value={lengthOption}
          options={EMAIL_LENGTH_OPTIONS.map((o) => ({
            value: o.id,
            label: o.label,
          }))}
          onValueChange={onLengthChange}
          disabled={disabled}
        />
        <SegmentedControl
          label="Tone"
          value={toneOption}
          options={EMAIL_TONE_OPTIONS.map((o) => ({
            value: o.id,
            label: o.label,
          }))}
          onValueChange={onToneChange}
          disabled={disabled}
        />
      </div>
    </div>
  );
}
