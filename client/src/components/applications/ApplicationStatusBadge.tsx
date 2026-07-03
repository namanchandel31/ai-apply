import type { LucideIcon } from "lucide-react";
import {
  AlertCircle,
  Ban,
  CheckCircle2,
  Clock,
  Loader2,
  Mail,
  RefreshCw,
  Send,
} from "lucide-react";
import type { ApplicationRecord } from "@/lib/api";
import { cn } from "@/lib/utils";
import { tableTextSecondary } from "@/components/applications/applicationsTableTypography";

const STATUS_CONFIG: Record<
  string,
  { label: string; className: string; icon: LucideIcon }
> = {
  sent: {
    label: "Sent",
    className: "bg-success/15 text-success border-success/25",
    icon: CheckCircle2,
  },
  failed: {
    label: "Failed",
    className: "bg-destructive/15 text-destructive border-destructive/25",
    icon: AlertCircle,
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-black/[0.06] text-muted-foreground border-border",
    icon: Ban,
  },
  needs_review: {
    label: "Needs review",
    className: "bg-warning/15 text-warning border-warning/30",
    icon: Mail,
  },
  processing: {
    label: "Processing",
    className: "bg-primary/15 text-primary border-primary/25",
    icon: Loader2,
  },
  sending: {
    label: "Sending",
    className: "bg-primary/15 text-primary border-primary/25",
    icon: Send,
  },
  queued: {
    label: "Queued",
    className: "bg-warning/15 text-warning border-warning/30",
    icon: Clock,
  },
  queued_sending: {
    label: "Queued sending",
    className: "bg-warning/15 text-warning border-warning/30",
    icon: Clock,
  },
  retrying: {
    label: "Retrying",
    className: "bg-warning/15 text-warning border-warning/30",
    icon: RefreshCw,
  },
  generated: {
    label: "Ready",
    className: "bg-success/15 text-success border-success/25",
    icon: CheckCircle2,
  },
  draft: {
    label: "Draft",
    className: "bg-muted text-muted-foreground border-border",
    icon: Clock,
  },
};

const SPIN = new Set(["processing", "sending", "queued", "retrying"]);

function formatEstimatedSendAt(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const at = new Date(iso);
  const diffMs = at.getTime() - Date.now();
  if (diffMs <= 60_000) return "Est. 1 min";
  if (diffMs < 3_600_000) {
    const mins = Math.max(1, Math.round(diffMs / 60_000));
    return `Est. ${mins} min`;
  }
  return `Est. ${at.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
}

export function getApplicationStatusLabel(app: ApplicationRecord): string {
  const ui = app.uiStatus || app.status;
  const base = STATUS_CONFIG[ui]?.label ?? ui;
  if (ui === "queued_sending") {
    const est = formatEstimatedSendAt(app.estimatedSendAt);
    return est ? `${base} · ${est}` : base;
  }
  return base;
}

export function ApplicationStatusBadge({
  app,
  variant = "badge",
}: {
  app: ApplicationRecord;
  variant?: "badge" | "text";
}) {
  const ui = app.uiStatus || app.status;
  const cfg = STATUS_CONFIG[ui] ?? {
    label: ui,
    className: "bg-muted text-muted-foreground border-border",
    icon: Clock,
  };
  const Icon = cfg.icon;
  const spin = SPIN.has(ui);

  if (variant === "text") {
    return <span className={tableTextSecondary}>{cfg.label}</span>;
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        cfg.className
      )}
    >
      <Icon className={cn("h-4 w-4", spin && "animate-spin")} />
      {cfg.label}
    </span>
  );
}
