import * as SliderPrimitive from "@radix-ui/react-slider";
import * as React from "react";
import { cn } from "@/lib/utils";

const Slider = React.forwardRef<
  React.ComponentRef<typeof SliderPrimitive.Root>,
  // aria-label is pulled off and placed on the Thumb (the element with role="slider"),
  // since the accessible name belongs on the thumb, not the Root group.
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> & { "aria-label"?: string }
>(({ className, "aria-label": ariaLabel, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn("relative flex w-full touch-none select-none items-center", className)}
    {...props}
  >
    <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-[var(--radius-full)] bg-[var(--surface)]">
      <SliderPrimitive.Range className="absolute h-full bg-[var(--accent)]" />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb
      aria-label={ariaLabel}
      className="block h-5 w-5 rounded-[var(--radius-full)] border-2 border-[var(--accent)] bg-[var(--bg-elevated)] shadow-[var(--glow-blue)] transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)] disabled:pointer-events-none disabled:opacity-40 active:scale-110"
    />
  </SliderPrimitive.Root>
));
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };
