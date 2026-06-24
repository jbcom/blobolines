---
title: Design Language
updated: 2026-06-24
status: current
domain: creative
---

# Blobolines — Design Language

The visual identity is grounded in the hero cover art
(`public/assets/images/hero-cover.png`): squishy gel blobs with big expressive eyes,
soft lumpy cloud pads, a dreamy painterly cloud-and-ruins sky. Soft, juicy,
gooey — **not** neon-cyberpunk (the early prototype's look was deliberately dropped).

## Tokens

The single source of truth is `src/styles/tokens.css` (CSS vars) mirrored by
`src/styles/tokens.ts` (typed, for the 3D scene). Tailwind maps them via `@theme` in
`src/index.css`. Raw hex outside `tokens.ts` is forbidden (brand gate in
`.claude/gates.json`).

### Palette

- **Blobs (skins):** Mango `#ff7a3d` (starter), Berry `#ff4f7b`, Honey `#ffd95a`, Cocoa `#5a2418`,
  Nebula `#a06bff`, Aurora `#2fe6c4`
- **Cloud pads:** warm puff `#fff7d6`, honey `#ffe6a3`, blush `#ffb6a3`, gold `#ffd66b`, storm mauve `#9a6a8f`, wet white `#ffffff`
- **Sky/atmosphere:** cloud light `#eefaff`, cheerful blue `#8fd7ff`, daylight depth `#42a8f5`; honey sun `#ffd36b`; cream light `#f3efd6`
- **Goo:** mango splash `#ff7a3d`, warm fresnel rim `#ffe3a6`, wet sheen `#ffffff`, combo flame `#ffb238`
- **Eyes:** sclera `#f8fbff`, bezel `#14110f`, pupil `#0a0a0c`, glint `#ffffff`, warm tear `#ffd0a6`
- **UI surface:** deep berry-plum glass `#2a1024` / `#3a1630`; cream text; mango/berry/gold accents + danger

Some CSS variable names retain historical ids such as `--blob-blue` and `--tramp-blue`
for Tailwind class compatibility, but those tokens now carry warm foreground values. The
sky is intentionally bright blue daylight for foreground/background separation, warmed by
honey sun and peach fog. Do not introduce cool base colors for the starter blob or core
play objects, and do not return the UI shell to brown-on-brown chrome.

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
