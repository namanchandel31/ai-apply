import React, { useMemo } from "react";
import { cn } from "@/lib/utils";

export type TextShimmerProps = {
  children: string;
  as?: React.ElementType;
  className?: string;
  duration?: number;
  spread?: number;
};

function TextShimmerComponent({
  children,
  as: Component = "p",
  className,
  duration = 2,
  spread = 2,
}: TextShimmerProps) {
  const dynamicSpread = useMemo(() => children.length * spread, [children, spread]);

  return (
    <Component
      className={cn(
        "relative inline-block bg-[length:250%_100%,auto] bg-clip-text text-transparent",
        "[background-repeat:no-repeat,padding-box] animate-text-shimmer",
        className
      )}
      style={
        {
          "--spread": `${dynamicSpread}px`,
          "--base-color": "hsl(var(--muted-foreground))",
          "--base-gradient-color": "hsl(var(--foreground))",
          "--bg":
            "linear-gradient(90deg, #0000 calc(50% - var(--spread)), var(--base-gradient-color), #0000 calc(50% + var(--spread)))",
          backgroundImage:
            "var(--bg), linear-gradient(var(--base-color), var(--base-color))",
          animationDuration: `${duration}s`,
        } as React.CSSProperties
      }
    >
      {children}
    </Component>
  );
}

export const TextShimmer = React.memo(TextShimmerComponent);
