import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type Props = {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  disabled?: boolean;
};

export function AutoApplyToggle({ enabled, onEnabledChange, disabled }: Props) {
  return (
    <div data-tour="auto-apply-toggle" className="flex items-center gap-3">
      <label
        htmlFor="auto-apply-toggle"
        className={cn("text-base font-medium text-foreground", disabled && "opacity-50")}
      >
        AutoApply
      </label>
      <Switch
        id="auto-apply-toggle"
        checked={enabled}
        onCheckedChange={onEnabledChange}
        disabled={disabled}
      />
    </div>
  );
}
