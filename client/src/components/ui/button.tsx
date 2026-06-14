import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-base font-medium transition-[background-color,color,border-color] duration-[120ms] ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-[#1a1a1a]",
        destructive: "bg-destructive text-white hover:bg-destructive/90",
        outline:
          "border border-input-border bg-transparent text-foreground hover:bg-black/[0.06]",
        secondary: "bg-black/[0.06] text-foreground hover:bg-black/10",
        ghost: "text-foreground hover:bg-black/[0.06]",
        link: "text-foreground underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-[18px] py-2.5",
        sm: "h-8 rounded-lg px-[14px] text-sm",
        lg: "h-11 rounded-lg px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
