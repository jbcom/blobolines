import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-[family-name:var(--font-ui)] font-semibold transition-all duration-[var(--dur-fast)] ease-[var(--ease-bounce)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)] disabled:pointer-events-none disabled:opacity-40 active:scale-95",
  {
    variants: {
      variant: {
        // Dark-on-bright (text-[var(--bg)]) instead of white-on-accent: white on --accent
        // is only 3.46:1 (fails AA for normal text), dark-on-accent is ~5.18:1 (passes),
        // matching the hand-rolled CTA buttons in the views.
        default:
          "bg-[var(--accent)] text-[var(--bg)] rounded-[var(--radius-md)] shadow-[var(--glow-blue)] hover:brightness-110",
        warm: "bg-[var(--accent-warm)] text-[var(--bg)] rounded-[var(--radius-md)] shadow-[var(--glow-warm)] hover:brightness-110",
        surface:
          "bg-[var(--surface)] text-[var(--fg)] border border-[var(--border)] rounded-[var(--radius-md)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-elevated)]",
        ghost:
          "bg-transparent text-[var(--fg-muted)] rounded-[var(--radius-md)] hover:bg-[var(--surface)] hover:text-[var(--fg)]",
        danger:
          "bg-[var(--danger)] text-[var(--bg)] rounded-[var(--radius-md)] hover:brightness-110",
      },
      size: {
        sm: "h-8 px-3 text-[length:var(--text-sm)]",
        default: "h-10 px-5 text-[length:var(--text-base)]",
        lg: "h-12 px-7 text-[length:var(--text-lg)]",
        icon: "h-10 w-10 rounded-[var(--radius-md)]",
      },
      /** The big arcade CTA voice (display font, uppercase, wide tracking) the menus/cards
       *  share, with subtly GOOEY asymmetric corners (--radius-goo) so a primary button reads
       *  soft-bodied, not a hard rounded rect. Off by default so generic buttons stay plain. */
      cta: {
        true: "font-[family-name:var(--font-display)] font-bold uppercase tracking-wider !rounded-[var(--radius-goo)]",
        false: "",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
      cta: false,
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, cta, asChild = false, type, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    // Default native buttons to type="button" so they never accidentally submit a form;
    // callers can still override. (Omit when rendering asChild — the child owns its type.)
    const typeProp = asChild ? {} : { type: type ?? "button" };
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, cta, className }))}
        ref={ref}
        {...typeProp}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
