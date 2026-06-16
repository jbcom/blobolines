import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-[family-name:var(--font-ui)] font-semibold transition-all duration-[var(--dur-fast)] ease-[var(--ease-bounce)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)] disabled:pointer-events-none disabled:opacity-40 active:scale-95",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--accent)] text-white rounded-[var(--radius-md)] shadow-[var(--glow-blue)] hover:brightness-110",
        warm: "bg-[var(--accent-warm)] text-white rounded-[var(--radius-md)] shadow-[var(--glow-warm)] hover:brightness-110",
        surface:
          "bg-[var(--surface)] text-[var(--fg)] border border-[var(--border)] rounded-[var(--radius-md)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-elevated)]",
        ghost:
          "bg-transparent text-[var(--fg-muted)] rounded-[var(--radius-md)] hover:bg-[var(--surface)] hover:text-[var(--fg)]",
        danger: "bg-[var(--danger)] text-white rounded-[var(--radius-md)] hover:brightness-110",
      },
      size: {
        sm: "h-8 px-3 text-[length:var(--text-sm)]",
        default: "h-10 px-5 text-[length:var(--text-base)]",
        lg: "h-12 px-7 text-[length:var(--text-lg)]",
        icon: "h-10 w-10 rounded-[var(--radius-md)]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
