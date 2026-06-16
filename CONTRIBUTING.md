# Contributing to Blobolines

Thanks for helping bounce blobs higher. This is a TypeScript R3F game; here's how to get
productive fast.

## Setup

```sh
pnpm install
pnpm dev            # http://localhost:5173  (append /?dev for the dev harness)
```

Requires Node ≥ 22 and pnpm (the repo is pnpm-only — no npm/yarn).

## Workflow

1. Branch off `main` (`feat/...`, `fix/...`). Never commit to `main` directly.
2. Make focused changes; keep modules small and single-responsibility, each package with
   a barrel `index.ts`.
3. Verify before committing:
   ```sh
   pnpm lint && pnpm typecheck && pnpm test && pnpm test:browser
   ```
   For render/physics changes, also run the game (PLAY entry) and the e2e gate
   (`pnpm test:e2e`) — see `AGENTS.md` → "Verifying gameplay".
4. Commit with [Conventional Commits](https://www.conventionalcommits.org/)
   (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `perf:`, `test:`, `ci:`, `build:`).
5. Open a PR. CI runs lint · typecheck · unit · Chromium fixtures · e2e · Android APK.
   Address review feedback; squash-merge when green. Versioning is automated by
   release-please — don't hand-edit `CHANGELOG.md` or pick versions.

## Conventions

- **Biome** is the linter/formatter (`pnpm format`). No ESLint/Prettier.
- **Tokens own the palette** — no raw hex in render/scene/UI/sim; add a token in
  `src/styles/tokens.ts`. The brand-hex gate will block raw hex.
- **Determinism** — no `Math.random()`/`performance.now()` in `src/sim`/`src/engine`; use
  `createRng` and the clock facade.
- **No stubs/TODOs/placeholders.** If it's committed, it works and is tested.
- Tests live beside code in `__tests__/`; visual/WebGL tests are `*.fixture.test.tsx` (run
  in real Chromium).

## Where things live

See `docs/ARCHITECTURE.md` for the full package map, `docs/GAME-DESIGN.md` for mechanics
+ tuning constants, `STANDARDS.md` for non-negotiables, and `AGENTS.md` for the deeper
operating guide (including the Rapier-WASM and goo-coordinate-space gotchas).

## License

By contributing you agree your contributions are licensed under the [MIT License](LICENSE).
