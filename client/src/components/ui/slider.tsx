import * as React from "react";
import { cn } from "@/lib/utils";

type SliderProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "type" | "value" | "onChange"
> & {
  value: number[];
  onValueChange: (value: number[]) => void;
};

function Slider({ className, value, onValueChange, min = 0, max = 100, ...props }: SliderProps) {
  const v = value[0] ?? Number(min);
  return (
    <input
      type="range"
      min={min}
      max={max}
      value={v}
      onChange={(e) => onValueChange([Number(e.target.value)])}
      className={cn(
        "w-full h-2 cursor-pointer appearance-none rounded-full bg-muted accent-primary",
        className
      )}
      {...props}
    />
  );
}

export { Slider };
