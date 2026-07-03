import type { ReactNode } from "react";
import type { ApplicationRecord } from "@/lib/api";
import {
  applicationRowErrorMessage,
  isApplicationRowFailed,
  isApplicationStatusShimmering,
} from "@/lib/applicationRowState";
import {
  ApplicationStatusBadge,
  getApplicationStatusLabel,
} from "@/components/applications/ApplicationStatusBadge";
import { ApplicationTrackerStatusCell } from "@/components/applications/ApplicationTrackerStatusCell";
import { tableTextSecondary } from "@/components/applications/applicationsTableTypography";
import { cn } from "@/lib/utils";

type Props = {
  app: ApplicationRecord;
};

export function ApplicationTableStatusCell({ app }: Props) {
  const shimmering = isApplicationStatusShimmering(app);
  const failed = isApplicationRowFailed(app);
  const errorMessage = applicationRowErrorMessage(app);

  if (failed && errorMessage) {
    return (
      <div className="flex min-w-0 flex-col gap-0.5">
        <ApplicationStatusBadge app={app} />
        <span className="line-clamp-2 text-sm text-destructive" title={errorMessage}>
          {errorMessage}
        </span>
      </div>
    );
  }

  if (shimmering) {
    return (
      <ApplicationTableShimmerText shimmer className={cn(tableTextSecondary, "text-base")}>
        {getApplicationStatusLabel(app)}
      </ApplicationTableShimmerText>
    );
  }

  const ui = (app.uiStatus || app.status || "").toLowerCase();
  if (ui === "needs_review") {
    return <ApplicationStatusBadge app={app} variant="text" />;
  }

  return <ApplicationTrackerStatusCell app={app} />;
}

export function ApplicationTableShimmerText({
  children,
  className,
  shimmer = false,
}: {
  children: ReactNode;
  className?: string;
  shimmer?: boolean;
}) {
  if (!shimmer) {
    return <span className={className}>{children}</span>;
  }
  return (
    <span
      className={cn(
        className,
        "animate-text-shimmer bg-[length:250%_100%,auto] bg-clip-text text-transparent",
        "[background-repeat:no-repeat,padding-box]"
      )}
      style={
        {
          "--spread": "24px",
          "--base-color": "hsl(var(--muted-foreground))",
          "--base-gradient-color": "hsl(var(--foreground))",
          "--bg":
            "linear-gradient(90deg, #0000 calc(50% - var(--spread)), var(--base-gradient-color), #0000 calc(50% + var(--spread)))",
          backgroundImage:
            "var(--bg), linear-gradient(var(--base-color), var(--base-color))",
        } as React.CSSProperties
      }
    >
      {children}
    </span>
  );
}
