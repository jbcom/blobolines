/**
 * Splat decal painter (pure-ish canvas helper). When the blob lands, a colored goo
 * splat is painted onto a per-pad Canvas2D texture that overlays the trampoline surface
 * — cheap, accumulating goo smears (the harvest-decided approach over decal geometry).
 * The DOM/Canvas2D bits are isolated here; the R3F side just uses the resulting texture.
 */

export interface SplatCanvas {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  /** Paint a goo blob at normalized pad coords [0,1] with a color + size. */
  paint: (u: number, v: number, color: string, size: number) => void;
  /** Fade the whole canvas slightly toward transparent (call sparingly). */
  fade: (amount: number) => void;
}

/** Create a splat canvas of the given pixel resolution (square). */
export function createSplatCanvas(resolution = 256): SplatCanvas {
  const canvas = document.createElement("canvas");
  canvas.width = resolution;
  canvas.height = resolution;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("createSplatCanvas: 2D context unavailable");

  const paint = (u: number, v: number, color: string, size: number) => {
    const x = u * resolution;
    const y = v * resolution;
    const r = size * resolution;
    // Irregular goo blob: a few overlapping radial-gradient lobes.
    for (let i = 0; i < 5; i++) {
      const ox = x + (i === 0 ? 0 : (hashed(i, x) - 0.5) * r * 1.4);
      const oy = y + (i === 0 ? 0 : (hashed(i + 9, y) - 0.5) * r * 1.4);
      const lobe = r * (i === 0 ? 1 : 0.5 + hashed(i + 3, x + y) * 0.5);
      const g = ctx.createRadialGradient(ox, oy, 0, ox, oy, lobe);
      g.addColorStop(0, color);
      g.addColorStop(0.7, color);
      g.addColorStop(1, "transparent");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(ox, oy, lobe, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  const fade = (amount: number) => {
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = `rgba(0,0,0,${Math.max(0, Math.min(1, amount))})`;
    ctx.fillRect(0, 0, resolution, resolution);
    ctx.globalCompositeOperation = "source-over";
  };

  return { canvas, ctx, paint, fade };
}

/** Deterministic [0,1) hash from two numbers — small irregular lobe placement. */
function hashed(a: number, b: number): number {
  const s = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return s - Math.floor(s);
}
