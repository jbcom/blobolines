import type { WorldDifficulty } from "../src/core/types";
import { ROUTE_DIFFICULTIES, verifySeedRoute } from "../src/world";

interface Args {
  seed: string;
  difficulty: WorldDifficulty;
  targetY: number;
  json: boolean;
}

function usage(): string {
  return [
    "Usage: pnpm verify:seed -- <seed phrase> [--difficulty easy|medium|hard|blobmare|ultra|one-wrong-move] [--meters 5000] [--json]",
    "",
    "Examples:",
    "  pnpm verify:seed -- peppy-coral-noodle --difficulty easy --meters 5000",
    "  pnpm verify:seed -- bouncy-bright-blob --difficulty one-wrong-move --meters 1200 --json",
  ].join("\n");
}

function parseDifficulty(value: string): WorldDifficulty {
  const normalized = value.trim().toLowerCase();
  if (normalized === "easy" || normalized === "ready") return "ready";
  if (normalized === "ultra" || normalized === "ultra-blobmare") return "ultraBlobmare";
  if (normalized === "one-wrong-move" || normalized === "onewrongmove") return "oneWrongMove";
  if (ROUTE_DIFFICULTIES.includes(normalized as WorldDifficulty)) {
    return normalized as WorldDifficulty;
  }
  throw new Error(`Unknown difficulty "${value}".`);
}

function parseArgs(argv: string[]): Args {
  const seedParts: string[] = [];
  let difficulty: WorldDifficulty = "ready";
  let targetY = 5000;
  let json = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      console.log(usage());
      process.exit(0);
    }
    if (arg === "--difficulty" || arg === "-d") {
      const value = argv[++i];
      if (!value) throw new Error("--difficulty requires a value");
      difficulty = parseDifficulty(value);
      continue;
    }
    if (arg === "--meters" || arg === "--target-y" || arg === "-m") {
      const value = argv[++i];
      if (!value) throw new Error("--meters requires a value");
      targetY = Number(value);
      if (!Number.isFinite(targetY) || targetY <= 0) throw new Error("--meters must be positive");
      continue;
    }
    if (arg === "--json") {
      json = true;
      continue;
    }
    seedParts.push(arg);
  }

  const seed = seedParts.join(" ").trim();
  if (!seed) throw new Error(`Seed phrase is required.\n\n${usage()}`);
  return { seed, difficulty, targetY, json };
}

function printHuman(report: ReturnType<typeof verifySeedRoute>) {
  const status = report.ok ? "PASS" : "FAIL";
  console.log(`${status} ${report.seedPhrase} (${report.difficultyLabel})`);
  console.log(
    [
      `target=${report.targetY.toFixed(0)}m`,
      `highest=${report.highestY.toFixed(1)}m`,
      `pads=${report.padCount}`,
      `pairs=${report.pairCount}`,
      `variants=${report.minProofVariants}-${report.maxProofVariants}/${report.minRequiredProofVariants}-${report.maxRequiredProofVariants}`,
      `min-gap=${report.minLateralGap.toFixed(2)}m`,
      `min-lip=${report.minLipClearance.toFixed(2)}m`,
      `min-precision=${report.minLandingPrecision.toFixed(2)}`,
    ].join("  "),
  );
  console.log(
    `modes flat=${report.sourceModes.flat} moving=${report.sourceModes.moving} canted=${report.sourceModes.canted} wobbler=${report.sourceModes.wobbler}`,
  );
  for (const failure of report.failures.slice(0, 20)) {
    console.error(
      `pair ${failure.pairIndex} (${failure.sourceId.toFixed(2)} -> ${failure.targetId.toFixed(2)}): ${failure.reason}`,
    );
  }
  if (report.failures.length > 20) {
    console.error(`...and ${report.failures.length - 20} more failures`);
  }
}

try {
  const args = parseArgs(process.argv.slice(2));
  const report = verifySeedRoute({
    seed: args.seed,
    difficulty: args.difficulty,
    targetY: args.targetY,
  });
  if (args.json) console.log(JSON.stringify(report, null, 2));
  else printHuman(report);
  process.exit(report.ok ? 0 : 1);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(2);
}
