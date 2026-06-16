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

const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.18 } },
  exit: { opacity: 0, transition: { duration: 0.14 } },
};

const contentVariants = {
  hidden: { opacity: 0, y: 24, scale: 0.96 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.24, ease: [0.22, 1, 0.36, 1] },
  },
  exit: {
    opacity: 0,
    y: 16,
    scale: 0.97,
    transition: { duration: 0.16 },
  },
};

const reducedVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.1 } },
  exit: { opacity: 0, transition: { duration: 0.08 } },
};

const MotionOverlay = motion.create(RadixDialog.Overlay);
const MotionContent = motion.create(RadixDialog.Content);

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
  const ov = prefersReduced ? reducedVariants : overlayVariants;
  const cv = prefersReduced ? reducedVariants : contentVariants;

  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <RadixDialog.Portal forceMount>
            <MotionOverlay
              forceMount
              variants={ov}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="fixed inset-0 z-[var(--z-modal)] bg-black/60 backdrop-blur-sm"
            />
            <MotionContent
              forceMount
              aria-label={ariaLabel}
              data-testid={testId}
              variants={cv}
              initial="hidden"
              animate="visible"
              exit="exit"
              className={cn(
                "fixed left-1/2 top-1/2 z-[calc(var(--z-modal)+1)] w-[min(90vw,480px)] -translate-x-1/2 -translate-y-1/2 rounded-[var(--radius-xl)] bg-[var(--bg-elevated)] border border-[var(--border)] shadow-[var(--shadow-lg)] p-6 focus:outline-none",
                className,
              )}
            >
              <RadixDialog.Title asChild>
                <span className="sr-only">{ariaLabel}</span>
              </RadixDialog.Title>
              <RadixDialog.Description asChild>
                <span className="sr-only">{ariaDescription ?? ariaLabel}</span>
              </RadixDialog.Description>
              {children}
            </MotionContent>
          </RadixDialog.Portal>
        )}
      </AnimatePresence>
    </RadixDialog.Root>
  );
}

export const DialogClose = RadixDialog.Close;
export const DialogTrigger = RadixDialog.Trigger;
