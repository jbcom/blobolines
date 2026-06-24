import { Button, Dialog } from "@app/components/ui";
import type { LucideIcon } from "lucide-react";
import {
  CalendarDays,
  Cloud,
  Gauge,
  Hourglass,
  Magnet,
  MoveVertical,
  Repeat2,
  Rocket,
  Shield,
  Star,
  TimerReset,
  Trophy,
  Wind,
} from "lucide-react";

/**
 * Mechanics manual — how to play. Reachable from the title; reuses the Dialog primitive.
 */
type ManualEntry = {
  icon: LucideIcon;
  title: string;
  body: string;
};

const SECTIONS: { id: string; title: string; entries: ManualEntry[] }[] = [
  {
    id: "climb",
    title: "Climb",
    entries: [
      {
        icon: TimerReset,
        title: "Charge launch",
        body: "Hold on Blobby to fill the route arc, then release to fling along the parabola.",
      },
      {
        icon: Cloud,
        title: "Cloud catch",
        body: "Clouds let you pass upward, then cling to Blobby as he descends into the puff.",
      },
      {
        icon: MoveVertical,
        title: "Steer in the air",
        body: "Drag while airborne to nudge left/right and forward/back in 3D.",
      },
      {
        icon: Gauge,
        title: "Read the route",
        body: "The radar points to the next cloud, and the aim arcs show your launch and air path.",
      },
    ],
  },
  {
    id: "run-aids",
    title: "Run aids",
    entries: [
      {
        icon: Trophy,
        title: "Clean combo",
        body: "Land clean cloud catches to raise the combo and make the next launch stronger.",
      },
      {
        icon: Rocket,
        title: "Hyper-thrust",
        body: "Grab the orange cone to rocket straight up through the tower.",
      },
      {
        icon: Magnet,
        title: "Magnet",
        body: "Grab the warm ring to pull nearby crystals toward you.",
      },
      {
        icon: Shield,
        title: "Shield",
        body: "Hold a shield to survive one fatal fall; its badge stays full until the save fires.",
      },
      {
        icon: Hourglass,
        title: "Slow-mo",
        body: "Slow-mo gives you a short timing window for tight cloud catches.",
      },
      {
        icon: Star,
        title: "2x score",
        body: "The score doubler boosts points while its badge drains.",
      },
      {
        icon: Repeat2,
        title: "Multi-bounce",
        body: "Multi-bounce stores extra air taps; the badge shows how many charges remain.",
      },
      {
        icon: Wind,
        title: "High-altitude hazards",
        body: "Wind and downdrafts appear higher up; the HUD shows their direction and strength.",
      },
    ],
  },
  {
    id: "goals",
    title: "Goals",
    entries: [
      {
        icon: CalendarDays,
        title: "Daily tower",
        body: "Daily Challenge uses today's shared seed and tracks your best standing for the day.",
      },
      {
        icon: Trophy,
        title: "Next climb",
        body: "After a run, the result screen picks one achievement target for your next attempt.",
      },
    ],
  },
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
        Climb as high as you can. Clean catches, smart steering, and run aids keep Blobby rising.
      </p>

      <div className="mt-4 flex flex-col gap-4">
        {SECTIONS.map((section) => (
          <section key={section.id} aria-labelledby={`manual-${section.id}`}>
            <h3
              id={`manual-${section.id}`}
              className="mb-2 font-display text-sm font-bold text-tramp-gold"
            >
              {section.title}
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {section.entries.map(({ icon: Icon, title, body }) => (
                <div key={title} className="flex gap-3">
                  <div
                    className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-accent"
                    aria-hidden
                  >
                    <Icon className="size-4" strokeWidth={2.5} />
                  </div>
                  <div>
                    <h4 className="font-display text-sm font-bold text-cream">{title}</h4>
                    <p className="font-ui text-xs text-fg-muted">{body}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      <Button cta size="lg" onClick={() => onOpenChange(false)} className="mt-6 w-full">
        Got it
      </Button>
    </Dialog>
  );
}
