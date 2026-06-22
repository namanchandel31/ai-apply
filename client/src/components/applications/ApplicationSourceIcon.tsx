import { OneTapLogomark } from "@/components/OneTapLogomark";
import { cn } from "@/lib/utils";

function LinkedInLogomark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      role="img"
      aria-label="LinkedIn"
    >
      <path
        fill="currentColor"
        d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a-1.362 1.362 0 00-1.883-.019 1.363 1.363 0 00-.019 1.922 1.362 1.362 0 001.883.019 1.363 1.363 0 00.019-1.922zM5.337 7.433h-.001zM3.555 20.452V9h3.564v11.452H3.555zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"
      />
    </svg>
  );
}

const sourceIconClass = "text-muted-foreground grayscale";

type Props = {
  sourcePlatform?: string | null;
  className?: string;
};

export function ApplicationSourceIcon({ sourcePlatform, className }: Props) {
  if (sourcePlatform === "dashboard") {
    return (
      <OneTapLogomark
        className={cn("h-4 w-auto", sourceIconClass, className)}
        title="Applied from OneTap dashboard"
      />
    );
  }

  if (sourcePlatform === "linkedin") {
    return <LinkedInLogomark className={cn("h-4 w-4", sourceIconClass, className)} />;
  }

  return null;
}
