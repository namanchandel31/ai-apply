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

const STATUS_CONFIG: Record<
  string,
  { label: string; className: string; icon: LucideIcon }
> = {
  sent: {
    label: "Sent",
    className: "bg-emerald-600/15 text-emerald-700 border-emerald-600/25",
    icon: CheckCircle2,
  },
  failed: {
    label: "Failed",
    className: "bg-red-600/15 text-red-700 border-red-600/25",
    icon: AlertCircle,
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-zinc-500/15 text-zinc-600 border-zinc-500/25",
    icon: Ban,
  },
  needs_review: {
    label: "Needs review",
    className: "bg-amber-500/15 text-amber-800 border-amber-500/30",
    icon: Mail,
  },
  processing: {
    label: "Processing",
    className: "bg-blue-600/15 text-blue-700 border-blue-600/25",
    icon: Loader2,
  },
  sending: {
    label: "Sending",
    className: "bg-violet-600/15 text-violet-700 border-violet-600/25",
    icon: Send,
  },
  queued: {
    label: "Queued",
    className: "bg-amber-500/15 text-amber-800 border-amber-500/30",
    icon: Clock,
  },
  retrying: {
    label: "Retrying",
    className: "bg-orange-500/15 text-orange-800 border-orange-500/30",
    icon: RefreshCw,
  },
  generated: {
    label: "Ready",
    className: "bg-teal-600/15 text-teal-800 border-teal-600/25",
    icon: CheckCircle2,
  },
  draft: {
    label: "Draft",
    className: "bg-muted text-muted-foreground border-border",
    icon: Clock,
  },
};

const SPIN = new Set(["processing", "sending", "queued", "retrying"]);

export function ApplicationStatusBadge({ app }: { app: ApplicationRecord }) {
  const ui = app.uiStatus || app.status;
  const cfg = STATUS_CONFIG[ui] ?? {
    label: ui,
    className: "bg-muted text-muted-foreground border-border",
    icon: Clock,
  };
  const Icon = cfg.icon;
  const spin = SPIN.has(ui);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        cfg.className
      )}
    >
      <Icon className={cn("h-3.5 w-3.5", spin && "animate-spin")} />
      {cfg.label}
    </span>
  );
}
