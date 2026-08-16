# IBM Plex Mono (vendored)

The `blueprint` theme renders **mono everything** using IBM Plex Mono — a
drafting-grade monospace that stays legible at body sizes yet reads as a
technical/title-block face at label sizes.

- **Font:** IBM Plex Mono
- **License:** SIL Open Font License 1.1 (see [`OFL.txt`](./OFL.txt)) — free,
  redistributable, self-hostable. **No paid dependency, no runtime CDN call.**
- **Copyright:** © 2017 IBM Corp.
- **Source:** repackaged OFL `woff2` from `@fontsource/ibm-plex-mono@5`
  (which mirrors the canonical [github.com/IBM/plex](https://github.com/IBM/plex)
  release). The bytes are vendored here, not added as a dependency.
- **Subset:** Latin, `normal` style, weights **400 / 500 / 700** only (keeps the
  payload ~44 KB total). Italics and the other weights are intentionally omitted.

## Wiring

`@font-face` declarations live in [`../../themes.css`](../../themes.css) and load
these files with paths relative to that stylesheet, so a single
`@import "@brand/tokens/styles.css"` delivers the font with no extra config. The
`@brand/tokens` `build` script copies `src/fonts/` → `dist/fonts/` so the
relative `url()`s resolve from both `src/` (dev) and `dist/` (published).

Only a PAUSED theme switches to this face today (via its own `--font-sans` /
`--font-mono` overrides); every shipped theme keeps its system stack. The face is
kept because it is the mono seam any theme can reach for.
