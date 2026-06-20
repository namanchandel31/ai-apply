import { Switch } from "@/components/ui/switch";
import { autoApplyToggleDescription } from "@/lib/applyMode";
import { cn } from "@/lib/utils";

type Props = {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  disabled?: boolean;
};

export function AutoApplyToggle({ enabled, onEnabledChange, disabled }: Props) {
  return (
    <div
      data-tour="auto-apply-toggle"
      className="flex max-w-full items-center gap-3 whitespace-nowrap"
    >
      <label
        htmlFor="auto-apply-toggle"
        className={cn(
          "cursor-pointer text-base",
          disabled && "cursor-not-allowed opacity-50",
        )}
      >
        <span className="font-medium text-foreground">Auto apply</span>
        <span className="font-normal text-muted-foreground">
          {": "}
          {autoApplyToggleDescription(enabled)}
        </span>
      </label>
      <Switch
        id="auto-apply-toggle"
        checked={enabled}
        onCheckedChange={onEnabledChange}
        disabled={disabled}
        className="shrink-0"
      />
    </div>
  );
}
