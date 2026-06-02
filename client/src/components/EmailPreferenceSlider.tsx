import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

type Props = {
  label: string;
  value: number;
  minEndpoint: string;
  maxEndpoint: string;
  bucketLabel: string;
  onValueChange: (value: number) => void;
  compact?: boolean;
};

export function EmailPreferenceSlider({
  label,
  value,
  minEndpoint,
  maxEndpoint,
  bucketLabel,
  onValueChange,
  compact = false,
}: Props) {
  const [dragging, setDragging] = useState(false);

  return (
    <div className={cn(compact ? "space-y-0.5" : "space-y-1.5")}>
      <Label className={cn("font-medium", compact ? "text-xs" : "text-sm")}>{label}</Label>

      <div className={cn("flex items-center", compact ? "gap-1.5" : "gap-2")}>
        <span
          className={cn(
            "shrink-0 leading-tight text-muted-foreground",
            compact ? "max-w-[4.5rem] text-[10px]" : "text-xs"
          )}
        >
          {minEndpoint}
        </span>

        <div className="relative min-w-0 flex-1">
          {dragging && (
            <div
              className="pointer-events-none absolute bottom-full z-10 mb-0.5 flex -translate-x-1/2 flex-col items-center"
              style={{ left: `${value}%` }}
            >
              <span className="whitespace-nowrap rounded bg-foreground px-1.5 py-0.5 text-[10px] font-medium text-background shadow-sm">
                {bucketLabel}
              </span>
              <span className="text-[8px] leading-none text-foreground" aria-hidden>
                ▼
              </span>
            </div>
          )}
          <Slider
            value={[value]}
            onValueChange={([v]) => onValueChange(v)}
            onPointerDown={() => setDragging(true)}
            onPointerUp={() => setDragging(false)}
            onPointerCancel={() => setDragging(false)}
            onLostPointerCapture={() => setDragging(false)}
          />
        </div>

        <span
          className={cn(
            "shrink-0 text-right leading-tight text-muted-foreground",
            compact ? "max-w-[4.5rem] text-[10px]" : "text-xs"
          )}
        >
          {maxEndpoint}
        </span>
      </div>
    </div>
  );
}
