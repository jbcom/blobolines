import * as RadixDialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ariaLabel: string;
  ariaDescription?: string;
  testId?: string;
  className?: string;
  children: ReactNode;
}

// Centering: Tailwind left/top-1/2 + a static -50% translate baked into the motion
// values (so Motion's animated transform doesn't fight a separate CSS translate, which
// left the content off-center + stuck at opacity 0). Inline initial/animate/exit objects
// are used instead of variant keys — variant strings didn't resolve on first forceMount.
const MotionOverlay = motion.create(RadixDialog.Overlay);

export function Dialog({
  open,
  onOpenChange,
  ariaLabel,
  ariaDescription,
  testId,
  className,
  children,
}: DialogProps) {
  const prefersReduced = useReducedMotion();
  const dur = prefersReduced ? 0.1 : 0.24;

  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <RadixDialog.Portal forceMount>
            <MotionOverlay
              forceMount
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="fixed inset-0 z-[var(--z-modal)] bg-black/60 backdrop-blur-sm"
            />
            {/* Radix Content owns the -50%/-50% centering via CSS (static transform);
                the inner motion.div animates only opacity + a numeric y/scale, so Motion
                never has to interpolate a calc()↔% transform (which silently failed). */}
            {/* No aria-label here: Radix auto-wires aria-labelledby to the Title below, so
                the dialog's accessible name comes from the (sr-only) Title — not a second,
                competing aria-label that would shadow it. */}
            <RadixDialog.Content
              forceMount
              data-testid={testId}
              // Radix always emits aria-describedby={descriptionId}; when we render no
              // Description that id dangles (axe aria-valid-attr-value). Clear it when no
              // description is given; when one IS given, omit the prop so Radix wires it.
              {...(ariaDescription ? {} : { "aria-describedby": undefined })}
              // Cap the dialog to the safe viewport height (minus the notch/home-indicator
              // insets) so a tall modal on a short/landscape screen never overflows off-screen
              // — the inner panel scrolls instead. The translate centering is unchanged.
              style={{
                maxHeight: "calc(100dvh - var(--safe-top) - var(--safe-bottom) - 2rem)",
              }}
              className="fixed left-1/2 top-1/2 z-[calc(var(--z-modal)+1)] flex w-[min(90vw,480px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden focus:outline-none"
            >
              <RadixDialog.Title asChild>
                <span className="sr-only">{ariaLabel}</span>
              </RadixDialog.Title>
              {/* Only emit a description when one is given — defaulting it to the title is
                  noise (title === description). Radix tolerates an absent description. */}
              {ariaDescription ? (
                <RadixDialog.Description asChild>
                  <span className="sr-only">{ariaDescription}</span>
                </RadixDialog.Description>
              ) : null}
              <motion.div
                initial={{
                  opacity: 0,
                  y: prefersReduced ? 0 : 24,
                  scale: prefersReduced ? 1 : 0.96,
                }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: prefersReduced ? 0 : 16, scale: prefersReduced ? 1 : 0.97 }}
                transition={{ duration: dur, ease: [0.22, 1, 0.36, 1] }}
                style={{ maxHeight: "inherit" }}
                className={cn(
                  // min-h-0 + overflow-y-auto lets the panel scroll INTERNALLY when it's
                  // taller than the capped Content (short/landscape screens); overscroll-
                  // contain stops the scroll chaining to the page behind the modal.
                  "max-h-full w-full min-h-0 overflow-y-auto overscroll-contain rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--bg-elevated)] p-6 shadow-[var(--shadow-lg)]",
                  className,
                )}
              >
                {children}
              </motion.div>
            </RadixDialog.Content>
          </RadixDialog.Portal>
        )}
      </AnimatePresence>
    </RadixDialog.Root>
  );
}

export const DialogClose = RadixDialog.Close;
export const DialogTrigger = RadixDialog.Trigger;
