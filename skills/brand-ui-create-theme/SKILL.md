---
name: brand-ui-create-theme
description: Use when someone wants a new brand-ui theme built from a real brand — a company or product name, website links, brand guidelines, a logo, screenshots or a style sheet — e.g. "create a theme for <brand>", "make us a theme from these links", "theme it like <product>", "/create-theme". For retuning a theme family that already exists, use brand-ui-update-theme; for a single token tweak, brand-ui-theme.
user-invocable: true
argument-hint: "<theme name> [links, file paths, brief]"
allowed-tools:
  - WebSearch
  - WebFetch
  - Bash(node *theme-kit.mjs *)
  - Bash(curl -sL *)
  - Bash(pnpm theme:new *)
  - Bash(pnpm check *)
  - Bash(pnpm gen)
---

# brand-ui-create-theme

Turn a brand's own material into a brand-ui **theme family** (light and/or dark), with every
value traced to a source, a real logo, and a proposal the person approves before any file
is written.

**Research decides; the kit measures.** `scripts/theme-kit.mjs` (next to this file, zero
dependencies) does all colour conversion, contrast, token coverage, logo encoding and the
proposal page. Never convert a colour or estimate a contrast ratio in your head. Below,
`<kit>` is the absolute path of `scripts/theme-kit.mjs` inside this skill's directory;
`node <kit>` with no arguments prints its usage.

## The contract

1. **Nothing is written to the project before the person approves the proposal.** Research
   notes, downloads, drafts and the proposal page live in a scratch folder.
2. **Every proposed value has a source row and a confidence** (`measured`, `guideline`,
   `derived`, `inferred`). A value from memory is `inferred`.
3. **Every link and file the person gave is opened**, and the ledger says whether it worked.
4. **The drafts pass `theme-kit.mjs audit` before they are presented** — full token
   coverage, a `color-scheme`, and body text at WCAG AA (4.5:1) in every mode.

## Steps

### 1 · Intake

From the arguments: theme name → `slug` (kebab-case) and label; every URL; every file path;
any brief ("product UI, not marketing", "dark only"). If there is no brand name and no
resource at all, ask for one before researching.

Find out where you are — it changes step 6 only:

- **brand-ui source repository** — it has a `themes/` folder with family subfolders and a
  `theme:new` script in the root `package.json`. The family goes into `themes/<slug>/`.
- **An app using brand-ui** — `@elabs-ai/components-tokens` is a dependency. Ask where theme
  families live if there is no obvious `src/themes/`; default `src/themes/<slug>/`.

Pick a scratch folder (the session scratchpad if one exists, otherwise a temp directory)
and keep every intermediate file there.

### 2 · Research

Follow `reference/research.md`: the person's material first, then official brand material,
then the live product, then the marketing site. Build the source ledger as you go. Parallel
fetches or subagents are welcome; each returns ledger rows and extracted values, not pages.

### 3 · Logo and typeface

Logo: `reference/research.md` §4 — official SVG first, one colourway per mode, encode with
`node <kit> svg <file>`. Typeface: §5 — ship it only under an open licence.

### 4 · Map to tokens and draft

Write `proposal.json` and the drafts as described in `reference/proposal.md`:

```sh
node <kit> oklch "#0B5FFF"                       # every colour, before it goes in the proposal
node <kit> apply --base builtin:light --name <slug>-light --scheme light \
  --proposal proposal.json --header "<Label> — light. Downloadable theme family \"<slug>\"." \
  --out <scratch>/<slug>-light.css
node <kit> audit <scratch>/<slug>-light.css <scratch>/<slug>-dark.css
```

Fix every audit failure by adjusting the value, not by dropping the check; record each
adjustment as a deviation.

### 5 · Propose and stop

```sh
node <kit> proposal proposal.json --draft light=<scratch>/<slug>-light.css \
  --draft dark=<scratch>/<slug>-dark.css --out <scratch>/<slug>-proposal.html
```

Show the page and present it as `reference/proposal.md` "Presenting it" describes, then ask
**Approve and write it / Change something / Cancel**. On "Change something", revise,
re-audit, re-render, ask again.

### 6 · Write (only after Approve)

**brand-ui source repository:**

1. `pnpm theme:new <slug> --label "<Label>" --hue <brand hue>` (add `--only light|dark` for a
   single-mode family) — creates `theme.ts`, the README and the stylesheets.
2. Replace each generated `<slug>-<mode>.css` with the approved draft.
3. Fonts, if shipped: `fonts/<face>/*.woff2` + licence file + `<slug>-fonts.css`
   (`@font-face` only).
4. Replace the generated README body with the Qlik-style record: what the theme reproduces
   (element → source value → token), chart palette, typography, and the source ledger.
   Add the family's row to the table in `themes/README.md`.
5. `pnpm check --rule community-themes` and `pnpm gen`; read the counts they print. The
   kit's `audit` warnings (chart series, recessed chrome) are not covered by that rule —
   resolve them before writing.
6. Point the person at the Storybook Theme toolbar to try it on real components.

**An app using brand-ui:**

1. Copy the drafts to `<themes dir>/<slug>/<slug>-<mode>.css`.
2. Write `theme.ts`:

   ```ts
   import { defineTheme, type ThemeDefinition } from "@elabs-ai/components-tokens";

   export const <camelSlug>Themes: ThemeDefinition[] = [
     defineTheme({ value: "<slug>-light", label: "<Label> Light", dark: false, family: "<slug>", familyLabel: "<Label>" }),
     defineTheme({ value: "<slug>-dark", label: "<Label> Dark", dark: true, family: "<slug>" }),
   ];
   ```

3. A README with the source ledger and the logo trademark note.
4. Import the stylesheets after `@elabs-ai/components-tokens/styles.css`, register the
   family on `ThemeProvider` (spread `BUILT_IN_THEME_DEFINITIONS` to keep the defaults),
   and for a dark mode extend Tailwind's `dark:` variant with the new theme name:
   `@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *, [data-theme="<slug>-dark"], [data-theme="<slug>-dark"] *));`
5. `node <kit> audit <themes dir>/<slug>/*-light.css <themes dir>/<slug>/*-dark.css`.

## Report

What the family looks like and what it is based on; how to switch to it; open questions;
under Problems every source that failed, every `inferred` value count, a raster logo, an
unshipped proprietary font, and the trademark note.

## Common mistakes

| Mistake                                           | Instead                                                                |
| ------------------------------------------------- | ---------------------------------------------------------------------- |
| Palette from memory labelled as researched        | Fetch it, or mark it `inferred` and say the fetch failed               |
| Hand-written `oklch()` values                     | `node <kit> oklch` for every colour                                    |
| Writing theme files, then asking                  | Drafts in scratch → proposal → Approve → write                         |
| Scaffolding `themes/<slug>/` "just to look"       | The kit's `builtin:` base drafts without touching the project          |
| Brand colour that fails contrast silently swapped | Keep it as the mark, change its ink or darken it, record the deviation |
| One logo for both modes                           | A colourway per mode; dark wordmarks vanish on dark grounds            |
| Downloading a proprietary font into the theme     | Open-licence faces only; name the brand face first in the stack        |
