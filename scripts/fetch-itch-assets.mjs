#!/usr/bin/env node
/**
 * Blobolines itch.io asset fetch. Pulls the curated allow-list of OWNED itch.io packs into
 * raw-assets/archives/, then extracts into raw-assets/extracted/<slug>/. Idempotent — skips
 * archives already present with matching size + md5. Self-contained: reads ITCH_API_KEY from
 * .env (gitignored) and the owned-keys cache at .itch-cache/library.json (built by
 * scripts/itch-library.mjs). raw-assets/ + .itch-cache/ are gitignored — everything is hoarded
 * locally, and only curated keepers get promoted into public/assets/audio/.
 *
 * Pattern + security hardening adapted from a-good-old-fashioned-adventure/scripts (https-only
 * downloads, basename-stripped paths). This repo carries its OWN copy — nothing reaches into
 * another repository at runtime.
 *
 * Allow-list maps to the Blobolines arcade-audio identity (memory blobolines-audio-identity —
 * the game's OWN bouncy/celebratory voice, NOT borrowed RPG music):
 *   - Casual Upbeat Game Music Pack → the core in-game music (happy bouncy loops — the vibe)
 *   - Calm Menu Music Pack          → menu music
 *   - Retro Combat Music Pack       → high-altitude / space intensity track
 *   - Victory & Level Complete      → milestone / record celebration stingers
 *   - UI Sound Effects Pack         → hover/click/confirm/cancel/popup/coin interface cues
 *   - Explosion Sound Effects Pack  → the game-over death sting (gooey blowout)
 *   - Ultimate Ambient SFX Pack     → per-biome ambient beds
 *
 * Usage:
 *   node scripts/fetch-itch-assets.mjs        # download + extract
 *   node scripts/fetch-itch-assets.mjs --dry  # list what would be downloaded
 */

import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ARCHIVES = join(ROOT, "raw-assets", "archives");
const EXTRACTED = join(ROOT, "raw-assets", "extracted");
const LIBRARY = join(ROOT, ".itch-cache", "library.json");

const DRY = process.argv.includes("--dry");

// API key from the environment first; the gitignored .env is a local convenience read.
function readApiKey() {
  if (process.env.ITCH_API_KEY) return process.env.ITCH_API_KEY;
  const envPath = join(ROOT, ".env");
  if (!existsSync(envPath)) return undefined;
  return readFileSync(envPath, "utf8").match(/ITCH_API_KEY=(\S+)/)?.[1];
}
const KEY = readApiKey();
if (!KEY) {
  console.error("ITCH_API_KEY missing — set the env var or add it to .env");
  process.exit(1);
}

// Exact titles from .itch-cache/library.json (chosen by name — the packs are descriptively named).
const ALLOW_LIST = new Set([
  "Casual Upbeat Game Music Pack – 10 Happy Loops",
  "Calm Menu Music Pack – Perfect for Game Menus & UI (10 Loops)",
  "Retro Combat Music Pack - 12 Chiptune Battle Loops",
  "Victory & Level Complete Music Pack – 24 Game Stingers",
  "UI Sound Effects Pack – 40 Game Interface Sounds (WAV + MP3)",
  "Explosion Sound Effects Pack for Games",
  "Ultimate Ambient Sound Effects Pack",
]);

const library = JSON.parse(readFileSync(LIBRARY, "utf8"));
const packs = library.filter((p) => ALLOW_LIST.has(p.title));
const missing = [...ALLOW_LIST].filter((t) => !packs.some((p) => p.title === t));
if (missing.length > 0) {
  console.error(`allow-list titles missing from library cache:\n  ${missing.join("\n  ")}`);
  process.exit(1);
}
console.log(`Processing ${packs.length}/${library.length} allow-listed packs (dry=${DRY})`);

mkdirSync(ARCHIVES, { recursive: true });
mkdirSync(EXTRACTED, { recursive: true });

const ARCHIVE_RE = /\.(zip|rar|7z)$/i;
const LOOSE_RE = /\.(wav|mp3|ogg)$/i;
let downloaded = 0;
let skipped = 0;
let failed = 0;

const slugify = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

