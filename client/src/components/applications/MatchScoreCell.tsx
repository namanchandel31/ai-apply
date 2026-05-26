import { cn } from "@/lib/utils";

export function MatchScoreCell({ score }: { score: number | null | undefined }) {
  if (score == null || Number.isNaN(score)) {
    return <span className="text-muted-foreground text-sm">—</span>;
  }
  const color =
    score >= 80
      ? "text-emerald-600"
      : score >= 60
        ? "text-amber-600"
        : "text-muted-foreground";
  return (
    <div className="flex items-center gap-2">
      <span className={cn("text-sm font-semibold tabular-nums", color)}>{score}%</span>
      <div className="hidden sm:block h-1.5 w-12 rounded-full bg-muted overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full",
            score >= 80 ? "bg-emerald-500" : score >= 60 ? "bg-amber-500" : "bg-muted-foreground/40"
          )}
          style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
        />
      </div>
    </div>
  );
}
