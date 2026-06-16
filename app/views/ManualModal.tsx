import { Dialog } from "@app/components/ui";
import { Magnet, MoveVertical, Rocket, Target } from "lucide-react";

/**
 * Mechanics manual — how to play. Reachable from the title; reuses the Dialog primitive.
 */
const ENTRIES = [
  {
    icon: Target,
    title: "Slingshot launch",
    body: "Drag back on a pad to aim + charge, release to fling the blob up.",
  },
  {
    icon: MoveVertical,
    title: "Steer in the air",
    body: "Drag while airborne to nudge left/right and forward/back in 3D.",
  },
  {
    icon: Rocket,
    title: "Hyper-thrust",
    body: "Grab the orange cone to rocket straight up through the tower.",
  },
  { icon: Magnet, title: "Magnet", body: "Grab the blue ring to pull nearby crystals toward you." },
];

export function ManualModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} ariaLabel="How to play" testId="manual">
      <h2 className="font-display text-xl font-bold text-cream">How to play</h2>
      <p className="mt-1 font-ui text-xs text-fg-subtle">
        Bounce as high as you can. Clean bounces build a combo.
      </p>

      <div className="mt-4 flex flex-col gap-3">
        {ENTRIES.map(({ icon: Icon, title, body }) => (
          <div key={title} className="flex gap-3">
            <div
              className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-accent"
              aria-hidden
            >
              <Icon className="size-4" strokeWidth={2.5} />
            </div>
            <div>
              <p className="font-display text-sm font-bold text-cream">{title}</p>
              <p className="font-ui text-xs text-fg-muted">{body}</p>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => onOpenChange(false)}
        className="mt-6 w-full rounded-xl bg-accent py-2.5 font-display font-bold uppercase tracking-wider text-bg"
      >
        Got it
      </button>
    </Dialog>
  );
}
