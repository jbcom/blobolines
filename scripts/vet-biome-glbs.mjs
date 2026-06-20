#!/usr/bin/env node
/**
 * Vet candidate biome-prop GLBs before copying them into the game: a GLB that references an
 * EXTERNAL image (a `uri` ending in .png/.jpg, e.g. Kenney's shared colormap.png) fails to decode
 * in headless Chromium and breaks the CI E2E (the C2.1d lesson). This parses each GLB's glTF JSON
 * chunk and reports, per file: external image URIs (DISQUALIFIER), embedded images (fine), face
 * count, and whether it's plain material-colored. Exits non-zero if any candidate is disqualified.
 *
 * Usage: node scripts/vet-biome-glbs.mjs <file1.glb> <file2.glb> ...
 */
import { readFileSync } from "node:fs";

function parseGlb(path) {
  const buf = readFileSync(path);
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error(`${path}: not a GLB`);
  const jsonLen = buf.readUInt32LE(12);
  const json = JSON.parse(buf.subarray(20, 20 + jsonLen).toString("utf8"));
  const images = json.images ?? [];
  const external = images.filter((im) => typeof im.uri === "string" && /\.(png|jpe?g|webp)$/i.test(im.uri));
  const embedded = images.filter((im) => im.bufferView !== undefined || (im.uri ?? "").startsWith("data:"));
  let faces = 0;
  for (const m of json.meshes ?? [])
    for (const p of m.primitives ?? []) {
      const acc = json.accessors?.[p.indices];
      if (acc) faces += Math.floor(acc.count / 3);
    }
  return { external, embedded, faces, materials: (json.materials ?? []).length };
}

let bad = 0;
for (const path of process.argv.slice(2)) {
  try {
    const r = parseGlb(path);
    const ok = r.external.length === 0;
    if (!ok) bad++;
    const tag = ok ? "OK " : "BAD";
    const ext = r.external.length ? ` EXTERNAL=${r.external.map((i) => i.uri).join(",")}` : "";
    console.log(`${tag} faces=${r.faces} mats=${r.materials} emb=${r.embedded.length}${ext}  ${path}`);
  } catch (e) {
    bad++;
    console.log(`BAD parse-error ${path}: ${e.message}`);
  }
}
process.exit(bad ? 1 : 0);
