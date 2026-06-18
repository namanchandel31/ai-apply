import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

type Props = {
  checked: boolean | "indeterminate";
  onCheckedChange: (checked: boolean) => void;
  "aria-label": string;
  className?: string;
};

export function TableRowSelectCheckbox({
  checked,
  onCheckedChange,
  "aria-label": ariaLabel,
  className,
}: Props) {
  return (
    <label
      className={cn(
        "inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-sm",
        className
      )}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <Checkbox
        checked={checked}
        onCheckedChange={(value) => onCheckedChange(value === true)}
        aria-label={ariaLabel}
        className="h-[18px] w-[18px]"
      />
    </label>
  );
}
