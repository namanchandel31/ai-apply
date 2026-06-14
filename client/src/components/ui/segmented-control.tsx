import { cn } from "@/lib/utils";

export type SegmentedOption<T extends string> = {
  value: T;
  label: string;
};

type Props<T extends string> = {
  label?: string;
  value: T;
  options: SegmentedOption<T>[];
  onValueChange: (value: T) => void;
  disabled?: boolean;
  className?: string;
  /** When false, the control sizes to its content instead of stretching full width. */
  fullWidth?: boolean;
};

export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onValueChange,
  disabled = false,
  className,
  fullWidth = true,
}: Props<T>) {
  return (
    <div className={cn(label ? "space-y-2" : undefined, className)}>
      {label ? (
        <p className="text-base font-normal text-muted-foreground">{label}</p>
      ) : null}
      <div
        className={cn(
          "inline-flex gap-1 rounded-sm bg-muted p-1",
          fullWidth ? "w-full" : "w-auto"
        )}
        role="group"
        aria-label={label ?? options.map((o) => o.label).join(", ")}
      >
        {options.map((option) => {
          const selected = value === option.value;

          return (
            <button
              key={option.value}
              type="button"
              disabled={disabled}
              aria-pressed={selected}
              onClick={() => onValueChange(option.value)}
              className={cn(
                "rounded-sm py-2 text-base whitespace-nowrap transition-[background-color,color] duration-[120ms]",
                fullWidth ? "flex-1 px-3" : "px-6",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:z-10",
                "disabled:pointer-events-none disabled:opacity-50",
                selected
                  ? "bg-card font-medium text-foreground shadow-[var(--shadow-card)]"
                  : "font-normal text-muted-foreground hover:bg-black/[0.05] hover:text-foreground"
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
