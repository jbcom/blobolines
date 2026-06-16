import { Magnet, Rocket } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { isPowerupActive } from "@/state";

/**
 * Active power-up badges — magnet + hyper-thrust. The timers live in the imperative
 * powerup bridge (frame cadence), so this polls on a short interval (human cadence, not
 * per frame) to flip the badges on/off without re-rendering every frame.
 */
export function PowerUpBadges() {
  const [magnet, setMagnet] = useState(false);
  const [thruster, setThruster] = useState(false);

  useEffect(() => {
    const id = setInterval(() => {
      setMagnet(isPowerupActive("magnet"));
      setThruster(isPowerupActive("thruster"));
    }, 120);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="mt-2 flex justify-center gap-2" role="status" aria-live="polite">
      <AnimatePresence>
        {magnet && (
          <Badge
            key="magnet"
            icon={<Magnet className="size-3.5" strokeWidth={2.5} />}
            label="Magnet"
            tint="text-blob-blue border-blob-blue/50 bg-blob-blue/15"
          />
        )}
        {thruster && (
          <Badge
            key="thruster"
            icon={<Rocket className="size-3.5" strokeWidth={2.5} />}
            label="Thrust"
            tint="text-accent-warm border-accent-warm/50 bg-accent-warm/15"
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function Badge({ icon, label, tint }: { icon: React.ReactNode; label: string; tint: string }) {
  return (
    <motion.div
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.6, opacity: 0 }}
      transition={{ type: "spring", stiffness: 480, damping: 22 }}
      className={`flex items-center gap-1.5 rounded-full border px-3 py-1 font-ui text-xs font-bold backdrop-blur-md ${tint}`}
    >
      <span aria-hidden>{icon}</span>
      {label}
    </motion.div>
  );
}
