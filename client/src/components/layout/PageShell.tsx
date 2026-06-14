import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { PAGE_PADDING_X } from "@/lib/pageLayout";

type PageShellProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
};

export function PageShell({
  title,
  description,
  actions,
  children,
  className,
  contentClassName,
}: PageShellProps) {
  return (
    <div className={cn("w-full py-6 lg:py-8", PAGE_PADDING_X, className)}>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          {description ? (
            <p className="mt-1 text-base text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center">{actions}</div> : null}
      </div>
      <div className={contentClassName}>{children}</div>
    </div>
  );
}
