import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { PAGE_PADDING_X } from "@/lib/pageLayout";
import { Button } from "@/components/ui/button";

type SetupPageShellProps = {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
};

export function SetupPageShell({
  title,
  description,
  children,
  className,
  contentClassName,
}: SetupPageShellProps) {
  const navigate = useNavigate();

  return (
    <div className={cn("w-full py-6 lg:py-8", PAGE_PADDING_X, className)}>
      <div className="mb-6">
        <Button
          type="button"
          variant="ghost"
          className="-ml-3 h-auto gap-1.5 px-3 py-1.5 text-base font-normal text-muted-foreground hover:text-foreground"
          onClick={() => navigate("/dashboard")}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Go back
        </Button>
      </div>

      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description ? (
          <p className="mt-1 text-base text-muted-foreground">{description}</p>
        ) : null}
      </div>

      <div className={contentClassName}>{children}</div>
    </div>
  );
}
