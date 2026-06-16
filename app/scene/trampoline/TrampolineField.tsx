import { useWorldStore } from "@/state";
import { Trampoline } from "./Trampoline";

/**
 * Renders the generated tower of trampolines from the world store. New pads appear as
 * the loop extends the tower while the blob climbs. Keyed by index (stable append-only).
 */
interface TrampolineFieldProps {
  onImpact?: (index: number, speed: number) => void;
}

export function TrampolineField({ onImpact }: TrampolineFieldProps) {
  const trampolines = useWorldStore((s) => s.trampolines);

  return (
    <>
      {trampolines.map((t, i) => (
        <Trampoline
          // biome-ignore lint/suspicious/noArrayIndexKey: append-only list, index is stable
          key={i}
          position={t.position}
          width={t.width}
          depth={t.depth}
          type={t.type}
          onImpact={(speed) => onImpact?.(i, speed)}
        />
      ))}
    </>
  );
}
