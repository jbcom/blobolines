import { expect, test } from "vitest";
import { renderShareCard, type ShareCardStats } from "../shareCard";

const base: ShareCardStats = {
  score: 12_345,
  height: 678,
  dailyLabel: "Daily 2026-06-20",
  streakDays: 5,
  crystals: 9,
  maxCombo: 7,
};

/** Read a Blob's first bytes to confirm the PNG magic number (real encoded image, not an empty/HTML
 *  blob). PNG starts with 89 50 4E 47. */
async function isPng(blob: Blob): Promise<boolean> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  return buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
}

test("renderShareCard produces a non-trivial PNG blob for a daily run", async () => {
  const blob = await renderShareCard(base);
  expect(blob, "a 2D context should be available in the browser test env").toBeTruthy();
  if (!blob) return;
  expect(blob.type).toBe("image/png");
  // A 1200×630 painted card encodes to well over a few KB — proves it actually drew pixels.
  expect(blob.size).toBeGreaterThan(3000);
  expect(await isPng(blob)).toBe(true);
});

test("renders a normal (non-daily) run without the daily label or streak", async () => {
  const blob = await renderShareCard({ ...base, dailyLabel: null, streakDays: 0 });
  expect(blob).toBeTruthy();
  if (!blob) return;
  // Still a valid, non-trivial PNG — the layout just omits the daily/streak lines.
  expect(await isPng(blob)).toBe(true);
  expect(blob.size).toBeGreaterThan(3000);
});
