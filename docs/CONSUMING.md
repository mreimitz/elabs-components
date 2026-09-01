# Consuming brand-ui from another project

How to install and use the `@elabs-ai/components-*` packages — and
make your coding agent brand-ui-aware — in a project **outside** this monorepo.

This is the guide shipped as every package's README and attached to each
release. You should never need anything else to get started.

> **Starting a brand-new app?** `brand-ui scaffold <app-spec.md> --write <dir>`
> (the `brand-ui-new-app` skill's engine) writes a **runnable** app — `index.html`,
> `vite.config.ts` with the Tailwind plugin, `tsconfig.json`, the token stylesheet
> and the `@source` lines already correct — _and_ prints this whole recipe tailored
> to the packages it actually installed: `.npmrc`, `pnpm add`, the engine peers at
> the ranges those packages declare, and the CSS `@import`/`@source` lines.
> `standalone` auto-detects (#52) — leave it unset and the scaffolder gives you
> this handoff by default, since it can tell it isn't running inside the
> brand-ui monorepo; set `"standalone": true` explicitly only to force it (e.g.
> testing the registry handoff from inside a checkout). It needs **only the
> CLI** (`pnpm add -D
@elabs-ai/components-cli`, §1) — the archetype templates and the
> component manifest ship inside it, so no brand-ui checkout is required. The
> sections below are the manual version, and the reference the generated block is
> built from.

## Distribution model — public packages on npmjs.org

The packages are published to the **public npm registry** under the `@elabs-ai`
scope, from the
[`mreimitz/elabs-components`](https://github.com/mreimitz/elabs-components)
repo. They behave like any other npm dependency: real semver ranges, lockfile
integrity, `pnpm update` — and, because they are public, **no registry
configuration and no token**.

> **Coming from the private GitHub Packages flow?** Delete the `@elabs-ai:registry=`
> line and the `//npm.pkg.github.com/:_authToken=` line from your `.npmrc`, and
> drop the `read:packages` PAT from your CI secrets. Both are now inert: npmjs.org
> is npm's default registry and the packages resolve anonymously. Package names
> and versions are unchanged, so nothing else in your dependency block moves.

## 1. Authenticate — nothing to do

Public packages install anonymously. There is no `.npmrc` to write, no token to
provision, and another repo's CI needs no grant to read them.

The one case that still needs configuration is a project pointed at a **private
mirror or proxy** (an internal Verdaccio, Artifactory, an offline cache). Map the
scope explicitly there, never process-wide:

```ini
@elabs-ai:registry=https://your-mirror.example.com
```

A bare `registry=` line would send every _transitive_ dependency to that host
too, which is the defect that broke installs under the old private flow.

## 2. Install the packages

```bash
pnpm add @elabs-ai/components-tokens @elabs-ai/components-ui
```

```jsonc
{
  "dependencies": {
    "@elabs-ai/components-tokens": "^4.0.0",
    "@elabs-ai/components-ui": "^4.0.0",
    "@elabs-ai/components-data": "^4.0.0",
  },
}
```

That is the whole dependency block — no `file:` paths, no overrides, no vendored
tarballs. Cross-package peers (`…-ui` → `…-tokens`) resolve from the registry.

`.tgz` tarballs are still attached to each GitHub Release as a fallback for
environments that cannot reach the registry. Installing those needs `file:`
dependencies plus a mirrored `pnpm.overrides` entry per package — the old flow,
kept working but no longer documented here because the registry supersedes it.

## 3. Peer dependencies

Every package peers on **`react` / `react-dom` `^18.2 || ^19`**. Most dependency
trees (Radix, visx/d3, shiki) install transitively and need nothing from you.

Three engines are **peers you must install yourself** — each owns a global or a
React context, so two resolved copies break at runtime rather than merely
bloating the bundle:

```bash
pnpm add monaco-editor      # only if you use …-editor
pnpm add maplibre-gl        # only if you use …-maps
pnpm add @xyflow/react      # only if you use …-flow or the …-ai canvas
```

Per-package peers worth knowing:

| Package                       | Extra peer you must provide                                                                                                                                                                                                          |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `@elabs-ai/components-tokens` | `tailwindcss` `^4` — you already install it for the Vite/PostCSS plugin below; it must be the SAME instance that processes the token stylesheet                                                                                      |
| `@elabs-ai/components-ai`     | `@xyflow/react` if you render the agent canvas (required); **five more peers are optional** — `ai`, `mermaid`, `@rive-app/react-webgl2`, `@xterm/xterm` + `@xterm/addon-fit`, `media-chrome` — install only what you render (see §6) |
| `@elabs-ai/components-flow`   | `@xyflow/react` (a context singleton — install it yourself); also import `@xyflow/react/dist/style.css` once                                                                                                                         |
| `@elabs-ai/components-editor` | `monaco-editor` (owns `globalThis.MonacoEnvironment`); import `@elabs-ai/components-editor/monaco-environment` once (Vite)                                                                                                           |
| `@elabs-ai/components-viewer` | **optional** parser peers, one per format — install only what you need (see §6). Install none and every format still builds; unsupported ones show a panel naming the missing package                                                |
| everything else               | `@elabs-ai/components-tokens` + `@elabs-ai/components-ui` (already in your deps)                                                                                                                                                     |

All packages are **ESM-only** (`"type": "module"`) — use a bundler that handles
ESM (Vite, Next, webpack 5, esbuild).

## 4. Wire up Tailwind v4 + tokens

The components are styled with Tailwind v4 utility classes backed by semantic
tokens (`bg-background`, `text-foreground`, `border-border`). For those classes
to produce styles in your app, do **two** things in your app's CSS entry:

```css
/* The ENGINE: Tailwind itself + the @theme inline token→utility map + the dials
   + a neutral light `:root` base + the self-hosted fonts. No separate
   `@import "tailwindcss"` is needed, and Tailwind v4 needs no
   tailwind.config.js.

   It also pulls in `tw-animate-css` (the animation utilities the motion system
   retimes). That ships INSIDE @elabs-ai/components-tokens as a real dependency — you do not
   install it yourself. `tailwindcss` is the one peer you provide (see §3). */
@import "@elabs-ai/components-tokens/styles.css";

/* The two REFERENCE themes are OPT-IN, one import each (ADR 0029). Take the ones
   you want; take neither if you author your own — see §5.1. */
@import "@elabs-ai/components-tokens/themes/light.css";
@import "@elabs-ai/components-tokens/themes/dark.css";

/* Tailwind ignores node_modules unless you @source it — list every @elabs-ai/components-*
   package you render so its utility classes get generated: */
@source "../node_modules/@elabs-ai/components-ui/dist";
@source "../node_modules/@elabs-ai/components-data/dist";
/* …one @source per @elabs-ai/components-* package you use */
```

> Skip the `@source` lines and the components render **unstyled** — that's the
> single most common consumer mistake.

### Vite

Add the Tailwind v4 plugin; it processes the CSS above:

```ts
// vite.config.ts
import tailwindcss from "@tailwindcss/vite";
export default defineConfig({ plugins: [react(), tailwindcss()] });
```

### Next.js (App Router)

Use the PostCSS plugin and import the CSS in `app/globals.css`:

```js
// postcss.config.mjs
export default { plugins: { "@tailwindcss/postcss": {} } };
```

The published bundles carry their own `"use client"` directive, so you can
import them directly from a server component without wrapping anything — they
become client components at the boundary, as expected.

Three entry points are deliberately **server-safe** and carry no directive, so
they stay callable from a server component or a plain Node script:
`…-ui/lib/cn`, `…-editor/markdown/parse`, and `…-editor/markdown/frontmatter`.
`…-icons` and `…-marketing` are server-renderable in full.

## 5. App root — ThemeProvider

Import the CSS once and wrap the tree. The two REFERENCE themes are `light`
(the default) and `dark`:

```tsx
import "@elabs-ai/components-tokens/styles.css";
import { ThemeProvider } from "@elabs-ai/components-tokens";
import { Button, Card, CardHeader, CardTitle } from "@elabs-ai/components-ui";
import { DataTable } from "@elabs-ai/components-data";

export default function App() {
  return (
    <ThemeProvider defaultTheme="light">
      <Card>
        <CardHeader>
          <CardTitle>Hello</CardTitle>
        </CardHeader>
        <Button>Click me</Button>
      </Card>
    </ThemeProvider>
  );
}
```

### 5.1 Your own themes

Theming is **open** (ADR 0029): a theme is any `[data-theme="…"]` block that
covers the token contract, registered on the provider. Nothing in this package
has to know its name.

Three steps.

**1. Write the CSS.** One block per theme, declaring every token in
`THEME_TOKEN_NAMES` plus a `color-scheme`. Copy
`node_modules/@elabs-ai/components-tokens/dist/themes/light.css` as the starting
point — that is what it is there for.

```css
/* src/themes/midnight.css */
[data-theme="midnight"] {
  color-scheme: dark; /* not optional — see below */
  --background: oklch(0.18 0.02 260);
  --foreground: oklch(0.96 0.01 260);
  /* …every token in THEME_TOKEN_NAMES */
}
```

`color-scheme` is load-bearing, not decoration: it is how the library answers
"is the active theme dark" for a theme it has never heard of, so a wrong or
missing value gives you a light code editor, basemap and toast inside a dark
theme. Native scrollbars and form controls follow it too.

**2. Register it.**

```tsx
import { defineTheme, ThemeProvider, BUILT_IN_THEME_DEFINITIONS } from "@elabs-ai/components-tokens";
import "./themes/midnight.css";

const midnight = defineTheme({ value: "midnight", label: "Midnight", dark: true });

// `themes` REPLACES the default registry. Spread the built-ins to keep them;
// omit them to ship only your own.
<ThemeProvider themes={[...BUILT_IN_THEME_DEFINITIONS, midnight]} defaultTheme="midnight">
```

`ThemeSwitcher` renders the provider's registry, so it picks up your theme with
no `themes` prop of its own.

**3. Assert the coverage in your own test.** The contract ships as data, so this
needs no CSS parsing beyond your own file:

```ts
import { THEME_TOKEN_NAMES } from "@elabs-ai/components-tokens";

const css = readFileSync("src/themes/midnight.css", "utf8");
const missing = THEME_TOKEN_NAMES.filter((t) => !new RegExp(`${t}\\s*:`).test(css));
expect(missing).toEqual([]);
```

A theme missing a token silently falls back to the neutral `:root` base, which
usually looks _almost_ right — which is why this is worth one test.

### 5.2 Runtime token overrides (patch a color without a theme)

Sometimes you don't want a whole new theme — you want to patch 1-2 tokens at
runtime (a multi-tenant/white-label app whose brand color comes from a tenant
lookup, or the `--ring` fix ADR 0027 recommends). `ThemeProvider` takes a
`tokenOverrides` prop for exactly this (issue #17, ADR
[0031](./ADR/0031-runtime-token-overrides.md)):

```tsx
<ThemeProvider tokenOverrides={{ "--primary": tenant.brandColor }}>
```

- **Partial, not a replacement.** Only the keys you pass are forced (as inline
  CSS custom properties on the root element); every other token keeps coming
  from whichever theme (`light`, `dark`, or your own) is active. Unlike a
  hand-authored `[data-theme]` block, you do NOT need to cover all of
  `THEME_TOKEN_NAMES` — that full-coverage rule is for a REPLACEMENT theme,
  not a patch on top of one.
- **Keys are validated.** A key that isn't in `THEME_TOKEN_NAMES` is rejected
  (not applied) with a console warning in development — it would otherwise be
  a silent no-op (a custom property nothing reads).
- **Values are validated too.** Every token except `--shadow-strength` (a bare
  numeric multiplier, not a color) is checked with `CSS.supports("color",
value)`; an invalid value (`"not-a-color"`, a typo'd `oklch()`) is rejected
  with a console warning instead of being written and silently resolving to
  `unset` wherever the token is used. A `var(--other-token)` reference passes
  this check, so aliasing one override to another still works. Where
  `CSS.supports` doesn't exist (older runtimes), the value is applied
  unchecked — this package can't validate what the platform can't answer.
- **Reactive.** Change the prop (e.g. when the tenant lookup resolves) and it
  re-applies; remove a key and its inline property is cleared, so the active
  theme's own value takes over again. Overrides survive a `setTheme` call —
  they hold across a light/dark toggle, which is the point.
- **Cleared when the target changes, and on unmount.** If `attributeTarget`
  resolves from `null` to a real element across renders (the callback-ref
  pattern used to scope a provider to one subtree — see §5.1), the override is
  removed from the first element before being applied to the new one, so it
  never lingers on the wrong node. Unmounting the provider removes every
  property it applied, restoring the target to its plain theme value.
- **This flashes on first paint under SSR.** Like the rest of `ThemeProvider`,
  overrides apply in a client-side effect, so server-rendered HTML and the
  hydration frame show the UN-overridden theme; the tenant color appears one
  paint later. If that's not acceptable, emit the same custom properties in
  your server-rendered `<head>` (a small inline `<style>` keyed off the same
  tenant lookup) — `ThemeProvider` does not do this for you.
- **No new CSP relaxation needed.** It sets properties with
  `CSSStyleDeclaration.setProperty()`, which a CSP `style-src` directive does
  not restrict (that directive governs parsing a `style` attribute string or a
  `<style>` element, not a script's direct CSSOM manipulation — see ADR 0031).

### 5.3 Deriving a palette from one brand colour (`deriveTheme`)

`tokenOverrides` (above) still expects you to already know the value for every
token you want to patch. A tenant/white-label picker usually has only ONE
colour — the brand's own — with no idea what a coherent, AA-safe
`--primary-foreground`/`--accent`/`--accent-foreground`/`--ring` would be.
`deriveTheme` (issue #39) computes those from the seed, ready to hand straight
to `tokenOverrides`:

```tsx
import { deriveTheme } from "@elabs-ai/components-tokens";

const overrides = deriveTheme({ primary: tenant.brandColor }); // e.g. "oklch(0.55 0.18 250)"
// => {
//   "--primary": "oklch(0.55 0.18 250)",
//   "--primary-foreground": "oklch(1 0 0)",
//   "--accent": "oklch(0.811 0.05 250)",
//   "--accent-foreground": "oklch(0 0 0)",
//   "--ring": "oklch(0.55 0.18 250)",
// }

<ThemeProvider tokenOverrides={overrides}>
```

- **A patch, not a theme — by design.** `deriveTheme` returns exactly the five
  tokens above, not full `THEME_TOKEN_NAMES` coverage. That mirrors
  `tokenOverrides` itself (ADR 0031 explicitly rejected requiring full coverage
  for a partial patch as "defeats the point"): every key it returns is a real,
  valid `ThemeTokenName` — checked by `derive-theme.test.ts` — but it isn't
  trying to replace a theme, only to patch the handful of tokens that actually
  depend on a brand colour.
- **AA-safety is proven, not assumed.** Every `-foreground` value is chosen
  from true black/true white, whichever contrasts better against its plate —
  provably ≥4.5:1 (WCAG AA text) for ANY fill colour (see the module doc
  comment in `packages/tokens/src/derive-theme.ts` for the proof, and the
  "proof-check" test that verifies it numerically). `--ring` is searched at
  `--primary`'s own hue for the lightness closest to `--primary`'s that clears
  ≥3:1 (WCAG 1.4.11) against `background`. If an AA-safe value genuinely
  cannot be found, `deriveTheme` **throws** rather than returning a
  non-compliant token — it never fails silently.
- **Pass `background`** (e.g. read `--background` off the active theme via
  `getComputedStyle`) when deriving for `dark` or a custom theme; omitted, it
  assumes the `light` reference theme's own background.
- **Input is `oklch(...)` only** (the same literal format every token in
  `themes.css` uses) — convert a hex/`rgb()` brand colour before calling it.
- **Must be fully opaque.** Both `primary` and `background` are rejected
  (`deriveTheme` throws) if they carry an alpha other than 1 —
  `oklch(0.55 0.18 250 / 0.9)` throws even though `oklch()` itself allows
  alpha. Every token in `themes.css` is a solid color; alpha is applied via
  Tailwind's `/` modifier at use time, never baked into the token. If your
  brand colour is translucent, composite it against its real backdrop
  yourself first and pass the resulting opaque `oklch()` (fix round 2, issue
  #39, finding F).
- **Compose it with `tokenOverrides`, don't hand-roll the object it returns.**
  `deriveTheme`'s whole point is that you stop hand-deriving these values
  yourself; see `Foundations/Theming` → `DeriveTheme` in Storybook for a live
  "tenant picks a brand colour" demo.

## 6. Per-package extras

- **`@elabs-ai/components-flow`** — `import "@xyflow/react/dist/style.css"` once.
- **`@elabs-ai/components-editor`** — `import "@elabs-ai/components-editor/monaco-environment"`
  once at the app entry to enable Monaco's language workers (completions,
  diagnostics). Vite-only; other bundlers wire `self.MonacoEnvironment.getWorker`
  themselves. Without it the editor still renders and highlights.
  Subpaths: `…/markdown` (the authoring + preview suite), `…/markdown/parse` and
  `…/markdown/frontmatter` (pure, Monaco-free, server-safe).
  You do **not** import the editor's CSS — the bundles import their own.
- **`@elabs-ai/components-viewer`** — formats are **opt-in**. Every parser
  engine is an OPTIONAL peer dependency, so the package installs and builds with
  none of them; a format whose parser is absent renders an error panel naming the
  package to install rather than failing the build.

  ```bash
  pnpm add papaparse          # CSV / TSV
  pnpm add pdfjs-dist         # PDF
  pnpm add mammoth            # Word (.docx)
  pnpm add xlsx               # Excel (.xlsx / .xls / .ods) — read the advisory below
  pnpm add jszip              # PowerPoint (.pptx)
  pnpm add streamdown         # Markdown (.md) rendered as a document
  pnpm add shiki              # Source code, highlighted
  ```

  Images, plain text, JSON, video and audio need nothing extra — they use the
  browser's own decoders. Adding a format your app needs but the package does not
  ship is a `registry.register(manifest, () => import(…))` call, not a fork.

  **Markdown and code cost nothing extra if you already render chat.** Both peers
  are ones `@elabs-ai/components-ai` already depends on, so an app with
  a chat surface has them installed. Skip them and a `.md` or `.ts` file shows the
  panel naming the package — it does not silently fall back to plain text, because
  a highlighted file quietly arriving unhighlighted is a worse answer than being
  told why. To take that trade the other way, register your own adapter over the
  extensions you care about with a higher `priority`.

  **PDF assets.** `pdfjs-dist` runs its parser on a Web Worker and loads two
  optional asset sets from URLs it is given: CMaps (for CJK and other
  non-Latin encodings) and standard font data (for fonts a file does not embed).
  The defaults resolve against your bundler, which is right for Vite and Next.
  Point them elsewhere — a CDN, a subpath your app serves — with one call at app
  start:

  ```ts
  import { configurePdfEngine } from "@elabs-ai/components-viewer";

  configurePdfEngine({
    workerSrc: "/pdfjs/pdf.worker.min.mjs",
    cMapUrl: "/pdfjs/cmaps/",
    standardFontDataUrl: "/pdfjs/standard_fonts/",
  });
  ```

  A PDF that embeds all its fonts and uses Latin text renders without either.

  **CSP.** Files handed in as a `File`/`Blob` are played and drawn from an object
  URL, so an enforced policy needs `img-src blob:` and `media-src blob:` — see
  `docs/CSP-AND-NETWORK.md` §2.7.

  **Office previews show STRUCTURE, not page layout.** A Word document renders as
  real headings, lists, tables and links in your theme's typography; a deck
  renders as a per-slide outline with its speaker notes. Neither reproduces page
  breaks, columns, positioned shapes or slide design — for that, the toolbar's
  download hands the reader the original file.

  **`xlsx` (SheetJS) is a deliberate exception you should read before adopting.**
  The spreadsheet adapter's optional peer is `xlsx@0.18.5` from the npm registry.
  That published version carries two known advisories —
  prototype pollution (GHSA-4r6h-8v6p-xvw6) and a ReDoS (GHSA-5pgg-2g8v-p4x9) —
  fixed only in SheetJS's self-hosted `cdn.sheetjs.com` builds, which are not on
  npm. Treat any spreadsheet you open with it as untrusted input, or point the
  peer at the vendor CDN build yourself. Every other viewer format is unaffected;
  skip the peer and you skip the exposure.

- **`@elabs-ai/components-maps`** — no CSS import needed; `MapCanvas`
  pulls in MapLibre's stylesheet and the brand overrides itself.
- **`@elabs-ai/components-ui`** — the class-merge helper is at
  `@elabs-ai/components-ui/lib/cn` (server-safe). `LocaleProvider` supports
  cardinal-plural messages out of the box (`Intl.PluralRules`, no dependency)
  and a pluggable `translate` prop so an app already running next-intl /
  react-intl / i18next can hand it that runtime's own translator instead of a
  second message catalogue — see [`docs/I18N.md`](I18N.md).

  **`FieldRow` has no react-hook-form import**, so it works with Formik, Final
  Form, TanStack Form, or a bare `useState`, unlike `Form`/`FormField` (see
  `Forms/Form` in Storybook), which are RHF-bound. It renders
  label/description/error/`aria-describedby`
  from plain props — hand it whatever your runtime calls its field error. A
  worked Formik example:

  ```tsx
  import { useField } from "formik";
  import { FieldRow, Input } from "@elabs-ai/components-ui";

  function EmailField() {
    const [field, meta] = useField("email");
    return (
      <FieldRow label="Email" error={meta.touched ? meta.error : undefined}>
        <Input {...field} />
      </FieldRow>
    );
  }
  ```

  The same shape works with a bare `useState` (no form runtime at all) — see
  the "Driven by external state" story on `Forms/FieldRow` in Storybook for a
  runnable version. Reach for `Form`/`FormField` (see `Forms/Form` in
  Storybook) once the field already lives inside a `react-hook-form`
  `<FormProvider>`.

- **`@elabs-ai/components-ai`** — `MarkdownPreview` math needs
  `import "katex/dist/katex.min.css"` once, only if you enable it. Five more
  peers are **optional** (issue #33, `docs/ADR/0032-optional-peer-dependency-policy.md`) —
  each is a dependency of ONE feature, reached only through a lazy `import()`
  (ADR 0019), so the package installs and builds with none of them; reaching a
  feature whose peer is absent renders an actionable message naming the
  package to install, never a blank component or an unhandled rejection.

  ```bash
  pnpm add mermaid                    # Mermaid diagrams in streamed markdown
  pnpm add @rive-app/react-webgl2     # Persona
  pnpm add @xterm/xterm @xterm/addon-fit  # InteractiveTerminal
  pnpm add media-chrome               # AudioPlayer
  pnpm add ai                         # types only, no runtime cost
  ```

  `@xyflow/react` (the agent-canvas set) stays a **required** peer, not
  optional — install it whenever you import from this package.

  **Known limitation:** `mermaid` may still resolve on disk even when you skip
  it — `@streamdown/mermaid` (a dependency of `@elabs-ai/components-ai`, not of
  your app) currently declares `mermaid` as its own plain, non-optional
  dependency, so a hoisting package manager can still install it transitively.
  The optional-peer declaration still means you never have to declare it
  yourself, and a genuinely absent engine still fails actionably rather than
  crashing.

## 7. Make your coding agent brand-ui-aware

Installing the packages does not tell an AI coding agent what exists. Without
this step an agent will invent props, re-create components that already ship,
and reach for raw hex instead of tokens. There are three layers; **install the
CLI at minimum.**

### 7a. The CLI — ground truth about the API (install this first)

```bash
pnpm add -D @elabs-ai/components-cli
```

The binary is `brand-ui`. It ships the component manifest **inside the package**,
so it answers with no monorepo, no network and no dev server:

```bash
pnpm exec brand-ui info              # your packages, themes, tokens, registry
pnpm exec brand-ui search table      # find a component / hook / registry item
pnpm exec brand-ui docs Button       # the real props, from source
pnpm exec brand-ui audit src/        # static token/style + anti-slop lint
```

**Taste profile (optional).** `info` also reports the **active taste profile** —
`register × density × motion × expressiveness` (ADR
[0020](./ADR/0020-taste-profile.md)) — and `audit` judges its severities against
it. The shipped default is restrained (`product / comfortable / system / 0`); to
record a different intent for your project, drop a `brand-ui.config.json` at its
root:

```json
{ "taste": { "register": "brand", "density": "comfortable", "expressiveness": 4 } }
```

`expressiveness` IS the `--decoration` dial (0–10) — there is no separate CSS
variable. An unknown key or an out-of-vocabulary value is ignored and reported,
never an error. The config **nearest the audited path wins** (its own ancestors,
then your cwd, then the repo root), so auditing one app inside a workspace judges
it against its own profile. Override for one run with
`brand-ui audit src/ --register=brand`.

Set `taste.motion` to `system` (the default) or `reduced` only — `system` already
animates fully whenever the OS is neutral. The third `MotionPreference` value,
`full`, overrides a visitor's OS reduce-motion request, so it belongs to a control
**they** operate (`useMotionPreference()`), never to an app-wide default.

**Make the bar a gate:** `brand-ui audit src/ --strict` exits **1** on any blocking
style finding or any content slop ("John Doe", "99.99%", "Acme") and 0 when clean —
wire it as an npm script (`"audit:brand-ui": "brand-ui audit src --strict"`) so
"looks generated" fails the build instead of being a paragraph in a review.

`info`, `search`, `scan`, `map`, `audit` and `docs` take `--json` for agent
consumption. `docs`'s default is its markdown card — written to be read by a
model as-is, and returning far more than a prop list:

```
# Button  (@elabs-ai/components-ui)
purpose: Primary action trigger — the canonical way to invoke an action.  [action]
  used inside: Form, Dialog, Card, AlertDialog, Toolbar
  pairs with: Spinner
state → token:
  hover: bg-primary/90 · focus: ring-2 ring-ring · disabled: opacity-50
anti-patterns (avoid):
  ✗ Two primary Buttons in the same action group — demote one to secondary.
  ✗ Button used for navigation — use asChild + <a>, or variant="link".
```

Pass `--json` for the same fields (`purpose`, `relationships`, `stateTokens`,
`antiPatterns`, `props`, `variants`) as structured data instead of markdown.

> Tell your agent: **never guess a prop — run `brand-ui docs <Name>` first.**

### 7b. The MCP server — the same ground truth, as live tools

The CLI doubles as a stdio MCP server, so an agent queries it as typed tools
rather than shelling out. Add to your project's `.mcp.json`:

```jsonc
{
  "mcpServers": {
    "brand-ui": {
      "type": "stdio",
      "command": "pnpm",
      "args": ["exec", "brand-ui", "mcp"],
    },
  },
}
```

Exposes `info`, `search`, `docs`, `tokens` and `audit`. It reads the bundled
manifest, so it works offline and with no Storybook running.

### 7c. The skills — judgment, not just API

The CLI says what exists; the skills say _when to use what, and how to compose
it well_. Two ways in:

**Claude Code / Cowork — the plugin (live, tracks the repo):**

```
/plugin marketplace add <path-to-this-repo>
/plugin install brand-ui
```

Then `/brand-ui-start` is the front door — it routes you to build-a-new-app,
improve-an-existing-app, or just-help-me-use-it.

**Version-pinned instead:** download `brand-ui-agent-kit-X.Y.Z.zip` from the
release, unzip, and
copy `skills/` into `.claude/skills/`, keeping `playbooks/`,
`brand-ui.manifest.json` and `llms.txt` beside it. Pin this if you need the agent
layer to match an exact component set.

The consumer-facing skills:

| Skill                     | Use it for                                                           |
| ------------------------- | -------------------------------------------------------------------- |
| **`brand-ui`**            | Build/compose with the components — live context, real API, patterns |
| **`brand-ui-start`**      | The router when you don't know where to begin                        |
| **`brand-ui-new-app`**    | Scaffold a whole app from a plain-language description               |
| **`brand-ui-theme`**      | Re-brand to a customer palette; token-level work                     |
| **`brand-ui-audit`**      | Score an existing screen — tokens, a11y, cross-theme, design quality |
| **`brand-ui-migrate`**    | Bring an app that already exists onto brand-ui, phase by phase       |
| **`brand-ui-enterprise`** | Design judgment for admin consoles / dense data apps                 |

**Other harnesses** (Cursor, Copilot, Gemini, Continue): point the tool at
`llms.txt` and the per-package `llms/<pkg>.txt` from the kit — a compact,
agent-readable capability catalogue — or add the MCP server from §7b, which most
harnesses now support.

## 8. Migrate an existing project

The CLI does the **deterministic analysis**; your coding agent does the **edits**,
guided by the skills. Install both (§7a, §7c) before starting.

### The three commands

```bash
pnpm exec brand-ui scan . --json > brand-ui-scan.json     # what you have today
pnpm exec brand-ui map brand-ui-scan.json --json > map.json  # → brand-ui equivalents
pnpm exec brand-ui codemod map.json                        # a phased plan
```

Add `--out <dir>` to either of the first two and they also write the migration
documents you hand to a reviewer:

```bash
pnpm exec brand-ui scan . --out migration/                 # migration/repo-profile.md
pnpm exec brand-ui map brand-ui-scan.json --out migration/ # migration/analysis.md + plan.md
```

`--out` is the **only** write in this path, and it only ever creates those three
files. Without it, `scan` and `map` write nothing at all.

`map` classifies every component it finds:

| Verdict     | Meaning                                                         | How it is decided                                                             |
| ----------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| **direct**  | A one-to-one brand-ui equivalent exists — a rename plus imports | The name matches a component in the manifest                                  |
| **props**   | Equivalent exists, prop names differ                            | A known third-party component with a recorded prop remap (MUI `Typography` …) |
| **compose** | No single equivalent; compose two or more primitives            | A known layout/wrapper component with no single counterpart (`Box`, `Stack`)  |
| **gap**     | Nothing matches — keep yours, or propose a new component        | Neither of the above matched                                                  |
| **drop**    | Not UI at all — routing, document head, language constructs     | A known framework construct (`Fragment`, `Head`, `Route`)                     |

Each mapping also carries a **risk** and **effort** rung derived from the verdict
and the blast radius (usages × distinct files), and the summary carries a
**coverage percentage**: the share of component _usages_ — not names — that a
direct match or a prop remap already covers.

**Be aware of the current limits, so you plan realistically:**

- `scan` is a **heuristic source scan, not an AST parse**. A `<Tag` inside a
  comment or a string counts, and a member tag (`<Card.Header>`) is attributed to
  its root. It is accurate enough to rank work by blast radius, which is what the
  plan needs — it is not a refactoring index.
- `map` recognises the **common** MUI / antd / Chakra components. Anything it has
  no entry for lands in `gap`, which means "look at this yourself", not "no
  equivalent exists" — search first (`brand-ui search`).
- `codemod` emits a **plan and a dry-run contract only — it edits no files.** The
  transform engine is not implemented.

So treat the output as a **worklist and a map, not an automated migration.** The
edits are the agent's job — which is the point of §7.

### The prompt

With the skills and CLI installed, paste this into your coding agent at the root
of the project you want to migrate:

```text
Migrate this project to the brand-ui design system
(@elabs-ai/components-*). Work in phases and stop for my approval
between each one.

PHASE 1 — Understand, change nothing.
- Run: pnpm exec brand-ui scan . --json > brand-ui-scan.json
- Run: pnpm exec brand-ui map brand-ui-scan.json --json > brand-ui-map.json
- Run: pnpm exec brand-ui scan . --out migration/
- Run: pnpm exec brand-ui map brand-ui-scan.json --out migration/
- Run: pnpm exec brand-ui info
- Read both JSON files and the three migration/*.md documents. Report: which of
  my components map DIRECTly, which need prop changes, which must be COMPOSED,
  and which are GAPs with no equivalent — and what coverage percentage the map
  reports.
- Separately, list my current styling approach and every hardcoded color, spacing
  and font value you find. Run `pnpm exec brand-ui audit src/ --json` and include
  its findings.
- Do NOT edit anything yet. End with a migration plan ordered by
  (risk x blast radius), lowest first, and tell me what you are unsure about.

PHASE 2 — Foundation.
- Install the packages I actually need (see the map), plus the peers:
  monaco-editor / maplibre-gl / @xyflow/react only if the matching package is used.
- Wire Tailwind v4: @import the tokens stylesheet and add ONE @source line per
  installed package pointing at its dist. Skipping a @source silently renders
  components unstyled — verify each one.
- Wrap the app root in ThemeProvider.
- Verify the app still builds and renders before going further.

PHASE 3 — Migrate, leaf-first.
- Start with the DIRECT matches in the least-risky files.
- Before using ANY component, run `pnpm exec brand-ui docs <Name>` and use its
  real props. Never guess a prop or invent one. If docs shows anti-patterns for
  that component, follow them.
- Replace hardcoded colors/spacing with semantic tokens (bg-background,
  text-foreground, border-border, …). Never a raw hex.
- For COMPOSE cases, show me the composition before you write it.
- For GAPs, do not force a bad fit — keep my component and tell me.
- Keep each phase to a reviewable diff. Run my build/tests after each batch.

PHASE 4 — Verify.
- Run `pnpm exec brand-ui audit src/` and fix what it reports.
- Check every migrated screen in both themes: light, dark. A component that only works in one theme is not done.
- Report honestly what you migrated, what you skipped and why, and anything you
  changed that I should look at closely.

Rules throughout: semantic tokens only, never raw hex. Prefer composing the
existing primitives over writing new components. If you are unsure whether
something exists, search first (`brand-ui search`), and ask rather than invent.
```

Adjust the phases to your codebase — a small app can collapse 2 and 3. If you use
Claude Code with the plugin installed, `/brand-ui-start` and choose
"improve/migrate an existing app" walks the same route interactively.

## 9. CSP and locked-down networks

A few components reach third-party origins at runtime — provider logos
(`models.dev`), `Persona`'s Rive artwork, and `MapCanvas`'s default basemap — and
under enforced **Trusted Types** two transitive markdown dependencies blank
content unless you alias them to their DOM-free builds. All of it fails
_silently_: a blank logo, an empty animation box, a message that renders as an
empty string.

Every origin, the exact CSP directives, the copy-pasteable bundler snippet and an
offline/air-gapped checklist are in
**[`CSP-AND-NETWORK.md`](./CSP-AND-NETWORK.md)**. Read it before deploying into a
regulated or CSP-enforcing environment.

## 10. Browser support

The floor is **Chrome/Edge 119, Safari 16.4, Firefox 128** — set by the relative
color syntax the `--decoration` dial's inks use, not by the components. Below it
the color themes still render; the reprographic texture (graph paper, hatch,
ground fade) switches off via an `@supports` fallback rather than breaking. The
full picture, including the touch-device gating, is in
**[`BROWSER-SUPPORT.md`](./BROWSER-SUPPORT.md)**.

## Troubleshooting

- **Components render unstyled** → you're missing the `@source` line for that
  package (§4), or `@elabs-ai/components-tokens/styles.css` isn't
  imported. This is the single most common mistake.
- **`404 Not Found` on install** → the version you asked for is not published, or
  your project resolves `@elabs-ai/*` somewhere other than npmjs.org. Confirm what
  the registry actually serves with `npm view @elabs-ai/components-ui versions`, then
  check for a leftover `@elabs-ai:registry=` line or a process-wide `registry=`
  override in your `.npmrc` (§1). Nothing here needs a token.
- **`require() of ES Module` / CJS error** → the packages are ESM-only; use an
  ESM-capable bundler and TypeScript `moduleResolution: "bundler"` (or `node16`).
- **`useReactFlow`/Monaco/MapLibre misbehaving** → you likely have two copies of
  the engine. They are peers for exactly this reason (§3); make sure you install
  one version and that nothing else pins a different one.
- **Hooks error in a Next.js server component** → the bundles carry their own
  `"use client"`, so this usually means a stale install; reinstall. The
  deliberately server-safe entries are `…-ui/lib/cn`,
  `…-editor/markdown/parse` and `…/frontmatter`.
- **Fonts missing** → they ship inside `@elabs-ai/components-tokens` with relative `@font-face`
  URLs; importing `@elabs-ai/components-tokens/styles.css` from the installed package is enough.

## Upgrading

> Every `X.Y.Z` in this guide is a placeholder — replace it with the version you
> are installing, not a literal copied verbatim.

Ordinary npm upgrades now:

```bash
pnpm update "@elabs-ai/components-*"
```

All packages are released in **lockstep** — every distributable package shares
one version — so upgrade them together. Mixing versions across `…-ui` and
`…-tokens` is unsupported.

Two things to re-sync after a bump:

1. **The CLI**, so `search`/`docs` describe the components you actually have —
   it bundles the manifest for the version it ships.
2. **The agent kit**, if you vendored the pinned zip rather than installing the
   live plugin (§7c). The plugin tracks the repo and needs nothing.

Read the CHANGELOG
before a major — the 2.0.0 release renamed every package.

**What you can expect from us:** deprecations land in a minor and are only removed
in the next major, every major ships numbered migration steps, and the current
major is the one that gets fixes. The policy — including how to escalate a
migration that hurts — is [`DEPRECATION.md`](./DEPRECATION.md).

Each GitHub Release also carries a **`release-manifest.json`** with a SHA-256 for
every attached `.tgz` and `.zip`, so a tarball you install from the offline
fallback above can be verified against what CI built.