for (const pack of packs) {
  const uploadsResp = await apiGet(
    `/api/1/key/game/${pack.gameId}/uploads?download_key_id=${pack.keyId}`,
  );
  const all = uploadsResp?.uploads ?? [];
  const archives = all.filter((u) => ARCHIVE_RE.test(u.filename ?? ""));
  const uploads =
    archives.length > 0 ? archives : all.filter((u) => LOOSE_RE.test(u.filename ?? ""));

  if (uploads.length === 0) {
    console.warn(`  [${pack.title}] no usable uploads found`);
    failed++;
    continue;
  }

  for (const upload of uploads) {
    const looseDir = join(EXTRACTED, slugify(pack.title));
    const isArchive = ARCHIVE_RE.test(upload.filename);
    if (!isArchive && !DRY) mkdirSync(looseDir, { recursive: true });
    // basename() strips any path the API could smuggle (zip-slip bounded: raw-assets is
    // gitignored + sources are own purchases over https).
    const safeName = basename(upload.filename);
    const dest = isArchive ? join(ARCHIVES, safeName) : join(looseDir, safeName);

    // Idempotency skip: try to read the existing file ONCE (no exists/stat pre-check, so there's
    // no TOCTOU window) — if it's already the right size + md5, skip the re-download. A missing
    // file throws ENOENT, caught → fall through to download.
    try {
      const existing = readFileSync(dest);
      if (
        existing.length === upload.size &&
        createHash("md5").update(existing).digest("hex") === upload.md5_hash
      ) {
        skipped++;
        continue;
      }
    } catch {
      // not present (or unreadable) — download it below.
    }

    if (DRY) {
      console.log(`  WOULD DOWNLOAD: ${upload.filename} (${upload.size} bytes) ← ${pack.title}`);
      downloaded++;
      continue;
    }

    const dlInfo = await apiGet(
      `/api/1/key/upload/${upload.id}/download?download_key_id=${pack.keyId}`,
    );
    if (!dlInfo?.url) {
      console.error(`  [${pack.title}] no signed URL in response`);
      failed++;
      continue;
    }
    if (!dlInfo.url.startsWith("https://")) {
      console.error(`  [${pack.title}] refusing non-https download URL: ${dlInfo.url}`);
      failed++;
      continue;
    }

    // --proto/--proto-redir '=https' constrain the initial request AND every redirect hop to https.
    const result = spawnSync(
      "curl",
      ["-sS", "-fL", "--proto", "=https", "--proto-redir", "=https", "-o", dest, dlInfo.url],
      { stdio: "inherit" },
    );
    if (result.status !== 0 || statSync(dest).size !== upload.size) {
      console.error(`  [${pack.title}] download failed or size mismatch for ${upload.filename}`);
      failed++;
      continue;
    }
    console.log(`  ✓ ${upload.filename} (${upload.size} bytes) ← ${pack.title}`);
    downloaded++;
  }
}

if (!DRY) {
  console.log("\nExtracting…");
  for (const f of readdirSync(ARCHIVES)) {
    if (!ARCHIVE_RE.test(f)) continue;
    const slug = slugify(f.replace(ARCHIVE_RE, ""));
    const target = join(EXTRACTED, slug);
    if (existsSync(target) && statSync(target).mtimeMs >= statSync(join(ARCHIVES, f)).mtimeMs)
      continue;
    mkdirSync(target, { recursive: true });
    try {
      if (/\.zip$/i.test(f)) {
        execFileSync("unzip", ["-q", "-o", join(ARCHIVES, f), "-d", target], { stdio: "inherit" });
      } else {
        execFileSync("unar", ["-quiet", "-o", target, join(ARCHIVES, f)], { stdio: "inherit" });
      }
      console.log(`  ✓ extracted ${f} → ${slug}`);
    } catch {
      console.error(`  ✗ failed to extract ${f}`);
    }
  }
}

console.log(`\nDone. downloaded=${downloaded} skipped=${skipped} failed=${failed}`);

async function apiGet(path) {
  const result = spawnSync(
    "curl",
    ["-sS", "-fL", "-H", `Authorization: Bearer ${KEY}`, `https://itch.io${path}`],
    { encoding: "utf8" },
  );
  if (result.status !== 0) {
    console.error(`  apiGet failed: ${path}`);
    return null;
  }
  try {
    return JSON.parse(result.stdout);
  } catch {
    console.error(`  apiGet: non-JSON response for ${path}`);
    return null;
  }
}
