import { cn } from "@/lib/utils";
import type { ComponentPropsWithoutRef } from "react";

const RAZORPAY_LOGO_URL =
  "https://upload.wikimedia.org/wikipedia/commons/8/89/Razorpay_logo.svg";

type RazorpaySecuredBadgeProps = ComponentPropsWithoutRef<"p"> & {
  variant?: "landing" | "default";
};

export function RazorpaySecuredBadge({
  className,
  variant = "default",
  ...props
}: RazorpaySecuredBadgeProps) {
  return (
    <p
      {...props}
      className={cn(
        "flex flex-wrap items-center justify-center gap-1.5",
        variant === "landing" ? "m-pricing-trust m-body-text" : "text-center text-sm text-muted-foreground",
        className
      )}
    >
      Payments are secured by
      <img
        src={RAZORPAY_LOGO_URL}
        alt="Razorpay"
        width={96}
        height={20}
        className="inline-block h-[1.1em] w-auto shrink-0"
        loading="lazy"
        decoding="async"
      />
    </p>
  );
}
