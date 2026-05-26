import { formatDateTime } from "@/lib/formatDateTime";

export function DateTimeCell({ iso }: { iso: string | null | undefined }) {
  const { date, time } = formatDateTime(iso);
  if (date === "—") {
    return <span className="text-muted-foreground text-sm">—</span>;
  }
  return (
    <div className="leading-tight">
      <div className="text-sm text-foreground">{date}</div>
      {time ? <div className="text-xs text-muted-foreground">{time}</div> : null}
    </div>
  );
}
