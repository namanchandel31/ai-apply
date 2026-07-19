import { cn } from "@/lib/utils";
import { tableTextSecondary } from "@/components/applications/applicationsTableTypography";

export function MatchScoreCell({
  score,
  variant = "default",
}: {
  score: number | null | undefined;
  variant?: "default" | "table";
}) {
  if (score == null || Number.isNaN(score)) {
    return <span className={tableTextSecondary}>-</span>;
  }
  if (variant === "table") {
    return <span className={cn(tableTextSecondary, "tabular-nums")}>{score}%</span>;
  }
  const color =
    score >= 80
      ? "text-success"
      : score >= 60
        ? "text-warning"
        : "text-muted-foreground";
  return (
    <div className="flex items-center gap-2">
      <span className={cn("text-sm font-medium tabular-nums", color)}>
        {Math.round(score)}% match
      </span>
      <div className="hidden sm:block h-2 w-12 rounded-full bg-muted overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full",
            score >= 80 ? "bg-success" : score >= 60 ? "bg-warning" : "bg-muted-foreground/40"
          )}
          style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
        />
      </div>
    </div>
  );
}
