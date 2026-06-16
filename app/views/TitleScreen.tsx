import { Play } from "lucide-react";
import { motion } from "motion/react";
import { initAudio } from "@/audio";
import { useGameStore, useWorldStore } from "@/state";

/**
 * Title / main menu. The blob identity, the one-line pitch, and the launch CTA into
 * the height-chase. Bottom-anchored so the 3D blob preview reads above it.
 */
export function TitleScreen() {
  const setPhase = useGameStore((s) => s.setPhase);
  const resetRun = useGameStore((s) => s.resetRun);
  const resetWorld = useWorldStore((s) => s.reset);
  const best = useGameStore((s) => s.progress.bestHeight);

  const play = () => {
    // This click is the user gesture that unlocks the AudioContext.
    void initAudio();
    resetRun();
    resetWorld();
    setPhase("playing");
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="pointer-events-auto flex h-full w-full flex-col items-center justify-end gap-6 px-6"
      style={{ paddingBottom: "calc(var(--safe-bottom) + 2.5rem)" }}
    >
      <div className="flex flex-col items-center text-center">
        <motion.h1
          initial={{ scale: 0.85, y: 12 }}
          animate={{ scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 18 }}
          className="font-display text-hero font-bold tracking-tight text-cream drop-shadow-[0_4px_0_rgba(0,0,0,0.45)]"
        >
          Blobolines
        </motion.h1>
        <p className="mt-1 max-w-xs font-ui text-base text-fg-muted">
          Bounce a gooey blob as high as you can up endless springy trampolines.
        </p>
      </div>

      <motion.button
        type="button"
        onClick={play}
        whileTap={{ scale: 0.94 }}
        whileHover={{ scale: 1.04 }}
        transition={{ type: "spring", stiffness: 400, damping: 18 }}
        className="flex items-center gap-3 rounded-2xl bg-accent px-10 py-4 font-display text-xl font-bold uppercase tracking-wider text-bg shadow-[var(--glow-blue)]"
      >
        Play <Play className="size-5 fill-current" />
      </motion.button>

      {best > 0 && (
        <span className="font-ui text-xs font-semibold text-fg-subtle">
          Best climb · <span className="text-tramp-gold">{best}m</span>
        </span>
      )}
    </motion.div>
  );
}
