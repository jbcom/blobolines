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

const GLB_MAGIC = 0x46546c67; // "glTF"
const JSON_CHUNK = 0x4e4f534a; // "JSON"

function parseGlb(path) {
  const buf = readFileSync(path);
  // Bounds-check before every read so a truncated/garbage file throws a clear error, not a RangeError.
  if (buf.length < 20) throw new Error(`${path}: too small to be a GLB (${buf.length} bytes)`);
  if (buf.readUInt32LE(0) !== GLB_MAGIC) throw new Error(`${path}: bad GLB magic`);
  if (buf.readUInt32LE(16) !== JSON_CHUNK) throw new Error(`${path}: chunk 0 is not JSON`);
  const jsonLen = buf.readUInt32LE(12);
  if (20 + jsonLen > buf.length) throw new Error(`${path}: JSON chunk length exceeds file`);
  const json = JSON.parse(buf.subarray(20, 20 + jsonLen).toString("utf8"));
  const images = json.images ?? [];
  // An image is EXTERNAL (the disqualifier — fails to decode in headless SwiftShader) when it points
  // at a separate file via `uri`. A `data:` URI is self-contained, and a `bufferView` image is
  // embedded in the GLB's binary chunk — both are fine. So: external = has a uri that isn't a data:
  // URI. This is spec-driven (no fragile extension/query-string guessing).
  const external = images.filter((im) => typeof im.uri === "string" && !im.uri.startsWith("data:"));
  const embedded = images.filter(
    (im) => im.bufferView !== undefined || (im.uri ?? "").startsWith("data:"),
  );
  let faces = 0;
  for (const m of json.meshes ?? [])
    for (const p of m.primitives ?? []) {
      // Indexed primitives: faces = indices/3. Non-indexed: fall back to a POSITION accessor's
      // vertex count /3 (glTF allows non-indexed geometry, where every 3 verts is a triangle).
      const idxAcc = p.indices !== undefined ? json.accessors?.[p.indices] : undefined;
      const posAcc = p.attributes?.POSITION !== undefined ? json.accessors?.[p.attributes.POSITION] : undefined;
      const count = idxAcc?.count ?? posAcc?.count ?? 0;
      faces += Math.floor(count / 3);
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
