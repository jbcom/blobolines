# Phase 2A — Security Audit (security-auditor, opus)

**Scope:** full codebase. Client-side R3F/Rapier game, no backend/auth/accounts. `pnpm audit` clean.
**Verdict:** No Critical/High. Narrow surface, defensively written.

| Severity | Count | Findings |
|---|---|---|
| Critical | 0 | — |
| High | 0 | — |
| Medium | 1 | SEC-M1 no CSP/security headers on Pages |
| Low | 4 | SEC-L1 `?dev` in prod, SEC-L2 prod sourcemaps, SEC-L3 unvalidated persisted-state deserialization, SEC-L4 `allowBackup=true` |
| Info | 3 | dev capture middleware, itch pipeline, CI hygiene |

## Medium
### SEC-M1 — No CSP / security headers on GitHub Pages deploy
CWE-693, CVSS 4.3. `index.html`, `cd.yml`. Pages can't set response headers; `index.html` has no `<meta http-equiv="CSP">`. Low real impact (no auth/cookies/user-data, no current XSS sink) — value is defense-in-depth against a future injected-script regression. **Fix:** add tuned meta CSP (needs `script-src 'self' 'wasm-unsafe-eval'` for Rapier WASM, `worker-src 'self' blob:`, `img-src 'self' data: blob:`, `style-src 'self' 'unsafe-inline'`); validate against a real build (WASM init + canvas toDataURL/blob workers). Android already covered (`androidScheme:https`, no allowNavigation).

## Low
### SEC-L1 — Dev harness reachable in prod via `?dev`
CWE-489, CVSS 2.6. `app/views/DevHarness.tsx:14-16`. `?dev` branch NOT gated on `import.meta.env.DEV`, so `…/blobolines/?dev` mounts full DevHarness in prod (force phases, set altitude/combo/skin, trigger game-over). No privilege boundary — single-player local, can only cheat own client. Anti-pattern. **Fix:** gate the `?dev` escape on dev builds so it tree-shakes out (`const isDev = import.meta.env.DEV;` — `?dev` adds nothing on a dev server).

### SEC-L2 — Production sourcemaps
CWE-540, CVSS 3.1. `vite.config.ts` `build.sourcemap: true`. Leaks nothing secret (MIT public repo) — defensible for OSS game. Optional: `sourcemap: false` or `"hidden"` for the Pages build. No action required.

### SEC-L3 — Persisted game-state deserialized without schema validation
CWE-502, CVSS 2.9. `src/platform/storage.ts:13` (`JSON.parse(value) as T`), `src/state/persistence.ts:24-31`. Persisted progress/settings parsed unchecked then spread into store + audio engine. Only the user can tamper own storage; worst case `NaN` volumes/odd HUD in own session. try/catch prevents boot crash. **zod already a dep.** **Fix:** parse through zod schema, fall back to defaults; clamp volumes to [0,1] (also hardens audio against NaN gain).

### SEC-L4 — `android:allowBackup="true"`
CWE-530, CVSS 2.0. `android/app/src/main/AndroidManifest.xml`. Default Capacitor value; game state (high score/volumes/skin) non-sensitive. Optional `allowBackup="false"`. Acceptable as-is.

## Informational (reviewed, not vulns)
- **N1** `scripts/capturePlugin.ts` `/__capture` `/__diagnostics` — Vite serve-only (no-op in prod), label path-sanitized, 16MB cap, writes confined to `artifacts/`. Note `server: { host: true }` exposes it on LAN while `pnpm dev` runs (sanitized filename, no traversal). Optional `host: "localhost"` on hostile nets.
- **N2** itch pipeline well-hardened: HTTPS-only, `basename()` zip-slip bounded, md5+size idempotency no TOCTOU, owned-pack allow-list, key from env then gitignored `.env`, never in bundle. No tracked keystore/google-services.json/local.properties.
- **N3** CI least-privilege (`contents: read` default, scoped elevations, OIDC Pages, no `pull_request_target`, `--frozen-lockfile`). Optional hardening: pin actions to SHAs, add SLSA build-provenance attestation to the APK.

## Cleared (no exploitable finding)
- Dependency CVEs: 0 across 367 deps (Capacitor 8.4, React 19.2, three 0.184, Vite 8, zod 4).
- DOM injection/XSS: no dangerouslySetInnerHTML/eval/Function/innerHTML/document.write/dynamic-import; only fetch is dev-harness + itch scripts; asset URLs from `BASE_URL`+static names; share/clipboard carry only app's own score string.
- Capacitor bridge: `androidScheme:https`, no `server.url`/allowNavigation, FileProvider `exported=false` scoped to app `images/`, single launcher activity, INTERNET-only permission.
- Secrets: none hardcoded (grep hits were `--ease-bounce`/`tokens.ts`/`keepAwake`); `.env` gitignored + untracked.
- WASM load: Rapier + rapier3d-compat same chunk as three (preserves WASM relative-URL graph), same-origin served, no remote WASM, no external wasm-eval.

**Net:** worth doing — SEC-M1 (meta CSP); cheap wins SEC-L1 (drop `?dev` prod escape) + SEC-L3 (zod-validate persisted state). Rest acceptable as-is.
