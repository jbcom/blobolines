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
      // Fade to a fully-transparent copy of the SAME rgb, NOT the CSS keyword
      // "transparent" (= rgba(0,0,0,0)). Canvas lerps rgb across stops, so a black
      // end-stop drags edge texels toward black; with straight-alpha NormalBlending
      // those dark-rgb low-alpha edges paint as dark rings. Same-rgb end keeps the
      // edge the blob color all the way to a=0.
      g.addColorStop(1, toTransparent(color));
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

/**
 * Return `color` with alpha forced to 0, preserving its rgb. Supports `#rgb`,
 * `#rrggbb`, `#rrggbbaa`, and `rgb()/rgba()` inputs. Used as the outer gradient
 * stop so the lobe fades to transparent-of-the-blob-color rather than
 * transparent-black (the dark-ring bug).
 */
export function toTransparent(color: string): string {
  const c = color.trim();
  if (c.startsWith("#")) {
    const hex = c.slice(1);
    const expand = (h: string) =>
      h.length === 3 || h.length === 4
        ? h
            .slice(0, 3)
            .split("")
            .map((ch) => ch + ch)
            .join("")
        : h.slice(0, 6);
    const full = expand(hex);
    const r = Number.parseInt(full.slice(0, 2), 16);
    const g = Number.parseInt(full.slice(2, 4), 16);
    const b = Number.parseInt(full.slice(4, 6), 16);
    return `rgba(${r},${g},${b},0)`;
  }
  const m = c.match(/^rgba?\(([^)]+)\)$/i);
  if (m) {
    const [r, g, b] = m[1].split(",").map((p) => p.trim());
    return `rgba(${r},${g},${b},0)`;
  }
  // Unknown format (named color, hsl, etc.): fall back to the input so we at
  // least don't crash; named-color fades are not used by the splat painter.
  return c;
}

/** Deterministic [0,1) hash from two numbers — small irregular lobe placement. */
function hashed(a: number, b: number): number {
  const s = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return s - Math.floor(s);
}
