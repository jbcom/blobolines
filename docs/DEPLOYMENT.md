---
title: Deployment
updated: 2026-06-16
status: current
domain: ops
---

# Blobolines — Deployment

Two targets from one codebase: **web (GitHub Pages)** and **Android (Capacitor)**.

## Web — GitHub Pages

- **Workflow:** `.github/workflows/cd.yml` runs on push to `main` (+ manual dispatch).
- **Build:** `pnpm build:pages` (`GITHUB_PAGES=true` → Vite `base: '/blobolines/'`).
- **Publish:** `upload-pages-artifact` → `deploy-pages` (job-scoped `pages: write` +
  `id-token: write`).
- **Live:** https://jbcom.github.io/blobolines/ (Pages enabled, `build_type: workflow`).
- **Base path:** `/blobolines/` for Pages, `/` locally, `./` for Capacitor — switched in
  `vite.config.ts` by `GITHUB_PAGES` / `CAPACITOR` env.

The Rapier WASM is inlined by `@dimforge/rapier3d-compat` (no separate `.wasm` asset),
and the prod `manualChunks` keeps rapier in the `three` chunk so its module graph stays
intact — verified: the e2e playable gate passes against the production preview build.

## Android — Capacitor

- **Config:** `capacitor.config.ts` (`appId: com.jbcom.blobolines`, `webDir: dist`).
- **Local:** `pnpm android:debug` (`build:native` → `cap sync` → `gradlew assembleDebug`).
- **CI:** the `Android debug APK` job in `ci.yml` builds the debug APK on every PR and
  uploads it as an artifact (setup-java 21 + setup-android + Gradle).
- **Release:** `.github/workflows/release.yml` (release-please) attaches a debug APK to
  each GitHub release. A signed release APK needs signing secrets (not configured yet).
- **Plugins:** haptics, screen-orientation, keep-awake, preferences (all web-safe).

## Releases

`release-please` (`release-please-config.json`, `node` type) opens/maintains a release PR
from Conventional Commits; merging it tags a version and triggers `release.yml`.

## Local dev

```sh
pnpm install
pnpm dev          # http://localhost:5173 (use /?dev for the dev harness)
pnpm build        # local prod build
pnpm preview      # serve the prod build
```
