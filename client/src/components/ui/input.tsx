import * as React from "react";
import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      className={cn(
        "flex h-10 w-full rounded-[10px] border border-input-border bg-input px-[14px] py-2.5 text-base text-foreground transition-[background-color,border-color,box-shadow] duration-[120ms] ease-in-out file:border-0 file:bg-transparent file:text-base file:font-medium placeholder:text-placeholder focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/12 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}

export { Input };
