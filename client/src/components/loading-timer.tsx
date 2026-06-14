import { Loader2 } from "lucide-react";
import { TextShimmer } from "@/components/core/text-shimmer";
import { cn } from "@/lib/utils";

type LoadingTimerProps = {
  label: string;
  description?: string;
  className?: string;
  labelShimmer?: boolean;
  labelShimmerDuration?: number;
};

export function LoadingTimer({
  label,
  description = "This may take up to 90 seconds",
  className,
  labelShimmer = false,
  labelShimmerDuration = 1,
}: LoadingTimerProps) {
  return (
    <div
      className={cn(
        "flex w-full flex-col items-center gap-3 text-center",
        className
      )}
    >
      <Loader2 className="h-5 w-5 animate-spin text-foreground" />
      {labelShimmer ? (
        <TextShimmer className="text-base font-medium" duration={labelShimmerDuration}>
          {label}
        </TextShimmer>
      ) : (
        <p className="text-base font-medium text-foreground">{label}</p>
      )}
      <p className="text-base font-normal text-muted-foreground">{description}</p>
    </div>
  );
}
