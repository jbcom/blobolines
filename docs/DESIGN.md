---
title: Design Language
updated: 2026-06-16
status: current
domain: creative
---

# Blobolines — Design Language

The visual identity is grounded in the hero cover art
(`public/assets/images/hero-cover.png`): squishy gel blobs with big expressive eyes,
round springy colored trampolines, a dreamy painterly cloud-and-ruins sky. Soft, juicy,
gooey — **not** neon-cyberpunk (the PoC's look was deliberately dropped).

## Tokens

The single source of truth is `src/styles/tokens.css` (CSS vars) mirrored by
`src/styles/tokens.ts` (typed, for the 3D scene). Tailwind maps them via `@theme` in
`src/index.css`. Raw hex outside `tokens.ts` is forbidden (brand gate in
`.claude/gates.json`).

### Palette

- **Blobs (skins):** ink `#14110f`, blue `#2e8bf0`, slime `#7ed957`, ghost `#f4f6fb`
- **Trampolines:** blue `#2f7fd1`, gold `#f2c14e`, orange `#f08a3c`, green `#6cc04a`
- **Sky/atmosphere:** top `#cfe0e8`, mid `#8fb3c4`, deep `#4f7488`; cream light `#f3efd6`
- **Goo:** splash `#2e8bf0`, fresnel rim `#bfe3ff`, wet sheen `#ffffff`
- **Eyes:** sclera `#f8fbff`, bezel `#14110f`, pupil `#0a0a0c`, glint `#ffffff`, tear `#bfe3ff`
- **UI surface:** dark glassy blue-teal; cream text; warm/blue/slime accents + danger

### Type

Unique self-hosted Google Fonts (woff2 in `public/assets/fonts`, bundled offline for
Android):

- **Display — Fredoka Variable**: rounded, chunky, bouncy. Matches the gooey dripping
  logo. Used for the title, HUD numbers, buttons (`font-display`).
- **UI — Nunito Variable**: warm rounded sans for body/labels (`font-ui`).

### Motion

Bouncy/springy easing tokens (`--ease-bounce`, `--ease-out-soft`, `--ease-squish`).
DOM UI animates with Motion; in-scene game-feel via springs (`src/core/math/spring`).

## Principles

1. **Juice over realism.** Squash, stretch, splat, jiggle, expressive eyes. Game-feel
   first.
2. **The climb is always framed.** The altimeter and camera keep "how high" legible.
3. **Soft and friendly.** Rounded shapes, warm light, big eyes — approachable, not edgy.
4. **Mobile-first.** Touch is primary; safe-area aware; readable at phone size.

See `docs/GAME-DESIGN.md` for mechanics and `docs/ARCHITECTURE.md` for the token wiring.
