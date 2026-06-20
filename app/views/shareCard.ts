import { palette } from "@/styles/tokens";

/**
 * Renders a branded PNG share card for a run, drawn directly to an offscreen <canvas> (no
 * html2canvas / extra dependency — full control + deterministic output). Used by the GameOver
 * share button to attach an IMAGE to the native share sheet (navigator.share with files), turning a
 * daily result into something visually shareable. Falls back to text-only share where image share
 * isn't supported (see GameOver).
 *
 * 1200×630 (the standard social/OG ratio). Pure presentation — takes plain stats, returns a Blob.
 */

export interface ShareCardStats {
  score: number;
  height: number;
  /** "Daily YYYY-MM-DD" for a daily run, or null for a normal run. */
  dailyLabel: string | null;
  /** Daily streak in days, or 0 to hide the streak line. */
  streakDays: number;
  crystals: number;
  maxCombo: number;
}

const W = 1200;
const H = 630;

/** Rounded-rect path helper (canvas has no native rounded rect on all targets). */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Draw the card and return it as a PNG Blob. Async because canvas.toBlob is callback-based and we
 * want to await the encode. Returns null if a 2D context isn't available (very old/headless env).
 */
export async function renderShareCard(stats: ShareCardStats): Promise<Blob | null> {
  // Canvas fillText uses whatever's loaded NOW — it doesn't wait for web fonts. Ensure the brand
  // faces are active before drawing, or a first-share (fonts still streaming) would render the card
  // in fallback system fonts and break the branding. Best-effort: ignore a load failure and draw
  // with whatever's available rather than block the share.
  if (typeof document !== "undefined" && document.fonts) {
    await Promise.all([
      document.fonts.load("700 64px 'Fredoka Variable'"),
      document.fonts.load("600 30px 'Nunito Variable'"),
    ]).catch(() => {});
  }

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // Warm dark backdrop with a soft vertical glow — reads as the game's neon-dusk mood.
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, palette.cloud.vortex); // deep violet top
  bg.addColorStop(1, palette.blob.ink); // warm ink bottom
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Gold frame.
  ctx.strokeStyle = palette.tramp.gold;
  ctx.lineWidth = 8;
  roundRect(ctx, 24, 24, W - 48, H - 48, 36);
  ctx.stroke();

  ctx.textAlign = "center";

  // Wordmark.
  ctx.fillStyle = palette.cream;
  ctx.font = "700 64px 'Fredoka Variable', system-ui, sans-serif";
  ctx.fillText("BLOBOLINES", W / 2, 130);

  // Daily / normal sub-label.
  ctx.fillStyle = palette.tramp.ice;
  ctx.font = "600 30px 'Nunito Variable', system-ui, sans-serif";
  ctx.fillText(stats.dailyLabel ?? "Free Climb", W / 2, 178);

  // The hero SCORE.
  ctx.fillStyle = palette.tramp.gold;
  ctx.font = "800 150px 'Fredoka Variable', system-ui, sans-serif";
  ctx.fillText(stats.score.toLocaleString(), W / 2, 360);

  // Height under the score.
  ctx.fillStyle = palette.cream;
  ctx.font = "700 44px 'Fredoka Variable', system-ui, sans-serif";
  ctx.fillText(`${stats.height.toLocaleString()} m`, W / 2, 422);

  // Stat row: crystals · combo · streak (streak only when ≥ 1).
  const stats3: string[] = [
    `💎 ${stats.crystals}`,
    `🔥 x${stats.maxCombo}`,
    ...(stats.streakDays >= 1 ? [`🗓️ ${stats.streakDays}-day streak`] : []),
  ];
  ctx.fillStyle = palette.tramp.orange;
  ctx.font = "700 34px 'Nunito Variable', system-ui, sans-serif";
  ctx.fillText(stats3.join("    ·    "), W / 2, 510);

  // Footer URL.
  ctx.fillStyle = palette.cloud.warm;
  ctx.font = "600 26px 'Nunito Variable', system-ui, sans-serif";
  ctx.fillText("jbcom.github.io/blobolines", W / 2, 578);

  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => {
      // Release the ~3 MB (1200×630×4) backing store immediately — on a low-RAM mid-tier Android
      // (the render-budget target) GC may lag a per-press allocation otherwise. The canvas was never
      // in the DOM, so zeroing it just frees the pixels early.
      canvas.width = 0;
      canvas.height = 0;
      resolve(blob);
    }, "image/png");
  });
}
