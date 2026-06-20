import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { PNG } from "pngjs";
import { expect, test } from "./fixtures";

test.setTimeout(45_000);

const ARTIFACTS_DIR = join(process.cwd(), "artifacts");
const ROUTE_PROOF_PREFIX = "route-proof-";
const ROUTE_PROOF_COUNT = 8;
const MIN_PROOF_OVERLAY_PIXELS = 80;
const MAX_BLOB_ORANGE_PIXELS = 6000;

type Vec3 = readonly [number, number, number];

interface RouteProofVariant {
  landing: Vec3;
  samples: readonly Vec3[];
  clearance: number;
}

interface RouteProof extends RouteProofVariant {
  variants: readonly RouteProofVariant[];
}

interface ProofPad {
  id: number;
  routeIndex: number;
  position: Vec3;
  width: number;
  depth: number;
  type: string;
  goldenPath?: RouteProof;
}

interface RouteProofArtifact {
  label: string;
  pairIndex: number;
  from: ProofPad;
  to: ProofPad;
  proof?: RouteProof;
  snapshot: {
    routeDifficulty: string;
    proofVariants: number;
    seedPhrase: string;
  };
}

function cleanRouteProofArtifacts(): void {
  mkdirSync(ARTIFACTS_DIR, { recursive: true });
  for (const file of readdirSync(ARTIFACTS_DIR)) {
    if (file.startsWith(ROUTE_PROOF_PREFIX)) rmSync(join(ARTIFACTS_DIR, file), { force: true });
  }
}

function routeProofFiles(ext: "json" | "png"): string[] {
  if (!existsSync(ARTIFACTS_DIR)) return [];
  return readdirSync(ARTIFACTS_DIR)
    .filter((file) => file.startsWith(ROUTE_PROOF_PREFIX) && file.endsWith(`.${ext}`))
    .sort()
    .map((file) => join(ARTIFACTS_DIR, file));
}

function readArtifact(file: string): RouteProofArtifact {
  return JSON.parse(readFileSync(file, "utf8")) as RouteProofArtifact;
}

function landingDistanceXZ(landing: Vec3, pad: ProofPad): number {
  return Math.hypot(landing[0] - pad.position[0], landing[2] - pad.position[2]);
}

function targetRadius(pad: ProofPad): number {
  return Math.max(pad.width, pad.depth) * 0.5;
}

function analyzeProofPixels(file: string): { proof: number; blobOrange: number } {
  const png = PNG.sync.read(readFileSync(file));
  let proof = 0;
  let blobOrange = 0;
  for (let i = 0; i < png.data.length; i += 4) {
    const r = png.data[i];
    const g = png.data[i + 1];
    const b = png.data[i + 2];
    const a = png.data[i + 3];
    if (a <= 120) continue;
    if (r > 150 && g < 165 && b < 190 && r > g * 1.15 && r > b * 0.85) {
      proof++;
    }
    if (a > 160 && r > 180 && g > 70 && g < 190 && b < 120) {
      blobOrange++;
    }
  }
  return { proof, blobOrange };
}

test("dev route proof sequence emits visible certified parabola evidence", async ({ page }) => {
  cleanRouteProofArtifacts();

  await page.goto("/?dev");
  await page.getByRole("button", { name: "DEV" }).click();
  await page.getByRole("button", { name: /start run/ }).click();
  await page.waitForTimeout(1500); // Rapier WASM init + generated starter tower.

  await page.getByRole("button", { name: /route proof sequence/ }).click();

  await expect
    .poll(
      () => ({
        json: routeProofFiles("json").length,
        png: routeProofFiles("png").length,
      }),
      { timeout: 20_000, intervals: [250, 500, 1000] },
    )
    .toEqual({ json: ROUTE_PROOF_COUNT, png: ROUTE_PROOF_COUNT });

  const jsonFiles = routeProofFiles("json");
  const pngFiles = routeProofFiles("png");

  for (let i = 0; i < ROUTE_PROOF_COUNT; i++) {
    const artifact = readArtifact(jsonFiles[i]);
    const proof = artifact.proof ?? artifact.from.goldenPath;
    expect(proof, `${artifact.label} should include a golden path proof`).toBeTruthy();
    if (!proof) continue;

    expect(artifact.pairIndex).toBe(i);
    expect(artifact.from.routeIndex).toBe(i);
    expect(artifact.to.routeIndex).toBe(i + 1);
    expect(artifact.snapshot.routeDifficulty).toBe("ready");
    expect(artifact.snapshot.seedPhrase.length).toBeGreaterThan(0);
    expect(artifact.snapshot.proofVariants).toBe(3);
    expect(proof.variants.length).toBe(artifact.snapshot.proofVariants);
    expect(proof.samples.length).toBeGreaterThan(8);
    expect(proof.clearance).toBeGreaterThan(0);

    const radius = targetRadius(artifact.to);
    expect(landingDistanceXZ(proof.landing, artifact.to)).toBeLessThanOrEqual(radius + 0.05);
    for (const variant of proof.variants) {
      expect(variant.samples.length).toBeGreaterThan(8);
      expect(variant.clearance).toBeGreaterThan(0);
      expect(landingDistanceXZ(variant.landing, artifact.to)).toBeLessThanOrEqual(radius + 0.05);
    }

    const pixels = analyzeProofPixels(pngFiles[i]);
    expect(pixels.proof, `${pngFiles[i]} should show the red proof overlay`).toBeGreaterThan(
      MIN_PROOF_OVERLAY_PIXELS,
    );
    expect(
      pixels.blobOrange,
      `${pngFiles[i]} should frame the route proof, not zoom into the blob`,
    ).toBeLessThan(MAX_BLOB_ORANGE_PIXELS);
  }
});
