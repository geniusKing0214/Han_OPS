import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border border-border px-2 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default:
          "border-border bg-muted text-muted-foreground",
        accent:
          "border-accent/30 bg-accent/10 text-accent",
        outline: "text-foreground",
        success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600",
        warning: "border-amber-500/30 bg-amber-500/10 text-amber-600",
        destructive: "border-red-500/30 bg-red-500/10 text-red-600",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
