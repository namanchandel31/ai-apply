import { formatDateTime } from "@/lib/formatDateTime";
import { tableTextPrimary, tableTextSecondary } from "@/components/applications/applicationsTableTypography";

export function DateTimeCell({
  iso,
  variant = "stacked",
}: {
  iso: string | null | undefined;
  variant?: "stacked" | "inline";
}) {
  const { date, time } = formatDateTime(iso);
  if (date === "-") {
    return <span className={tableTextSecondary}>-</span>;
  }
  if (variant === "inline") {
    const line = time ? `${date} · ${time}` : date;
    return <span className={tableTextSecondary}>{line}</span>;
  }
  return (
    <div>
      <div className={tableTextPrimary}>{date}</div>
      {time ? <div className={tableTextSecondary}>{time}</div> : null}
    </div>
  );
}
