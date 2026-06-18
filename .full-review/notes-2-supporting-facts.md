# Phase 2 — supporting facts (gathered by orchestrator, non-overlapping with agents)

## Dependency / supply chain
- `pnpm audit`: **0 vulnerabilities** (info/low/moderate/high/critical all 0) across 367 deps. "Latest-everything" policy verified holding.
- `pnpm outdated`: only 3 trivial lags — `@types/node` 24→25 (dev), `lucide-react` 1.18→1.20, `happy-dom` 20.10.4→20.10.5 (dev). No security relevance.

## Secrets
- `.env` at root contains a **live `ITCH_API_KEY`** (plaintext). BUT: `.gitignore:55-57` ignores `.env`/`.env.*` (keeps `.env.example`); `git ls-files .env` → not tracked. Not leaked to git.
- Key is referenced only in `scripts/itch-library.mjs` + `scripts/fetch-itch-assets.mjs` (local asset-curation pipeline), never in `src/`/`app/` (never shipped to the client bundle).
- Assessment: **Low** — local dev-only credential, gitignored, not in shipped bundle, not in git history (verify history separately if desired). Rotation hygiene note at most.

## Injection surface
- Grep across `src app index.html` for `dangerouslySetInnerHTML | eval( | new Function | .innerHTML | document.write` → **NONE**. Clean.

## `?dev` production exposure
- `app/views/DevHarness.tsx:16`: DevHarness mounts when `import.meta.env.DEV` **OR** `new URLSearchParams(location.search).has("dev")`. So `?dev` in the URL enables the dev harness in the PRODUCTION Pages build. Low/Medium — it's a debug overlay, no privileged data, but it's an unintended prod-exposed dev surface. (Security agent owns the authoritative finding + severity.)

## CI / workflow hardening
- All 3 workflows default to least-privilege `permissions: contents: read`.
- Elevated scopes are per-job and narrow: `cd.yml` deploy job `pages: write` + `id-token: write` (OIDC Pages — correct); `release.yml` release-please job `contents: write` + `pull-requests: write`, publish job `contents: write`. Appropriate.
- No `pull_request_target`; no `${{ github.event.* }}` untrusted-input interpolation → no script-injection vector. Clean.
- `actions/checkout@v6` pinned by major.
