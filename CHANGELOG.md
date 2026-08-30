# Changelog

## Unreleased

### Changed

- **`@elabs-ai/components-tokens`: Inter now ships as WOFF2, subset by script** (#16).
  The vendored Inter face was still `.woff` (~30% larger than `.woff2` for
  identical content), while Source Code Pro in the same package was already
  `.woff2`. The old file was also a single unsubsetted binary covering Latin,
  Latin Extended, Cyrillic, Cyrillic Extended, Greek and Vietnamese, so the fix
  is not a same-shape swap: Inter is now vendored as 14 `.woff2` files (7
  `unicode-range` subsets × {normal, italic}), matching upstream
  `@fontsource-variable/inter`'s own subsetting, so a browser only fetches the
  script(s) the rendered text actually needs. Combined on-disk size drops from
  957,168 B to 452,780 B (−52.6%); a Latin-only page now loads ~100 KB
  (−89.5%). The `.woff` fallback is dropped, matching Source Code Pro's
  existing no-fallback precedent — every browser in this repo's documented
  floor (`docs/CONSUMING.md`) supports WOFF2, variable fonts and
  `unicode-range` natively.

## v4.0.0 — 2026-08-17

### ⚠️ BREAKING: what a consumer has to change

This major renames the scope, removes a package, a theme and three registry
items, flips one default, and grows the theme-token contract. The detail for
each is in the sections below; these are the steps.

**Migrating a consumer:**

1. **Rename the scope everywhere**: `@elabs/components-*` →
   `@elabs-ai/components-*` — `package.json` dependencies, every import, and the
   Tailwind `@source` lines that point into `node_modules`.
2. **Delete the registry + auth setup.** The packages are public on npmjs.org,
   so any `@elabs:registry=` / `//npm.pkg.github.com/:_authToken=` lines in
   `.npmrc`, and the token step in CI, can go. See
   [`docs/CONSUMING.md`](./docs/CONSUMING.md).
3. **`@elabs-ai/components-blueprint` and the `blueprint` theme are gone.** There
   is no drop-in replacement: author your own theme
   ([`docs/CONSUMING.md`](./docs/CONSUMING.md) § 5.1) and drop the package
   dependency. The `--decoration` dial is unaffected and still works on any
   palette.
4. **If you author a theme, define `--chart-6` … `--chart-12`.** The token
   contract grew by seven entries; a theme block missing them fails the parity
   assertion built off the exported `THEME_TOKEN_NAMES`.
5. **If you install `button`, `default-theme` or `light-theme` with
   `npx shadcn add`, stop.** All three are removed — take the primitive from
   `@elabs-ai/components-ui` and the themes from `@elabs-ai/components-tokens`.
6. **`BentoGrid`'s cursor glow is opt-in.** Pass `spotlight` on the grid (or on
   a single `BentoGridItem`) to keep the old behaviour.
7. **If you relied on `--decoration` styling controls, it no longer does.** The
   dial paints backgrounds and chart fills only; buttons, inputs, badges, menu
   items and timeline dots render identically at 0 and 10.
8. **Source Sans 3 is no longer vendored.** Inter is the UI face in every theme;
   if your own theme referenced Source Sans 3, ship the font yourself.
9. **The light theme's focus ring is the brand lime and measures 1.23–1.42:1** —
   a known WCAG 2.4.7 / 1.4.11 regression, taken deliberately (ADR 0027
   amendment). If you need a visible focus ring on light, override `--ring` in
   your own theme block.

### The packages are published again — public, on npmjs.org

Installing `@elabs-ai/components-*` no longer needs a registry file, a token, or a
CI secret. The packages publish to the public npm registry under the `@elabs-ai`
scope, so a consuming app runs `pnpm add @elabs-ai/components-ui` and nothing else.
This replaces the previous model, where the packages lived on GitHub Packages
and every install — human or CI — first had to authenticate.

- **The packages moved to the `@elabs-ai` scope** — `@elabs/components-ui`
  becomes `@elabs-ai/components-ui`, and so on for all twelve. `elabs` was
  already taken on the public registry. Nothing else about a package changed:
  same components, same props, same exports, same CSS. An app on the old names
  updates by search-and-replacing `@elabs/` with `@elabs-ai/`.
- **A scaffolded standalone app installs from the registry again.** It had been
  handed a local-tarball recipe (`pnpm -r pack`, file: paths) because there was
  no registry to install from; `brand-ui scaffold` now emits the plain install
  line, and the generated `CLAUDE.md` no longer carries registry setup steps.
- **`npx @elabs-ai/components-cli …` / `npx brand-ui …` work as written**, from any
  project, with nothing installed first. The docs rule that forced every such
  example to be paired with an authentication precondition is retired with it.
- **The packages are MIT-licensed**, with a `LICENSE` at the repo root. They
  previously declared `UNLICENSED`, which cannot honestly ship on a public
  registry.
- Releases still come only from CI, on a `v*` tag, and only after the quality
  battery has gone green on that exact commit.

### One signal palette, a twelve-series chart ramp, and a brand-coloured focus ring

The status colours, the chart palette and the focus indicator were all retuned
against an authored source palette. Two of the three are straightforward
improvements; the third ships a deliberate accessibility regression, described
in full below.

- **Status colours are one palette across every theme.** Success is emerald,
  info is sky blue, warning is amber, error is a vivid red — authored as
  `#10B981` / `#0EA5E9` / `#F59E0B` / `#EF4444`. The dark theme carries those
  four literals exactly. The light theme and the `:root` base carry the same four
  **hues** at a deeper rung, because a mid-brightness plate is invisible as a
  status dot or a node stroke on a near-white canvas — three of the four measure
  under the 3:1 bar there. Hue is the shared identity; the rung is per-theme.
  Two hues moved noticeably: success from pine to emerald, and error from a
  pink-leaning crimson to an orange-leaning red.
- **Warning is the one status tone whose light hue is not the authored one.**
  Amber cannot be both bright and visible-as-a-mark on a near-white page: at the
  authored hue, the contrast bar caps how light it may be, and at that lightness
  the colour the screen can actually produce reads as brown. Light rotates a
  little toward orange, which buys back the intensity, and its label ink flips
  dark. Dark keeps the authored amber exactly. The two themes share the meaning,
  not the hue — the same per-theme retune the chart ramp uses.
- **The chart palette grew from five series to twelve.** Three hue families —
  the brand yellow, a blue and a grey — interleaved so the first three series
  drawn are one per family, and every one of the 66 pairs is perceptibly
  separated. **Series 1 is the brand colour itself** — it follows the primary
  token, so re-branding moves the first chart series with it. Both themes carry
  the same ramp, so a chart looks like the same chart whichever theme it is in.
  Two members had to move on their own account: the deep slate was invisible on
  a dark card and was lifted a rung, and one grey took on a little blue to stay
  apart from its neighbour.
- **The light theme's charts pay for that, and it was a deliberate call.** The
  palette is built for a mid or dark plot ground. On the light theme's white
  card, nine of the twelve series are too pale for someone with low vision to
  make out — the palest measures 1.22:1 where 3:1 is the bar. The alternative was
  a light-only re-tune, which satisfied the bar and turned the brand colour into
  an olive; that was rejected on sight. The palette wins, the cost is recorded at
  the token and in the tests, and the fix if it is ever revisited is to darken
  the plot ground rather than lighten the palette. The neutral base that a
  consumer gets when they import no theme at all keeps a legible ramp.
- **Charts actually use all twelve now.** Every chart family that assigns colours
  automatically — pies, rings, radars, scatter series and the spec-driven
  auto-chart — cycles through the full twelve before repeating, where it used to
  wrap after five. The colour picker offers all twelve as swatches, and the
  Foundations palette page shows them.
- **The focus ring is now the primary brand colour.** In the dark theme this is
  unambiguously good — the ring is bright lime on charcoal.
  **In the light theme it is a regression, and an intentional one:** the lime
  measures 1.23–1.42:1 against every light surface, which means a keyboard user
  cannot see which control has focus. That fails WCAG 2.4.7 and 1.4.11. It was
  chosen with the cost known; it is recorded at the token, in the tests, and in
  ADR 0027's amendment. The fix that would keep the brand colour AND a visible
  ring is a compound indicator (the lime plus a dark contour), which is a change
  to how components draw focus, not to a token.
- **For anyone maintaining their own theme:** the token contract grew by seven
  entries (`--chart-6` … `--chart-12`). A theme that does not define them will
  fail the parity check. The `:root` base is unchanged in one respect on purpose
  — it keeps an independent, visible focus ring rather than following the
  reference themes into the alias.

### Decoration is a background texture again — never inside a control, never flat

The decoration dial used to reach everywhere: it hatched buttons, menu items,
tabs and links on hover, re-drew the six coloured role plates as transparent
outlines, and ruled the same graph paper onto the page **and** onto every panel,
card and muted surface on top of it. The result was texture in the one place
someone is reading their own typing, and a screen that stacked three or four
full-strength grids on itself.

- **The dial now paints backgrounds and chart fills. Nothing else.** A button, an
  input, a badge, a menu item and a timeline dot render identically at decoration
  10 and at decoration 0. Charts still swap flat series colour for pattern fills
  at high decoration, unchanged.
- **The ground is painted once, behind the page, and fades out.** One fixed layer
  carries the sheet; opaque panels simply cover it, the way a card on a desk
  covers the paper under it. It also stops repainting the viewport on every scroll
  frame, which was a known source of touch-scroll stutter.
- **No decoration is flat any more.** Every ground — the ambient sheet, an opt-in
  region ground, and the three paper classes — is masked so it fades into
  transparency: a vignette by default, or a direction (`top`/`bottom`/`edges`/
  `center`) when you pick one. The fade is on the texture layer, so a region's own
  text and controls stay fully opaque.
- **The paper classes are much quieter.** `bg-paper`, `bg-dot-grid` and
  `bg-grid-paper` had inks two to three times too strong and a grain layer you
  could see from across the room; all three were dialled down and now fade at
  their edges. Retune with the `--paper-*` tokens, or per element with
  `[--paper-fade:…]`.
- **What high decoration still does to a control** is shape and elevation only:
  it goes shadowless and squares the large corner radii. Both remove a gesture
  rather than paint one.
- **A whole compensating vocabulary could be deleted with it.** Re-inking the six
  role plates to one appearance had collapsed six meanings into one colour, which
  is why the system carried per-status line types, per-polarity glyphs, and
  weight/underline cues in the calculation editor. None of that is needed once the
  dial stops painting controls, so all of it is gone. A story now fails the build
  if anyone paints a control from the dial again.

### The blueprint theme and its drawing package are gone

The experimental navy blueprint theme, the `@elabs-ai/components-blueprint` drawing
package, and the "paused surfaces" machinery that kept them frozen have all been
removed. Two reference themes ship: `light` and `dark`.

- **The decoration dial stays.** It was never the blueprint theme — it is a
  hue-independent texture dial that rides any palette, including one you author,
  and it keeps working exactly as before (with the policy above).
- **Nothing needs un-pausing any more.** The pause list, its gate and its rule are
  gone; a theme or package is either shipped or it is not.

### The default themes and the logo are no longer someone else's brand

The two reference themes shipped a specific company's colour system, typeface and
logotype under generic names. They are now a brand-neutral system in their own
right — lime primary, powder-blue accent, charcoal chrome, warm-white paper — and
the logo is a mark this repo owns.

- **Both reference themes are re-toned.** Every semantic token in `light` and
  `dark` was re-derived against the same contrast, role-distinctness and
  surface-elevation gates the old palette had to pass, so nothing regressed on
  accessibility: body text still clears AA on every surface, status marks still
  clear 3:1, and no two independent roles collapsed onto one colour. Two visible
  consequences: the light theme's sidebar is now dark charcoal chrome under a
  bright canvas, and the primary plate takes near-black ink instead of white —
  which retires the one contrast exemption the previous palette needed.
- **`BrandLogo` carries YOUR name, not ours.** The mark is a hatched circle swung
  over a dashed construction square — the repo's own drafting language rather than
  a generic app glyph — and the lockup's wordmark is whatever `title` you pass: no
  SVG path editing, no forked component. `AppIcon` passes its own `title` straight
  through, so the sidebar lockup in an app shell is the product's own.
- **The mark adapts to whatever it is dropped on, with no prop and no
  `prefers-color-scheme` branch.** It is exactly two inks. The drawn linework
  (circle, hatch, register dots, stray strokes) is `--brand-mark-ring`, which
  defaults to `currentColor` — grey on a light surface, white on dark chrome, right
  on a surface a consumer invents. The construction square is `--brand-mark-tail`,
  now declared as `var(--primary)` in every shipped theme, so re-toning the brand
  moves the logo with it instead of stranding a hard-coded hex. `tone="white"`
  still forces the monochrome mark for a colored plate. The browser-tab favicon and
  the Storybook manager logo carry the same drawing as literals, since neither can
  read the token stylesheet.
- **Inter is the UI face in every theme.** Source Sans 3 is no longer referenced
  by any theme and its vendored faces are dropped from the package, so consumers
  stop installing a font nothing asks for. Source Code Pro stays as the mono.
- **New opt-in paper grounds: `bg-dot-grid` and `bg-paper`.** A drafting-paper
  dot field, and the full sheet (dots + construction rules + paper tooth), as one
  class on any panel, card or section. They ink themselves from `--foreground`,
  so they work in any theme including one you author, and they are deliberately
  independent of the `--decoration` dial: the dial is ambient texture across a
  screen, these are a property of one surface. Retune with the `--paper-*` tokens
  rather than new classes.
- **The upstream company's name is gone from the source, and stays gone.** The
  last of it lived in places a scope rename could not reach: mock source URLs and
  tool names in demo data, a sidebar tooltip, comments explaining a palette that
  no longer exists, doc prose, the changelog and four decision records. All of it
  now describes this repo. A new check (`pnpm debrand:check`) fails on any tracked
  file that names the upstream, case-insensitively, and the same check runs on the
  staged content of every commit — so a regenerated artifact or a doc written from
  an old memory cannot quietly put it back.

### The bento grid rests flat and lifts on hover; the cursor glow is now opt-in

`BentoGrid` led with a primary-tinted glow that followed the cursor around every
tile, and every tile carried a resting card shadow — so the grid read as a field
of already-lifted chips with a decorative effect nobody had asked for.

- **Elevation is the hover gesture now.** The grid rests completely flat (border
  only, no shadow), so a bento sheet reads as one plane; hover a tile and that
  tile alone rises about 4px into a deep, soft shadow with a brand-tinted edge,
  then settles back on a decelerating curve. It lifts in place — the surrounding
  tiles never move — and under an operating-system "reduce motion" setting the
  travel is dropped while the shadow and the edge still mark the hover.
- **The cursor glow is off unless you ask for it.** Turn it on for a whole grid
  with `spotlight` on `BentoGrid`, or for one tile with `spotlight` on
  `BentoGridItem`; a tile's own setting always wins over the grid's, so a single
  tile can opt back out of a spotlit grid. It remains suppressed entirely under
  reduced motion.
- **Breaking for anyone relying on the old default:** tiles that used to glow now
  need `spotlight` passed explicitly. The bento layout inside the markdown
  iteration block picks up the new flat-with-hover-lift behaviour.

### The copy-own registry is now generated, blocks-only, and actually rendered

`npx shadcn add <item>` used to install code that three separate places described
and none of them agreed on: the file on disk, a Storybook story that re-typed the
same JSX, and a hand-written `registry.json`. All three had drifted.

- **Two item types are gone.** The `button` item was a stale fork of the
  `@elabs-ai/components-ui` Button — missing variants and motion tokens — and it
  **shadowed the upstream shadcn `button` name**, so a block asking for `button`
  silently got the fork instead of upstream shadcn. The `default-theme` and
  `light-theme` items hand-copied token values that no longer matched
  `themes.css`, under names that matched no shipped theme. All three are removed:
  primitives come from `@elabs-ai/components-ui`, themes from
  `@elabs-ai/components-tokens`.
- **`registry.json` is generated** from the block source plus an authored
  `registry.items.json` (`pnpm gen:registry`). This fixes installs that were
  wrong: `sidebar-02` declared five dependencies on components its files never
  import, `sidebar-04` and `sidebar-05` shipped incomplete file sets that could
  not compile after install, and several items named packages the code does not
  use while omitting ones it does.
- **Shared stat-card parts exist once.** A new `stat-card-parts` item holds the
  trend badge, chart wrapper and hover bridge that three stat-card blocks each
  carried a byte-identical copy of; the blocks pull it in automatically.
- **Every block story now renders the shipped file.** Six stories reimplemented
  their block instead of importing it, and the registry files themselves had no
  rendered coverage at all. Stat Card (Area), Stat Card (Line) and Stat Card
  (Choropleth) gain their first story.
- **The registry has commit-time teeth.** Committing anything under `registry/`
  regenerates the manifest and blocks the commit if it is invalid or if an item's
  imports would not resolve after install.

### Attribution is now a maintained, public document

Every project brand-ui borrows from is credited in one place. `ATTRIBUTION.md` at
the repo root lists what we took, from whom, under which licence — adapted and
vendored source, runtime map data, self-hosted fonts, and every open-source
dependency — and the README links to it.

- **The credits list grew from 6 entries to 18 adapted/vendored sources.** Twelve
  projects the library actually borrows from were credited only in a source-file
  comment and appeared nowhere a reader could find them: Milkdown, anyview,
  blocks.so, assistant-ui, extend-hq/ui, @ncdai/shimmering-text, Liveline, Bklit
  UI, the Web Interface Guidelines, vercel-labs/agent-skills, subyfly/topojson,
  and the patched Radix primitives.
- **`AI Elements` was credited under the wrong licence.** It is Apache-2.0, not
  MIT. `@elabs-ai/components-ai` now carries the required copyright notice and states
  that the vendored files were modified (Apache-2.0 §4(b)).
- **Two shipped fonts displayed a broken copyright.** Source Code Pro and Source
  Sans 3 showed the string `copyright statement(s).` — a fragment of licence
  boilerplate — instead of Adobe's notice. Both now show the real line, and
  IBM Plex Mono is no longer labelled "Ibm Plex Mono".
- **Every credit now carries a link**, the upstream GitHub repository wherever one
  exists, including the fonts.
- The page and the in-product `AttributionPanel` are generated from one dataset,
  so they cannot disagree about what the product ships.
- **Borrowing again requires crediting again.** `pnpm attribution:provenance:check`
  fails when shipped source says it was adapted, vendored or ported from a project
  that has no entry.

## v3.1.0 — 2026-08-10

### `@elabs-ai/components-viewer`: PDFs and decks scroll continuously (ADR 0026)

A PDF used to show one page at a time, and a deck one slide at a time: reading
the next one meant clicking a button that swapped the canvas. Both now stack
their pages into one column that scrolls, the way every document reader works.

- **Scroll from page 1 to page 2** — no click, no reload of the view.
- **The page number follows the scroll, and the scroll follows the page
  number.** Type "7" and the document scrolls there; scroll, and the field says
  where you are.
- **Long files stay fast.** Only the pages near the screen are drawn, so a
  900-page report costs what is visible rather than what is in the file.
- **The scrollbar is honest immediately.** The document's full height is known
  before the pages render, so the thumb does not shrink as you read.
- **Zooming keeps your place** instead of jumping back to the top.
- **A citation still takes you to its page**, then to the passage on it.

Behaviour change: page 2 of a PDF is now present as soon as the file opens, one
scroll below page 1 — anything asserting that only one page exists at a time
needs updating.

### `@elabs-ai/components-viewer`: the page, the scale and the rotation are the viewer's, not the file format's (ADR 0026)

Which page you are on, how big it is drawn and which way up it sits used to be
private to whichever adapter drew the file. So an app could not open a contract
at page 7, could not put a page control in its own header, and got a pager only
inside the PDF canvas — never over a deck, an image or anything else.

- **Three new controls, and they work over every format that supports them:**
  a pager (previous · a page you can type into · "of N" · next), a scale control
  (zoom out · fit-width / fit-page / fixed stops · zoom in) and a rotate button.
  They appear in the viewer's toolbar by default.
- **They can be moved.** Each is a part, so an app can put the pager beside a
  breadcrumb and leave the document pane clean; every copy stays in step.
- **Deep links work.** `pageNumber`, `zoom` and `rotation` are ordinary props
  with controlled and uncontrolled forms, so "open this at page 2, fitted to the
  width" is a prop, not a reach inside the canvas.
- **Fit-to-width and fit-to-page are real.** The viewer asks for a fit and the
  page reports back what it became, so the control reads "Fit width" while the
  announcement says "Zoom 137%" — and pressing "+" from a fitted page steps UP,
  which it could not do before.
- **Images now zoom and rotate.** They were advertised as able to and were not.
- **A PDF and a deck now scroll like every other file** — one scrollbar for the
  document pane instead of a second one inside the page, which is what used to
  leave a long page ending flush against a band of whitespace.

Behaviour change: the PDF's and PowerPoint's own control rows are gone — the
same controls are now in the viewer's toolbar row above the document.

### The focus ring is on-brand green in both shipping themes (#427)

`--ring` was an off-palette blue — the one hue in the token set with no sibling
role — and it painted every focused control in the library. It is now derived
from the brand: the same hue family as `--primary`, at a deliberately different
rung.

- **What you will see.** Tab through any screen and the focus ring is green
  instead of blue, in `light` (a deep green) and `dark` (a light
  halo). This reaches every focusable control in every package, plus all sidebar
  focus via the `--sidebar-ring` mirror. Nothing else changes: no component was
  edited, no other token moved, and the neutral `:root` fallback is untouched.
- **It is a stronger ring, not just a different one.** Against every surface a
  focus ring lands on it now measures 7.6–8.8:1 in `light` and
  11.1–13.5:1 in `dark`, up from 4.8–5.6 and 7.3–9.4. WCAG 1.4.11 asks for
  3:1.
- **If you patched `--ring` locally, you can drop the patch.** Consumers who
  overrode the token in their own theme block to get an on-brand ring should
  remove that override and take the shipped value — a local override is no
  longer needed, and keeping one means missing future retunes. If you do keep a
  custom ring, `--ring` now has a written contract (see the tokens package
  README): brand hue family, ≥3:1 on every surface, and perceptibly distinct
  from `--primary`, `--chart-1`, `--accent-foreground`, `--info` and `--success`.
  `pnpm roles:check` checks it for you.

### New package: `@elabs-ai/components-viewer` — display a file the app did not write (ADR 0024)

A twelfth package, and the missing half of `@elabs-ai/components-editor`:
`editor` is for source you **author**, `viewer` for content you **read** — an
upload, a signed URL, or a file an agent produced.

- **`FileViewer`** — point it at a `File`, `Blob`, `URL` or string and it detects
  the format, loads the matching parser on demand, and renders it with brand-ui
  components. Compound, so the parts (`FileViewerProvider`, `…Toolbar`,
  `…Content`, `…Skeleton`, `…Error`, `…Empty`) can be rearranged; `<FileViewer>`
  is the batteries-included default. `useFileViewer()` lets a control outside the
  frame drive the same state.
- **Formats are registrations, not code changes.** A pluggable adapter registry
  (versioned protocol, eager manifests + lazy loaders, priority override) means a
  consumer can add a format, replace a built-in, or drop one — without forking.
  Detection is extension → exact MIME → MIME prefix → category, with `priority`
  as the override.
- **Ships with images, plain text, JSON and CSV.** Adapters emit a **data model**
  that brand-ui components render — the CSV adapter produces a real `Table`, the
  JSON adapter a real `Tree` — so an arbitrary file inherits the theme, the
  density dial, RTL and keyboard semantics instead of arriving as styled HTML.
- **Parsers are optional peer dependencies.** Install none and everything still
  builds; a format whose parser is absent shows a panel that **names the package
  to install** rather than failing. CSV wants `papaparse`; images, text and JSON
  want nothing. See `docs/CONSUMING.md` §6.
- **Full state grid**: empty, layout-shaped loading skeleton, and errors keyed by
  cause — a retry is offered only where retrying can actually change the outcome.
- **The file scrolls from the keyboard.** The content pane is a named, focusable
  region, so a plain-text file — which contains nothing clickable — can still be
  read with arrow keys and Page Up/Down instead of requiring a mouse. Long files
  scroll to the edge of the pane rather than stopping in a band of whitespace.

PDF, video, audio, Office, markdown and source code are all below.

### `@elabs-ai/components-viewer`: PDF, video and audio

**PDF is the format nothing in this library could open before.** It renders on
pdf.js: the parser runs on a Web Worker with `eval` disabled, the page is
rasterized to a canvas at the device pixel ratio, and a transparent text layer
sits over it so the page stays selectable, copyable and readable by a screen
reader. The pager and zoom live in the new `Toolbar`, so the whole control strip
is one tab stop. `pdfjs-dist` is an optional peer — never installed, never
bundled, and reached only through a dynamic import, so a consumer who does not
open PDFs pays nothing. `configurePdfEngine()` points the worker, CMap and
standard-font URLs wherever your app serves them.

**Video and audio use the native elements**, deliberately: the platform's own
transport brings keyboard control, captions, picture-in-picture and the OS media
keys. The adapter streams from a URL and never reads the bytes, so a multi-
gigabyte recording opens and seeks instantly instead of being buffered into
memory. A codec the browser cannot decode is stated as a settled failure with no
retry, because retrying cannot install a codec.

An enforced Content-Security-Policy needs `img-src blob:` and `media-src blob:`
for files handed in as a `File`/`Blob` — see `docs/CSP-AND-NETWORK.md` §2.7.

### `@elabs-ai/components-viewer`: Word, Excel and PowerPoint

The three formats people actually get sent. All three follow the same rule as
every other adapter: **the parser hands over data, and brand-ui components draw
it** — so an Office file inherits the theme, the type scale, the density dial and
real keyboard semantics.

- **Word (`.docx`, optional peer `mammoth`)** — mammoth resolves Word's styles,
  numbering and images; the adapter parses that into a block model and renders
  real headings, lists, tables and links. The HTML is thrown away, so nothing
  writes `innerHTML`: no sanitizer dependency, no CSP sink, and a document that
  works under a Trusted-Types policy. A `javascript:` link becomes plain text.
- **Excel (`.xlsx`, `.xlsm`, `.xls`, `.ods`, optional peer `xlsx`)** — every
  sheet is a tab over the same `Table` the CSV adapter renders. Dates read as
  dates rather than Excel serial numbers, and a file that is not a workbook
  container is refused up front instead of being silently misread as a
  one-column CSV. Read the SheetJS advisory note in `docs/CONSUMING.md` §6
  before installing this one.
- **PowerPoint (`.pptx`, optional peer `jszip`)** — no PowerPoint library: a deck
  is a zip of XML, so jszip opens it and the platform's own parser reads it. Each
  slide becomes a title, its text at the authored indent level, and its speaker
  notes — followed through the slide's own relationship rather than by matching
  slide numbers, which is what keeps notes attached to the right slide in a deck
  that has had slides deleted.

**These previews show a document's structure, not its page layout.** No page
breaks, no columns, no positioned shapes, no slide design. That is a deliberate
boundary rather than a gap: a half-faithful reproduction reads as the real
document while quietly lying about it, and the toolbar's download hands over the
original.

### `@elabs-ai/components-viewer`: markdown and source code

The two formats that decide whether a file browser is pleasant to use, because
they are most of what a repository or an agent's output actually contains.

- **Markdown (`.md`, optional peer `streamdown`)** renders as a **document** —
  real headings, lists, links and quotes drawn by the same `Prose*` primitives
  `@elabs-ai/components-ai`'s chat markdown and
  `@elabs-ai/components-editor`'s preview use. A README must not look
  like three different documents depending on which pane it opened in. Fenced
  code inside it reads as a block of code rather than a run-on paragraph.
- **Source code (60+ extensions, optional peer `shiki`)** is highlighted with a
  line-number gutter that is hidden from screen readers, because a reader hears
  the code, not the numbering. A file too large to tokenize is truncated with a
  status line saying how much is shown, not an error.
- **The highlighting theme is written in tokens** (`var(--code-*)`), so
  switching theme recolours the code live — nothing is re-tokenized, and there
  is no second colour system to keep in step with the rest of the library.
  Comments and attribute names lean; ordinary identifiers stay upright.
- **A viewed document's headings sit below the page's own.** A README's `#`
  renders as a second-level heading by default, so a page that already has a
  title does not end up with two of them in a screen reader's heading list.
  `baseHeadingLevel` on `FileViewerProvider` moves the whole tree if your page
  is arranged differently.

### `@elabs-ai/components-viewer`: point the viewer at PART of a document (ADR 0025)

Until now the viewer could open a file but not say _where in it_ to look. It can
now be handed a passage — an answer's citation, a search result, a region of a
scanned page — and it will find it, mark it and scroll to it.

- **One way to address a part of a document, three ways to say it.** A citation
  can name the passage's **text** (the only form that survives coming from
  another tool — an indexing pipeline's character offsets never line up with our
  own extraction), exact **character offsets** (when both ends are ours), or a
  **box on a page** as fractions of the page (which needs no text at all, so it
  works on a scan or a chart). The vocabulary lives in
  `@elabs-ai/components-ui`, so a chat answer can produce one without
  either package having to know about the other.
- **A quote is matched the way a person would read it**, not byte-for-byte:
  re-wrapped lines, curly versus straight quotes, an em dash versus a hyphen and
  a different capitalisation all still find the passage. A repeated phrase is
  disambiguated by what the caller knows (`occurrence`, or roughly where to
  look), never guessed at.
- **"We couldn't find that passage" is something the viewer says**, not something
  it silently does nothing about — and it distinguishes _not in this document_
  from _past the part we previewed_ for a long file. A format that cannot honour
  a given kind of address reports that as a gap in what this build can show,
  which is the same neutral treatment an unsupported file type already gets.
- **`FileViewer` now forwards every one of its own props.** `baseHeadingLevel`
  was accepted, silently dropped, and written onto the DOM instead; it now
  reaches the viewer as documented.

This release lands the plumbing; the marks themselves and the find box arrive in
the entries below.

### `@elabs-ai/components-viewer`: marks on the page, and find-in-document

The passages the viewer can now be pointed at are **drawn**, and the same layer
answers the reader's own search.

- **Text files and source code carry the marks.** A cited passage is highlighted
  in place; the one being looked at right now is picked out from the others by a
  second colour **and** an outline, so it is still the current one for a reader
  who cannot tell the two colours apart. The viewer scrolls it into view —
  instantly rather than smoothly for anyone whose system asks for less motion.
  Syntax colouring survives underneath: a mark that spans several coloured words
  leaves every one of them its own colour.
- **Ctrl/Cmd+F searches the open file.** A search row opens over the document
  with a live "3 of 12" count, Enter and Shift+Enter to step through the matches
  (wrapping at either end), a case-sensitivity toggle, and Escape to close and
  hand focus back to the document. A fruitless search says "No matches" rather
  than "0 of 0", and a search with thousands of hits says how many it is showing.
  Formats the viewer cannot mark leave the shortcut alone, so the browser's own
  find still works there — and so does a viewer you composed yourself without a
  search row in it. The shortcut is only taken over when there is somewhere to
  type.
- **The reader's own search match outranks a citation.** While the search row is
  open, stepping through matches is what moves the viewer: the current match is
  the one picked out, scrolled to, and — in a PDF, a workbook or a deck — the one
  the page, sheet or slide follows. Closing the row hands the citation back.
- **The stepper stays reachable from the keyboard even with nothing to step
  through.** Previous and Next announce that they are unavailable instead of
  vanishing from the tab order under a reader's fingers.
- **New in `@elabs-ai/components-ui`:** `MatchHighlight` can now be
  told which of its matches is the current one, and its marks are addressable
  from outside for tests and styling.

Two new theme colours (the current match's plate and its ink) are defined in
every theme; a brand overriding the highlight pair should set them too.

### `@elabs-ai/components-viewer`: citations land on the PDF page

A PDF page is pixels, so a cited passage is drawn as a translucent box over the
page rather than as a mark around the text — the sentence underneath stays
readable, and the box the reader is on is also drawn twice as thick, not merely
in another colour.

- **Activating a citation turns to its page.** The viewer now records which page
  each stretch of the extracted text came from, so a quote found on page 7 takes
  the reader to page 7 and then scrolls the box into view.
- **A passage can be given as a position on the page instead of as text.** For
  the first time an app can say "this rectangle, on page 3" — the address an OCR
  or layout-aware pipeline already produces — and skip text matching entirely.
  The position is stored as a fraction of the page, so it stays correct at every
  zoom level and after any resize.
- **Find-in-document now works in PDFs**, through the same layer.

Only the first 50 pages of a PDF are text-extracted, unchanged from before; a
passage past that limit is now reported as "beyond the pages we previewed"
rather than as missing from the document.

### `@elabs-ai/components-viewer`: citations in Word documents and markdown

Both formats can now be pointed at a passage, and each is marked the way its own
content allows.

- **Word marks the words.** A cited passage is underlined in place, wherever it
  falls — mid-paragraph, inside a bold run, in one bullet, in a single table
  cell — and the document keeps reading as a document around it. Find-in-document
  works in a `.docx` for the same reason.
- **Markdown lights up the block, on purpose.** A markdown file is addressed by
  its source, where offset 212 can land inside `**bold**` — two characters the
  reader never sees. Rather than guess at which words that means, the paragraph,
  heading, list item or code fence containing the passage is plated whole. It
  points a reader at the right place and cannot be subtly wrong about the words.
- The current passage is never distinguished by colour alone in either: it
  carries a thicker rail and is announced as the current one.

### `@elabs-ai/components-viewer`: citations in spreadsheets and decks

Every text-bearing format the viewer opens can now be pointed at a passage.

- **A spreadsheet marks the cell.** A cited passage is highlighted inside the
  cell that holds it, not across the whole row, and a citation on a sheet that is
  not on screen **switches to that tab** before scrolling the row into view.
  Works the same in a `.csv` and in a multi-sheet workbook, because both are
  addressed against the same projection of the grid.
- **A deck marks the line and pages to the slide.** A title, a bullet, a table
  row on a slide, or the speaker notes — whichever the passage came from — with
  the deck turning to that slide first, the way the PDF turns to the cited page.
- **⚠️ Behaviour change: a CSV's `text` is now the parsed grid, not the raw
  file.** `AdapterDocument.text` for the `csv` adapter used to be the bytes as
  read; it is now the parsed table, cells joined by tabs and rows by newlines.
  This is what makes a citation resolvable at all — raw bytes carry quoting,
  escapes and whatever delimiter the exporter chose, so an offset into them lands
  nowhere in particular in the rendered table. Find-in-document and copy-the-text
  now match what the reader sees. If you relied on `document.text` for the raw
  file, read the source instead.

### `@elabs-ai/components-ai`: `AssetPreview` can be taught new formats

`AssetPreview` (the context rail's drill-in preview) now takes
**`renderPreview?: (asset) => ReactNode | null`** — as a prop, or once for a
whole rail via `<ContextPanelProvider renderPreview={…}>`. It is how a PDF, a
spreadsheet or a video reaches the rail without this package depending on
`@elabs-ai/components-viewer`; the two are peers in the layer graph
and neither may import the other, so the app owns the edge:

```tsx
<ContextPanelProvider
  renderPreview={(asset) => (asset.source ? <FileViewer source={asset.source} /> : null)}
>
```

**Returning `null` declines**, and the built-in markdown / code / SQL / CSV /
image rendering runs exactly as before — an injection that only knows PDFs
changes nothing else. Raw mode is never intercepted; "Raw" means show me the
source. `ContextAsset` gains `source?: FileSource` and `mediaType?`, so an asset
can be a file rather than a string. `ContextAssetType` deliberately did **not**
grow cases: that union describes what this package can draw itself.

`ProducedAssetTree` follows: a **file-backed** asset now takes its glyph from its
own name and MIME, so a PDF stops drawing a source-code icon. An asset with
inline content keeps the glyph it had.

### `@elabs-ai/components-ui`: one shared file model (ADR 0024)

New, additive — nothing existing changes shape. Three dependency-free helpers
that give the library a single answer to "what file is this, and how do I read
it", ahead of the `viewer` package that consumes them:

- **`FileSource`** — the input union every file-shaped surface can accept:
  `file` · `blob` · `url` · `buffer` · `text`. The `url` variant carries
  `init?: RequestInit`, so a file behind auth (headers, credentials, an abort
  signal) is reachable — previously a viewer could only be handed a naked URL.
  Every binary variant takes `alt`, so images and rendered pages have a place
  for a description.
- **`normalizeFileSource(source)`** — turns any of them into one
  `ResolvedFileSource` (`name` · `mediaType` · `category` · `extension` ·
  `alt` · `size`, plus `bytes()` / `text()` / `url()` / `revoke()`). Resolution
  is synchronous and free; nothing is read, fetched or decoded until asked.
  Successful reads are memoized, failures are not, so a retry re-runs.
- **`resolveFileKind(name, mediaType?)`** and the closed `FileCategory` union —
  the one extension+MIME resolver, replacing three package-private maps that
  could not see each other. It is deliberately coarse: it picks an icon, a
  label or a fallback surface, and is **not** a renderer routing key, so adding
  a format never means a `…-ui` release.
- **`FILE_CATEGORY_ICONS` / `fileIconFor()`** — one Lucide glyph per category,
  superseding `PRODUCED_ASSET_ICONS` and `mediaCategoryIcons` in
  `@elabs-ai/components-ai`, which disagreed about the same `.csv`.

`Blob.arrayBuffer` is feature-detected with a `FileReader` fallback, so these
work under jsdom in every downstream package's tests as well as in a browser.

### `@elabs-ai/components-ui`: shared Streamdown translations

`useStreamdownTranslations()` and `STREAMDOWN_TRANSLATION_KEYS` moved down from
`@elabs-ai/components-ai` so every package that renders markdown
translates it the same way — Streamdown ships its own English strings ("Copy
Code", "Download diagram"), and a `<LocaleProvider>` used to stop at that
boundary in whichever package had not copied the bridge. The `ai.streamdown.*`
message keys are unchanged, so an existing override keeps working, and
`@elabs-ai/components-ai` still re-exports the hook. It imports
nothing from Streamdown itself, so this adds no dependency to `…-ui`.

### `@elabs-ai/components-ui`: `Toolbar` — the row that keeps the role's promise

New primitive over `@radix-ui/react-toolbar`. `role="toolbar"` promises a
**single tab stop with arrow-key navigation between the controls**; four rows in
this repo claimed the role without implementing it, which is worse than not
claiming it — assistive tech tells the user to press keys that do nothing.
`Toolbar` / `ToolbarButton` / `ToolbarSeparator` / `ToolbarToggleGroup` /
`ToolbarToggleItem` delegate the roving tabindex to Radix and reuse
`buttonVariants` / `toggleVariants`, so a toolbar control looks like every other
control in the system.

Reach for it when a row is **dense and secondary** to the content it acts on (a
document's page/zoom strip, a formatting bar) — collapsing a dozen controls into
one tab stop is what makes the content reachable again. For the ordinary control
row above a list or table, `ViewToolbar` is still correct: there every control is
its own tab stop, which is what readers expect.

### `@elabs-ai/components-ai`: `Toolbar` → `NodeToolbar` (deprecated alias kept)

The canvas part that attaches to a selected **node** is now `NodeToolbar`
(`NodeToolbarProps`), after the React Flow primitive it wraps — `Toolbar` now
means the WAI-ARIA toolbar above. `Toolbar` / `ToolbarProps` remain as
`@deprecated` aliases, so **nothing breaks today**; they will be removed in the
next major. Rename at your leisure:

```diff
-import { Toolbar } from "@elabs-ai/components-ai";
+import { NodeToolbar } from "@elabs-ai/components-ai";
```

### `@elabs-ai/components-ui`: `DialogBody` no longer clips a flush child's focus ring

The focus outline around a field inside a dialog is no longer cut off at the
edges — a keyboard user can see which field they are in, including in a dialog
holding a single field, where the outline previously disappeared completely.
`DialogBody` now reserves a 4px gutter (`-m-1 p-1 scroll-p-1`) around its
scrollport so an outward `ring-2 ring-offset-2` on a full-width child is never
clipped by the scroll container's own edge. `@elabs-ai/components-editor`'s
iteration builder dialog picks this up by switching its scrolling region to
`DialogBody`.

### ⚠️ `@elabs-ai/components-charts`: bar-chart category labels now fit the space they are given

Category labels under a bar chart used to be painted at full length wherever the
band centre fell, so on a narrow card — the chat surface this was reported from —
they simply overprinted each other into an unreadable smear. The only guard was a
count cap, which ten categories never tripped.

`BarXAxis` and `BarYAxis` now **measure** their labels in the font the chart
actually resolved (density- and theme-aware, re-measured when a webfont settles)
and pick the first mode that fits: keep them horizontal → tilt them 45° → clip
them with an ellipsis → show every _n_-th one → hide the axis entirely when the
container is too small for any of it to be legible. A clipped label keeps its
**full text for screen readers**, so "Q1 Wester…" is never what gets announced.

`BarChart` reserves the space the plan asked for, growing its own `margin.bottom`
(vertical bars) or `margin.left` (horizontal) up to 72px / 112px. **The plot area
shrinks; the container's height does not** — nothing outside the chart moves. That
also fixes a standing bug where a horizontal bar chart clipped its row labels at a
hardcoded 70px inside a 40px gutter, i.e. every long label overflowed the chart.

Two behaviour changes to name explicitly:

- **`showAllLabels` no longer forces horizontal rendering.** It still means "do not
  drop any label", but those labels may now tilt, be clipped, or — below the
  legibility floor — be hidden.
- **The axis can now hide itself.** On a container narrower than 160px there is no
  arrangement of text that reads, so the axis renders nothing rather than a smear.

**A clip is never allowed to lie.** If shortening would leave two _different_
categories reading the same ("Q1 Western Region" and "Q1 Central Highlands" both
clipped to "Q1…"), the axis shows fewer labels rather than a row of identical
ones — a shortened name is useful, a false one is worse than none. Two categories
that genuinely share a name are left alone: that is the data, not the clip.

**A chart smaller than its own margins now draws.** In a box roughly 140×70 —
what a chat transcript leaves for a thumbnail — the chart's fixed 40px margins
exceeded the box, the plot area went negative, and the whole chart rendered
blank. Margins are now squeezed proportionally to keep a minimum plot area, so
the bars always paint even when there is no room for anything else.

**Nothing is lost to a screen reader.** Every rung below "everything fits" takes
names out of the page, and a chart body is `aria-hidden` — so the axis re-states
the categories it did not paint in a single visually-hidden run. A strided or
hidden axis reads exactly the same set of category names as a full one.

Escape hatch: `<BarXAxis fit="off" />` (and `<BarYAxis fit="off" />`) reproduces
the previous render exactly — full labels, no rotation, no reserved space.

### ⚠️ `@elabs-ai/components-charts` + `-ui`: numbers are compact by default, and the exact value is one click away

Five unrelated number formatters had grown across the chart package, and none of
them was reached by the chart's own `valueFormat`. The worst of them hand-rolled
thousands, so `1500000` rendered as **`1500k`** and `50012102.632741` rendered
raw. There is now one formatter, locale-aware, and every chart surface reads it.

- **Axis ticks, tooltips, the flip-to-table view, the expand pane's summary and
  `MetricCard` all speak the same format.** `1500000` is now **`1.5M`**, `1500` is
  `1.5K`, and anything under 1000 keeps its digits and grouping. A chart's
  `currency` is honoured (`ChartSpec.currency`, or `ChartConfigProvider`) instead
  of the hardcoded USD it used before.
- **Compact hides digits, so every compacted number can hand them back.**
  Clicking (or pressing Enter on) a compacted value copies the **exact** number to
  the clipboard, with a short "Copied" confirmation announced to screen readers.
  This is live on `MetricCard`'s value and on the expand pane's min/max/average.
  On the chart body itself it rides the existing keyboard datapoint layer, so it
  works from the keyboard as well as the mouse — `copyValueOnActivate`, **on by
  default for `AutoChart`**, off by default on the raw chart containers (turning
  it on there mounts the interaction layer, which would change their DOM).
- **Two places deliberately stay uncompacted**, because they are already the
  detail view: the **flip-to-table** cells and the **hover tooltip** show grouped
  full digits. Compacting the table would mean 30-plus new keyboard stops to
  recover digits that were already on screen, and the tooltip cannot carry a copy
  button without swallowing the mouse movement that drives the crosshair.
- `MetricCard` gains `valueFormat` and `currency`, and formats a **numeric**
  `value`. Any other node — including the pre-formatted strings every current call
  site passes — goes through untouched. Its copy control is **named after the
  metric** ("1.2M, Revenue, Copy exact value"), so two tiles that compact to the
  same figure are still told apart by a screen reader.

Escape hatches: `valueFormat="number"` on a chart spec, `<YAxis formatValue={…} />`,
`<MetricCard valueFormat="number">`, `copyExactValue={false}` on a copyable value,
and `copyValueOnActivate={false}` on `AutoChart`.

#### Deprecated

- **`YAxisProps.formatLargeNumbers`** — the old thousands-only switch. It still
  works, and still wins where it is set, but it is superseded by `valueFormat`
  (which understands millions, billions, currency, percent and locale). It will be
  removed in the next major.

### `@elabs-ai/components-ui`: `ExpandDialog` — one "make this bigger" surface

"Expand" used to mean four different things depending on what you clicked: a
chart opened a two-pane modal, a table went full-screen, a gallery opened its own
lightbox, and an app that wanted the behaviour for anything else hand-rolled a
fifth. The two-pane modal was the right answer all along — it was simply trapped
inside the chart package where nothing else could reach it.

`ExpandDialog` is now a shared surface: the enlarged content on one side, its
context on the other. Pass a `title`, optional `description` and `actions`, the
content as children, and the context as `detail`. Both panes scroll on their own
and each is reachable from the keyboard, so a pane holding nothing but text can
still be read with the arrow keys. `detailPlacement` puts the context below
instead of beside; `stackBelow` re-runs that decision at a breakpoint so a phone
does not get a 100px-wide context column; `viewSize`/`detailSize` set the split.

`ChartFrame`'s expand is now this component — same layout, same proportions,
**two new keyboard stops** (one per pane), which is the correct outcome for a
scrollable region. `ToolResultCard` gains an `actions` slot on its title row, so
a produced table can offer the same expand affordance a produced chart does
without growing a toolbar of its own.

### ⚠️ `@elabs-ai/components-charts`: `AutoChart` bar charts finally have a value scale

A spec-driven bar chart drew its bars, its category labels and its gridlines —
and no value axis at all, so a reader had to hover every bar to learn what any of
them was worth. Vertical bar charts now render a formatted y-axis, and horizontal
bar charts use the row-label axis that fits its labels (above) with gridlines
running the correct way for the orientation.

The chart title also moves off a hardcoded font size onto the type scale, so it
now tightens and loosens with the density setting like the rest of the text.

Horizontal bar charts still have no value axis along the bottom — that is a
separate component, tracked as #422.

### Releases publish in minutes instead of half an hour

Nothing about the published packages changes — this is the release pipeline.
Tagging `v3.0.0` took 38 minutes, and 29 of them re-ran the quality battery that
`main`'s own CI was running, concurrently, on the identical commit. The release
now **requires that battery's verdict** for the exact commit under the tag
instead of re-deriving it, builds only the packages it publishes (the Storybook
site it used to build is not part of any release artifact), and runs the
post-release fresh-install smoke as a separate job so the GitHub Release exists
as soon as the publish does.

The guarantee is unchanged: nothing is published from a commit whose blocking
gates have not passed, pinned to the immutable commit SHA. **What changes for
whoever cuts a release:** push `main`, let the blocking CI jobs go green on that
commit, and only then tag — `docs/RELEASING.md` § 4 has a one-line command that
answers "is this commit releasable yet?".

## v3.0.0 — 2026-08-10

### ⚠️ BREAKING: the `blueprint` theme and package are paused — two themes ship, eleven packages publish

`THEMES` / `THEME_META` no longer enumerate `blueprint`, so the `ThemeName`
union narrows from three names to two (`light`, `dark`), and
`@elabs-ai/components-blueprint` is no longer published.

**Why it is not cosmetic:** `ThemeName` is a public type. Any consumer that
annotates a variable, a prop or a stored preference with `"blueprint"` stops
type-checking, and a persisted `"blueprint"` value is now rejected on boot
rather than applied — so a user who had selected it lands on the default theme
instead of a broken one. Removing a name from a public union and dropping a
package from the release set are both removals, and removals ship in a major
(`docs/DEPRECATION.md` § 2).

**Nothing was deleted.** The `[data-theme="blueprint"]` CSS block, its DTCG
token file and the whole package directory stay on disk untouched. Pause is
reversible; un-pausing is the maintainer's call
(`.claude/rules/paused-surfaces.md`).

**Migrating a consumer:**

1. **Drop `@elabs-ai/components-blueprint` from `package.json`** and
   remove its imports. It is not published at `3.0.0`; there is no replacement
   component — the drawing furniture is paused with the theme.
2. **Remove any `"blueprint"` literal** you pass to `ThemeProvider`
   (`defaultTheme`, `allowedThemes`) or compare against `ThemeName`. Typecheck
   points at each site.
3. **Clear a persisted `"blueprint"` preference** if you store the theme
   yourself. `ThemeProvider`'s own persistence already rejects it on boot — this
   step only applies if you read the value into your own state as well.
4. **Keep the reprographic look with the decoration dial, not the theme.** It is
   **not** paused: set `data-decoration="10"` (or `<DecorationProvider value={10}>`
   / `useDecoration().setDecoration(10)`) on `light` or `dark`. The
   dial is hue-independent, so drawn-not-filled, grid and hatch all still apply.
5. **Pin `2.1.1` instead** if you cannot absorb this yet. That version is
   immutable and still installable, and it is where the blueprint package stays.
   Per `docs/DEPRECATION.md` § 4 the previous major gets no back-ports.

New from `@elabs-ai/components-tokens`: `PAUSED_THEMES` and
`isPausedThemeName`, so a consumer can see what is on hold rather than guessing
from a missing name.

### ⚠️ The documented CSP is no longer proven to work — it is reviewed, not executed

**No code change; a guarantee downgrade you should know about if you deploy under
a Content-Security-Policy.** `docs/CSP-AND-NETWORK.md` §2.7 used to be executable:
an in-repo Vite app served that exact policy as a real response header in dev and
preview, and a Playwright test failed CI on any violation a real browser reported.
Both were deleted on 2026-08-02 (`80a12fb`), which left four gates pointing at
files that no longer existed — so **`main` was red from 2026-08-02 to 2026-08-10**
and three merges landed on top of it, including the blueprint pause above. This
release repairs that.

The maintainer's call was to complete the removal rather than rehome the serving
dogfood, so what survives is static: the policy moved to `docs/csp-policy.json`,
and `pnpm csp:check` still keeps §2.7 equal to it in meaning and still refuses any
relaxation without a written carve-out. **What no longer happens is anyone
checking that a browser can actually load a brand-ui surface under that policy.**
Every relaxation was measured against a running browser when it was added and
those measurements are recorded in the carve-outs, but nothing re-runs them —
verify §2.7 against your own build. `pnpm tt-aliases:check` (§2.2) is unaffected
and still resolves both packages for real on every CI run.

The Trusted-Types reference policy the doc tells you to copy moved with it, to
`docs/examples/trusted-types.ts`. Also removed as dead: the `E2E (Playwright)` CI
job, which had been failing silently on every pull request since the suite it ran
was deleted, and the `pnpm playground` / `pnpm test:e2e*` scripts.

---

- **The `blueprint` theme and `@elabs-ai/components-blueprint` are
  PAUSED — kept as source, out of everything else.** Blueprint was always an
  experimental/testing surface; it is now frozen on the maintainer's call
  (`.claude/rules/paused-surfaces.md`). **Breaking for anyone who selected it:**
  `THEMES` and `THEME_META` ship two themes (`light`, `dark`), so
  `ThemeName` narrows accordingly and a persisted `"blueprint"` preference is
  rejected on boot instead of applied. The theme's `[data-theme="blueprint"]`
  block, its DTCG token file and the whole package directory stay on disk
  untouched — nothing was deleted — but no test, gate, story, doc, app or
  release enumerates them any more, and the drawing-furniture package is now
  `private` and is no longer published (consumers stay pinned on 2.1.1). The new
  `PAUSED_THEMES` / `isPausedThemeName` exports from
  `@elabs-ai/components-tokens` name what is on hold, and
  `pnpm paused:check` (self-tested, blocking) fails if anything re-enumerates a
  paused surface — or if a paused surface's source is deleted. **The decoration
  dial is unaffected**: `--decoration` 0–10, `decoration.css`,
  `DecorationProvider` and both decoration gates stay fully live, and the
  stories that used to pin the blueprint theme now pin `decoration: 10` instead,
  so the drawn-not-filled look is still covered on the shipped palettes.

- **`MessageActions` can present as a hover-revealed floating pill
  (`@elabs-ai/components-ai`).** Two new `cva` axes on the existing
  row — no new component, and both defaults are the pre-existing shape, so every
  current consumer renders byte-identically. `appearance="bar"` wraps the
  controls in a `rounded-full bg-popover shadow-ring-sm` pill (ADR 0020: a
  floating surface takes the ring, never a border, and because the hairline sits
  outside `--shadow-strength` the pill keeps a drawn edge where the lift is
  zeroed). `reveal="hover"` fades the row out at rest and brings it back on
  hover of the parent `Message`, on hover of the row, on focus landing inside
  it, and while a menu launched from it is open. The fade is gated on
  `pointer-fine`, so a touch device — which has no hover state and no gesture
  that could reveal a hidden row — never hides it at all. The controls stay
  mounted and in the tab order throughout, so `focus-within` is what returns the
  pill for a keyboard user. The row now also carries `role="group"` with an
  overridable accessible name (`ai.message.actions`, new microcopy key), since
  assistive tech reaches these controls whether or not a pointer revealed them.
  **It ships no behaviour**: no clipboard call, no pin state, no persistence —
  each `MessageAction` is a bare button the host wires with `onClick` and, for a
  toggle, an `aria-pressed` it owns (D5).
- **The user chat bubble is neutral grey again in both reference themes
  (`@elabs-ai/components-tokens`).** `--chat-user` carried a green tint
  in `light` (`oklch(0.95 0.03 153)` — mint) and `dark`
  (`oklch(0.32 0.04 153)` — olive/swamp on the warm charcoal ground), so a
  `Message from="user"` read as a brand/success wash rather than "the other
  speaker". The user turn is a **fill** separation channel, not a status: hue is
  reserved for the brand and status roles. Both now use the theme's own neutral —
  `oklch(0.93 0 0)` on bright (one step below the assistant turn at `0.97` and the
  card at `1.0`) and `oklch(0.33 0.006 75)` on dark (one step above the assistant
  turn at `0.26`) — so the two turns still separate by ground. `light`'s
  `--chat-user-foreground` drops its matching green cast for the theme ink
  (`oklch(0.37 0 0)`, 8.2:1 on the new fill). `blueprint`'s navy bubble and the
  `:root` fallback are untouched.
- **Charts mock-namespace test timeout resolved (`@elabs-ai/components-charts`).** The test that validates export completeness of the chart test double was timing out at the Vitest default 5000ms when run under full parallel fan-out (`pnpm exec turbo run typecheck lint test --force`), despite passing consistently (~2s) when run standalone. The heavy `vi.importActual` call can take 3–6 seconds depending on machine load. Added an explicit per-test timeout override of 15_000ms, raising the margin above the worst-observed cost (6247ms) while keeping the export-completeness assertion unchanged. Verified that breaking the invariant still fails correctly.
- **`MentionInput`'s `document.fonts.ready` mirror re-measure arm is now
  documented as an intentional keep (`@elabs-ai/components-ui`,
  #405).** No behavior change — the source comment and
  `docs/ADR/0023-mention-input-primitive.md` §6 now both record that this arm
  is kept as unpinned defence-in-depth (five isolation attempts could not
  construct a test that reds when only this arm is removed; it is covered
  only compositely by the `ResizeObserver`/`MutationObserver` arms), so a
  future reader doesn't re-attempt the same scenarios or delete it on the
  strength of "no test notices."
- **`brand-ui <subcommand> --help`/`-h` is now a TERMINAL flag, before any
  handler runs (`@elabs-ai/components-cli`, #323).** `--help`/`-h` was parsed into the
  flags/args sets but never checked once a subcommand was present, so e.g.
  `brand-ui context --help` fell through to the normal `context` handler and
  silently rewrote the stale-gated `apps/docs/public/brand-ui-context.md` — a
  read-only-looking flag performing a write. Every subcommand now prints its
  own one-line usage and exits 0 before its handler is reached; `brand-ui -h`
  also now matches `brand-ui --help` for the bare invocation.
- **`brand-ui docs <Component> --json` now emits structured JSON instead of
  silently ignoring `--json` (`@elabs-ai/components-cli`, #325).** `docs` was the one
  command the CLI's own `--help` claimed was `--json`-capable but wasn't — it
  always printed its markdown card regardless of the flag. `--json` now
  collects the same fields the markdown renders (`purpose`, `relationships`,
  `stateTokens`, `antiPatterns`, `props`, `variants`, verbatim source
  snippets) into a structured record (an array when multiple components are
  queried); the markdown path is unchanged.
- **`ModelPicker` gains controlled `open`/`onOpenChange` (`@elabs-ai/components-ui`,
  #409).** The popover's open state was internal `useState` only, so a consumer
  couldn't open the picker programmatically (e.g. forcing a re-pick when a
  previously pinned target becomes unavailable) or observe it opening/closing.
  `ModelPickerProps` now accepts an optional `open?: boolean` +
  `onOpenChange?: (open: boolean) => void` pair, following the standard
  controlled/uncontrolled idiom (`isControlled = open !== undefined`, mirroring
  `Popover` and `ContextPanelProvider`). Uncontrolled behavior — no props passed —
  is unchanged. Adds a `Controlled` story and locking tests for both modes.
- **`Slider` supports multi-thumb/range sliders with per-thumb `aria-valuetext`/`thumbProps`
  (`@elabs-ai/components-ui`, #398).** Previously `Slider` rendered exactly one
  hardcoded `SliderPrimitive.Thumb`, so Radix's array `value`/`defaultValue` (its own
  range-slider shape) silently rendered only the first value with no visible/operable
  thumb for the rest. `Slider` now renders one `Thumb` per element of
  `value`/`defaultValue`. `thumbProps` keeps its existing single-object shape (applied to
  every thumb, unchanged for single-thumb callers) and additionally accepts an **array**,
  indexed positionally against `value`/`defaultValue`, so each thumb in a range slider can
  carry its own `aria-label`/`aria-valuetext`/`data-*` — `PROTECTED_THUMB_KEYS` stripping
  (`role`/`aria-valuenow`/`aria-valuemin`/`aria-valuemax`/`aria-orientation`/`tabIndex`)
  still applies per-thumb. The thumb-props type is now exported as
  `SliderThumbProps`. Adds a `Range` story and unit tests (`slider.test.tsx`) asserting
  each thumb's `aria-valuetext` independently. The `Range` story's `play` function also
  asserts a **real Chromium accessibility tree** (CDP `Accessibility.getFullAXTree`, via
  `@vitest/browser/context`'s `cdp()`) reports two distinctly-named, distinctly-valued
  `slider` nodes — not just a DOM `aria-valuetext` attribute — proving the AC's actual bar
  (what assistive tech reads) rather than the markup that produces it; this assertion runs
  under Vitest's browser-mode test runner (`pnpm --filter @elabs-ai/components-docs test-storybook`,
  the same engine CI's blocking "Storybook interaction + axe" job uses) and no-ops
  elsewhere (plain interactive Storybook browsing, `build-storybook`), since that module
  only resolves inside that runner by design.
- **`@elabs-ai/components-data` source files now carry `"use client"`
  directives (#324).** The package is RSC-safe via the tsup build banner, but
  source-consumed apps (which transpile `src/` directly) never saw the directive.
  Added to `DataTable`, `SearchInput` and other hook-using modules so RSC apps
  get the boundary contract at the source level, not only the built artifact.
  Also adds `check-use-client-source.mjs` gate: any client package using hooks
  must have at least one `"use client"` module, preventing regression if future
  builds or imports change.
- **One ink polarity per status family, and the sidebar mirror finished
  (`@elabs-ai/components-tokens`, #406).** Three P2 findings from the
  three-theme sweep of #383/#321/#385, all caused by landing contrast fixes
  per-PAIR instead of per-FAMILY. (1) `light --info` was the only status
  plate in the theme with reversed (dark) ink; (2) `:root --success` / `--info`
  were likewise dark-inked while `--primary` / `--destructive` / `--warning`
  were white. Both are now resolved the way #381 resolved `--warning` — by
  deepening the FILL out of the `L 0.6` dead zone instead of flipping the ink,
  so all five plates in each theme share one polarity: `light --info`
  `oklch(0.6 0.13 245)` → `oklch(0.53 0.11 245)` (chroma eased so it stays
  perceptibly apart from `--ring`), `:root --success` `oklch(0.6 0.14 150)` →
  `oklch(0.52 0.14 150)`, `:root --info` `oklch(0.6 0.15 240)` →
  `oklch(0.52 0.15 240)`, each with `--<tone>-foreground` back to white
  (4.95–5.03:1 on its own fill). Deepening a fill only raises its WCAG 1.4.11
  mark rung, so the colour-only marks that use `bg-info` / `bg-success` bare
  improve too (worst case 3.24:1 → 4.52:1 in `light`, 3.36:1 → 4.60:1 in
  `:root`). (3) `--sidebar-primary-foreground` is now a declared
  `var(--primary-foreground)` alias in all four blocks, the partner its
  `--sidebar-primary: var(--primary)` mirror was missing — zero pixel delta, the
  values were already byte-identical. **`blueprint` and `dark` status
  values are untouched.** **Migration:** none for consumers using the tokens;
  if you hard-coded the old `--info` / `--success` literals, re-read them from
  the tokens.

- **New `--primary-text` token — the brand accent as ordinary TEXT
  (`@elabs-ai/components-tokens`, #399, closes the colour half of
  #317).** Every status tone already shipped three rungs — the fill
  (`--<tone>`, WCAG 1.4.11 mark contract, ≥3:1), the plate ink
  (`--<tone>-foreground`) and the on-surface text rung (`--<tone>-text`,
  ≥4.5:1) — but `--primary` shipped only the first two. So 16 call sites that
  needed "brand accent, as ordinary text" reached for `text-primary`, the FILL,
  which in `light` (the DEFAULT theme) measured **3.87–4.48:1** on the
  five content surfaces and 4.47:1 in the `:root` fallback: real, shipped WCAG
  1.4.3 AA failures on `ProseLink`, `Button variant="link"`,
  `Text tone="primary"`, the academic-layer citation/footnote links and more.
  `--primary-text` is now defined in all four theme blocks, mapped as
  `--color-primary-text`, and gated ≥4.5:1 against `--background`, `--card`,
  `--surface-muted`, `--muted` and `--secondary` in every theme by
  `themes-contrast.test.ts` (plus a byte-inequality row vs `--primary`,
  `--success-text`, `--info-text` and `--ring`). The 16 on-surface-text call
  sites moved to `text-primary-text`; **the fill/plate/icon sites did not** —
  `bg-primary`, `text-primary-foreground`, the `radio-group` / `file-tree` /
  `message-feedback` / `file-upload` icon marks and the `use-case-card` icon
  tile keep the fill rung, which is what their contrast contract is tuned for.
  **`--primary` itself is unchanged**, so nothing re-brands. **Migration:** if
  you styled brand-accent _text_ with `text-primary`, switch to
  `text-primary-text`; keep `text-primary` for colour-only graphical marks.
  **Verified in the browser (#317):** a Playwright + axe-core scan of
  `editor-markdownpreview-academic--{citations-numeric,citations-author-year,academic-paper,footnotes}`
  reports **0** `color-contrast` / `link-in-text-block` violations in all three
  themes (12/12 story-theme combinations), and reverting just the two
  `citations.tsx` classes reproduces the original 9 failing nodes at 4.3:1 — so
  the scan really sees this defect class, unlike `test-storybook`, which reports
  these stories clean either way (#402).

- **`Calendar` month-navigation buttons no longer escape the calendar
  (`@elabs-ai/components-ui`).** The `classNames` map still carried
  react-day-picker **v8**'s layout hack — `absolute start-1 top-1` on
  `button_previous` / `button_next`, which worked only because v8 rendered the nav
  buttons _inside_ the `relative` caption. In v9 (9.14.0 here) `<nav>` is a sibling
  of the month, so nothing inside the calendar was positioned and the two chevrons
  resolved against whatever positioned ancestor the page happened to have: measured
  at `x=4` and `x=868` of the **viewport** in a bare story, and at the corners of
  the docs preview box / popover elsewhere. The nav is now the absolute part,
  anchored by a `relative` `months` container and overlaying the caption row
  (`inset-x-0 top-0 h-7 justify-between`), with the buttons back in normal flow;
  `month_caption` gains `h-7` + `px-8` so a long caption can't run under them.
  Fixes the same bug in `DatePicker` and `DateRangePicker`, which wrap `Calendar`.
  Adds `calendar.test.tsx` locking the invariant that every absolutely-positioned
  part has a positioned ancestor _inside_ the calendar.
- **`PromptInputSubmit` refuses via `aria-disabled`, not the native attribute
  (`@elabs-ai/components-ai`).** Merged from the long-lived
  `fix/a11y-review-followups` branch. A focused control that becomes _natively_
  disabled is removed from the focus order by the HTML focus-fixup rule, so focus
  dropped to `<body>` after every keyboard-initiated send — the composer clears and
  the button goes not-ready in the same commit — silently stranding keyboard and
  screen-reader users mid-conversation. The resting empty-composer state now sets
  `aria-disabled` and stays a real, focusable tab stop; `handleClick` and the
  textarea's Enter guard do the actual blocking. **An explicit `disabled` prop is
  still honoured natively** (that is a consumer deliberately removing it from the
  tab order), so `Composer`'s `submitProps={{ disabled: true }}` is unchanged.
  Also adds four missing microcopy keys — `ai.messageForm.label`,
  `ai.messageTable.label`, `ai.voiceSelector.playPreview`,
  `ai.voiceSelector.pausePreview` — and the `check-microcopy.mjs` change that
  catches that class. **Migration:** a test asserting `toBeDisabled()` on the
  RESTING send button should assert `aria-disabled` + still-focusable instead.
- **New `brand-ui-migrate` skill + brownfield `scan`/`map` CLI (PR #377).** Merged
  from `agents/plugin-scan-migrate`. `brand-ui-start`'s router advertised an
  "improve an existing app" path that had no skill behind it; the skill now exists,
  and the CLI's `scan`/`map` commands emit real migration documents instead of
  placeholders. Adds the composed-surface preview rung of the visual loop. Also
  fixes a doubled documentation path (`reference/reference/visual-loop.md`) that
  the branch's stricter `check-plugin.mjs` surfaced.
- **CI: the Storybook story tests are non-blocking and time-boxed at 30 minutes.**
  The job hung for 1h40m during the v2.1.1 release with the entire blocking battery
  already green, holding a finished release hostage and starving later runs of
  runners. It still runs and still reports; `pnpm a11y:baseline:check` remains
  blocking, so the axe violation ceiling can still only ratchet down.

## v2.1.1 — 2026-08-02

- **Strict-CSP (Trusted Types) support: the Radix scrollbar `<style>` injection is gone (`@elabs-ai/components-tokens`, `patches/`).**
  `@radix-ui/react-scroll-area`'s `ScrollAreaViewport` and `@radix-ui/react-select`'s
  `SelectViewport` each rendered an unconditional
  `<style dangerouslySetInnerHTML>` carrying nothing but static scrollbar rules.
  Under `require-trusted-types-for 'script'` that `.innerHTML` assignment throws —
  and React performs it in `setInitialProperties` during COMMIT, so no error
  boundary catches it and React tears down the ROOT. The symptom is a **blank
  window**, not a broken component, and neither the unit suite (jsdom enforces no
  CSP) nor a screenshot can see it. This made `ScrollArea`, `Select`,
  `Suggestions`, `StreamingSuggestions`, `QueueList`, `Composer` and
  `PromptInputSelect*` unusable in a hardened renderer. Both packages are now
  patched to drop the injection and the rules ship as real CSS in
  `packages/tokens/src/radix-viewport.css` (already imported by
  `@elabs-ai/components-tokens/styles.css`) — nothing is required of a
  consumer. **A CONSUMER MUST APPLY THE TWO PATCHES THEMSELVES** — `pnpm patch` cannot travel in a published package, so your app still resolves Radix unpatched from npm; copy `patches/*.patch` (attached to the release) and add `pnpm.patchedDependencies` to your `package.json`, see `docs/CSP-AND-NETWORK.md`. New `pnpm csp-sinks:check` gate (self-tested, in CI) fails if either
  patch stops applying, if our source gains a NEW sink, or if a new direct
  dependency carries one; `scripts/csp-sinks-baseline.json` records the surfaces
  that legitimately still assign HTML (Mermaid, KaTeX math, schema-display,
  `@number-flow/react` behind `ChartStatFlow`/`Gauge`, streamdown, media-chrome)
  so a strict-CSP consumer knows exactly what to avoid. Documented in
  `docs/CSP-AND-NETWORK.md`. **Limit:** the gate scans direct dependencies, not a
  full transitive fixpoint.
- **New `ModelPicker` (`@elabs-ai/components-ui`).** A compact pill that
  opens a grouped, searchable target list anchored under itself — the inline
  sibling of `@elabs-ai/components-ai`'s modal `ModelSelector`, sized for
  a composer footer. `Command` inside a `Popover`, never a `DropdownMenu`
  (`DropdownMenuContent` owns roving tabindex and its own typeahead, which fight a
  real `<input>` in its subtree). Search matches caller-supplied `keywords` as well
  as the label, so a hidden id or workspace name finds a row whose visible label
  never says it. Groups and heading text are the caller's — never derived. Rows
  take an icon node (never a URL: a renderer with no remote origins cannot fetch a
  logo), an optional description, trailing `meta` badges supplied as an array
  rather than computed from a flag, and a trailing check on the pinned row. The
  pinned row is marked `data-picked` — **not** `data-selected`, which cmdk owns as
  the keyboard highlight. Four bodies, with the distinction between them
  load-bearing: skeletons while loading, an inline error strip ABOVE a list that
  still works when a refresh failed over stale data, a full retry panel when there
  is nothing to show, and `CommandEmpty` for no-match; the two decisions are
  exported as pure `modelPickerBody` / `showsInlineError` so they are testable
  rather than buried in JSX.
- **`Composer` forwards `submitProps` to the send button (`@elabs-ai/components-ai`).**
  `Composer` rendered `PromptInputSubmit` with `status`/`onStop`/`sendIcon`/`className`
  and no way to reach anything else, so a consumer could not disable the send — and
  disabling it is the only thing that prevents a real data-loss path. `PromptInput`'s
  submit handler calls `form.reset()` as soon as it ACCEPTS a submit, so an app that
  refuses the send inside its own `onSubmit` (async setup before the first message)
  has already had the textarea cleared and the user's text destroyed, with nothing to
  restore from. `submitProps` is `Omit<ComponentProps<typeof PromptInputSubmit>,
"status" | "onStop">` (Composer owns those two) spread onto the control, so
  `disabled`, `aria-label`, `variant` and `id` all become reachable; `className`
  merges with the built-in `rounded-full` rather than replacing it. It is left
  genuinely `undefined` when unset, because `PromptInputSubmit` resolves
  `disabled ?? autoDisabled` and a defaulted literal `false` would silently defeat the
  library's own empty-composer guard. Disabling closes the Enter route too —
  `PromptInputTextarea` checks `submitControl?.disabled` before `requestSubmit()`.
  New story `AI/Composer → RefusedSubmit`. Additive; no existing usage changes.

- **`MapCanvas` disables MapLibre's attribution control by default
  (`@elabs-ai/components-maps`).** Previously every map painted
  `© CARTO, © OpenStreetMap contributors` bottom-right — and because the control
  was `compact`, MapLibre rendered it **expanded** on first paint, so it read as a
  text slab rather than a toggle. `MapCanvas` now passes
  `attributionControl: false`. **Read the constraint before adopting this
  default:** it is a maintainer decision taken for internal testing and demos, not
  a licence finding. The default Carto basemap serves OpenStreetMap data, which is
  ODbL-licensed and requires the credit, and Carto's terms require it too — so a
  surface that ships PUBLICLY on these tiles must re-enable it with
  `attributionControl={{ compact: true }}` (it wins through the prop spread), or
  move to tiles licensed without the requirement via `styles` / `blank`. If it is
  re-enabled, `MapCanvas` now also collapses the compact control to its labelled ⓘ
  toggle on `load`, so it reads as a button instead of a slab. This differs from
  the React Flow badge below, which is an MIT project's _request_ and carries no
  such condition. Locked by two tests in `map-canvas.test.tsx`.
- **The React Flow attribution badge is hidden on both canvas surfaces
  (`@elabs-ai/components-flow`, `@elabs-ai/components-ai`).**
  `CanvasShell` passed `proOptions={{ hideAttribution: false }}` — explicitly ON —
  and `@elabs-ai/components-ai`'s `Canvas` passed no `proOptions` at
  all, so every canvas rendered the "React Flow" badge bottom-right. Both now pass
  `hideAttribution: true`. This is a **product/commercial decision, not a legal
  one**: `@xyflow/react` is MIT, which requires the copyright notice in source
  copies rather than a rendered badge, while xyflow separately asks that the badge
  only be hidden under a React Flow Pro subscription. A consumer who wants it back
  passes `proOptions={{ hideAttribution: false }}` — it still wins through
  `...props` on both surfaces. `.claude/rules/react-flow-components.md` previously
  instructed agents to _keep_ the badge visible, which is why it kept reappearing
  after removal; that rule is reversed and the behaviour is now locked by
  `canvas-shell.test.tsx` so a future agent reds the suite instead of flipping it
  back silently.
- **`Sources` renders the grounded-concept in `--success-text` (#382, `@elabs-ai/components-ai`).** Changed from `text-primary` to `text-success-text` so the "Used N sources" label clears WCAG AA (4.5:1) in all three themes and aligns with `InlineCitation`'s success-family styling, ensuring one semantic role for one visual idea.
- **`Toaster` merges a consumer's `className` and `toastOptions.classNames` with defaults instead of replacing them (#389, #362, `@elabs-ai/components-ui`).** Previously, passing `className` would replace the wrapper's `"toaster group"` classes, silently breaking the `group-[.toaster]:*` defaults that render the toast's card background, foreground color and elevation. Now `className` is merged via `cn()`, and each key in `toastOptions.classNames` is merged per-key so consumer overrides extend the defaults instead of wiping sibling keys. Documented in JSDoc: to override a built-in toast class, mirror the variant prefix (e.g. `group-[.toaster]:bg-blue-500`), because built-in classes are variant-scoped and out-specify bare utilities. The `theme` prop is a derived, non-configurable property set from `data-theme` to ensure toasts always track the app's active theme.
- **Fix: academic-layer citation/footnote/TOC links keep a resting underline (#317, `@elabs-ai/components-editor`).** `CiteLink`, the bibliography's external DOI/URL link, the footnote marker, and TOC entries in `@elabs-ai/components-editor/markdown`'s academic layer (`citations.tsx`, `footnotes.tsx`, `toc.tsx`) styled themselves color-only at rest (`no-underline` + `hover:underline`), which failed axe's `link-in-text-block` check in `dark` — a link inside a paragraph needs a non-color cue, not just hue. Now they carry a resting `underline`, matching the base `MarkdownPreview` `Link`'s convention. `light`'s separate `color-contrast` reading on `--primary`-as-inline-text (~4.3:1 vs the 4.5:1 AA floor) is a pre-existing, unrelated token-level fact and is NOT fixed by this change; it stays open as **#317**. Root cause and remedy (`--primary` has no `-text` rung, at 16 call sites across 6 packages) are now filed as **#399** — genuinely unowned today, and NOT resolved by the wave-3 token-contrast work (#321/#383/#385), which never touches `light`'s `--primary`.
- **`Slider`'s "multi-thumb support is tracked separately" doc comment now names the tracking issue (#353, `@elabs-ai/components-ui`).** No behavior change — `packages/ui/src/components/slider/slider.tsx`'s doc comment on `thumbProps` now points at #398, the new follow-up issue split out of #353's multi-thumb/range acceptance criterion (see #353 and #398 for the rationale). The single-thumb `aria-valuetext`/`thumbProps` half of #353 (the escape hatch, `PROTECTED_THUMB_KEYS` stripping) was already shipped; this unit adds `apps/e2e/tests/slider-aria-valuetext.spec.ts`, a real Chromium accessibility-tree assertion (CDP `Accessibility.getFullAXTree`) proving a screen reader's computed `valuetext` reflects the custom string, not a DOM-attribute snapshot.
- **`PageShell` gains a `headerVariant="toolbar"` prop (#367, `@elabs-ai/components-ui`).** Wraps
  `header` in a `sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur`
  container so a `<ViewToolbar>` (#331) placed in the header slot stays pinned while the page
  body scrolls beneath it — the caller PLACES a `<ViewToolbar>`, `PageShell` does not invent a
  second toolbar concept. `headerVariant` omitted (or `"default"`) is byte-identical to today;
  the wrapper never caps the row's height, so a `<ViewToolbar>` can still wrap onto a second
  line at narrow widths (R7).
- **`Alert` gains a rendered `success` story and `Toggle` a rendered `segmented`
  story (#388, `@elabs-ai/components-ui`).** Both variant values were only
  selectable in the Storybook controls panel (`argTypes.options`) and never
  actually rendered, so neither one ever reached the blocking interaction + axe
  job. New `pnpm variants:check` gate (`scripts/check-variant-coverage.mjs`,
  ratcheted via `scripts/variant-coverage-baseline.json`) now asserts every
  `cva` variant value reaches a rendered story repo-wide.
- **Four status-ink pairs now clear WCAG AA, and the whole foreground-on-fill class is gated (#321/#383, `@elabs-ai/components-tokens`).** `--<tone>-foreground` is only ever painted on `--<tone>`, so the pair is an invariant of the tokens — but no gate asserted it, because a blanket row would have failed the one brand pair #180 blesses. `themes-contrast.test.ts` now runs an `INK_TONES` row over all six tones in every theme with a single `INK_EXEMPT` entry keyed by `(theme, tone)` — `light/--primary` — plus a change-detector pinning that pair to the literal #180 accepted, so the exemption cannot outlive its justification. Keying by `(theme, tone)` rather than by tone matters: a role-keyed list would have re-frozen `--success`, which #334 already moved off the brand green to a passing 5.46:1. The row reds on exactly four pairs, all fixed here by flipping the INK (never the fill — a fill is also a bare graphical mark with its own ≥3:1 1.4.11 rung from #381, whereas `-foreground` has zero consumers outside its plate): **`dark --destructive-foreground` 3.02 → 5.50** (now the theme's own warm-dark ink, which its primary/success/info already used — destructive was the last holdout on light's near-white), **`light --info-foreground` 3.74 → 4.80**, **`:root --success-foreground` 3.55 → 5.02** and **`:root --info-foreground` 3.67 → 4.90** (the last two were recorded in no issue at all). `ConfirmDialog`'s dark story swept the neutral tone as a workaround for the destructive defect; it now sweeps `destructive` for real.

- **Role distinctness is enforced: `pnpm roles:check` (#385, `@elabs-ai/components-tokens`).** Parity proves a token is present and the contrast gate proves it clears a ratio against a surface; neither can see two independent roles collapsing onto one colour — which is how `:root` shipped `--primary` ≡ `--ring` ≡ `--sidebar-primary` ≡ `--sidebar-ring` ≡ `--chart-1`, one literal for five roles. New self-tested `scripts/check-role-distinctness.mjs` (wired into `gates.yml` + the release-gates baseline) asserts a `MUST_DIFFER` pair list per theme at the same 0.05 OKLab ΔE floor `ROLE_PAIRS` uses, so a cosmetic 0.001 nudge cannot satisfy it, and resolves `var()` before comparing so an alias cannot launder a collision either. Token changes: `:root --ring` `oklch(0.55 0.18 264)` → **`oklch(0.45 0.21 264)`** (deeper + more saturated, the move light already made for its own ring; ΔE 0.104 from `--primary`, 7.42:1 on `--background`) and `:root --chart-1` → **`oklch(0.62 0.17 264)`** (a lighter, chart-tuned cousin of the accent instead of a copy of it — as a duplicate it was also the darkest member of its own ramp at 5.02:1 vs `--card` against 2.87–4.37 for the rest; now 3.73:1, evening the ramp). Intentional mirrors are now DECLARED rather than copy-pasted: `--sidebar-primary: var(--primary)`, `--sidebar-ring: var(--ring)`, `--sidebar-accent-foreground: var(--accent-foreground)` in all four blocks — a zero-visual-change refactor that makes drift impossible. blueprint carries three documented exemptions (it is monochrome by contract and its chart ramp is pinned by `charts-contrast.test.ts`); `(--primary, --chart-1)` is deliberately NOT in `MUST_DIFFER` — series 1 as a cousin of the brand hue is a convention, not a collision.
- **Blueprint gets a non-colour status channel + `CTASection`'s subtitle is legible again (#391, #393, `@elabs-ai/components-tokens`/`@elabs-ai/components-marketing`).** `CTASection`'s description `<p>` no longer hardcodes `text-primary-foreground/80` — it inherits `color` from the `.bg-primary` section root exactly like the heading, fixing a 1.20:1 (essentially invisible) contrast under `blueprint` and an 8.24:1 pairing in `dark`. The light residual (4.31:1 measured / 4.3:1 axe, on `text-base`/400 body copy) is **unresolved** — it is covered by the pre-existing `(light, --primary)` brand exemption (#180/#383), but that exemption was reasoned for large/bold text and was never separately adjudicated for small body copy, so it does not on its own close this case; the underlying gap (`--primary` has no on-surface `-text` rung) is tracked in #399. Separately, `packages/tokens/src/decoration.css` gains a `[data-status]`-keyed line-type channel (`pending` dotted · `running` dashed · `complete` solid · `awaiting-approval` solid+2px · `failed` double+3px · `denied`/`skipped` share dotted-no-hatch) so the seven canonical statuses stay distinguishable in `blueprint`/high decoration even though the six role fills (`bg-primary`/`secondary`/`destructive`/`success`/`warning`/`info`) deliberately collapse to one drawn appearance there, and the sanctioned `bg-<status>/10` wash only separates by lightness (ΔE ≈0.012, not perceptible). Zero component changes — `StatusBadge`/`StatusIcon`/`Timeline` already emit `data-status`. New `pnpm decoration-collapse:check` gate (self-tested) fails if a role-fill collapse ever ships again with no compensating `[data-status]` channel in the same scope.
- **Density type-scale ratchet: sidebar-04 block + chart axis/legend labels now scale with `data-density` (#397, #394, `@elabs-ai/components-ui`, `@elabs-ai/components-charts`).** `packages/ui/src/blocks/sidebar-04/app-sidebar.tsx`'s 8 raw font-size utilities (3× `text-sm`, 4× `text-xs`, 1× `text-base`) now read the `text-body`/`text-meta`/`text-subtitle` roles, closing the worst-measured real screen for #340's density dial (`layout-app-shell-mail--default`). `@elabs-ai/components-charts`'s 8 HTML-rendered axis-tick/legend-percentage/auto-legend labels (`x-axis`, `y-axis`, `bar-x-axis`, `bar-y-axis`, `live-x-axis`, `live-y-axis`, `chart-legend`, `auto-chart`) move from raw `text-xs` to `text-meta`, matching `Gantt`'s already-density-aware timescale tick (11.25px compact / 12px comfortable). `text-sm`→`text-body` and `text-base`→`text-subtitle` are documented visual no-ops; `text-xs`→`text-meta` also adopts `font-weight: 500` + `letter-spacing: 0.01em` — verified across all three themes via `test-storybook`. 6 SVG-numeric chart sites (`radar-labels`, `radar-grid`, `live-line`, `marker-group`, `sankey-node`) are consciously scoped OUT — see `.claude/rules/chart-components.md` § SVG-rendered type. `scripts/text-scale-baseline.json` ratcheted 309→293 raw uses.

- **`FlowNode` tone and `Timeline` status gain non-colour cues + AT exposure (#387, WCAG 1.4.1, `@elabs-ai/components-flow` + `@elabs-ai/components-ui`).** Both previously encoded state in colour alone — `FlowNode`'s `tone` was a bare 1px border with no DOM attribute, icon or accessible name at all; `Timeline`'s `NODE_STYLE` gave `denied`/`skipped` byte-identical classes and left `complete`/`awaiting-approval`/`failed` distinguishable only by hue. `FlowNode` now sets `data-tone` on its root and, for every non-`default` tone, a decorative Lucide glyph (new export `STATUS_TONE_ICONS` from `@elabs-ai/components-ui` reuses the same icon `StatusBadge` already pairs with `success`/`warning`/`destructive`) plus an `sr-only` name. `Timeline`'s `NODE_STYLE` now gives `denied`/`skipped` distinct `border-dashed`/`border-dotted` rings (their fill genuinely differs from their border, so the pattern paints), and gives `running`/`complete`/`awaiting-approval`/`failed` four distinct `ring-*` WIDTHS (0/1/2/4 — a rendered check found `border-style` invisible on that quartet, since their border and fill share one token); every rail item also prefixes its title with an `sr-only` status name. New rule: `.claude/rules/accessibility.md` § "Colour is never the only channel."
- **`Timeline`'s `running` rail node retints from `--primary` to `--info` to match `StatusBadge` (#392, `@elabs-ai/components-ui`).** `NODE_STYLE` (the rail dot's colour map) was an untested duplicate of the canonical status→role mapping `StatusBadge` owns, and had drifted: a running `AgentStep` rendered its rail dot green (`--primary`) and its badge blue (`--info`) on the same line. The dot now renders `--info` (halo kept, retinted to `ring-info/25`) — a **rendered colour change**: every running/`active` rail node goes green → blue in every theme, including the editor's `:::timeline` `active` marker. New export `STATUS_ROLE` (`@elabs-ai/components-ui`) names the single source of truth for status colour; `timeline.test.tsx` now locks the four chromatic statuses (`running`/`complete`/`awaiting-approval`/`failed`) against it so the two maps can't silently diverge again.
- **Governance: three gate fixes, for issues #380/#379/#396 (`scripts/*.mjs`,
  `.github/workflows/gates.yml`, `.githooks/pre-commit`).** `changelog-entry:check`
  no longer false-negatives on a `## Unreleased` entry more than a few lines below
  the heading (#380 — the exact bug this bullet would have tripped had it landed
  anywhere but here); a new `pnpm conflict-markers:check` gate blocks a commit or
  CI run that contains a literal, unresolved Git conflict marker (#379 Part B); and
  `.githooks/pre-commit` now chains the manifest write to its 5 downstream
  generators (`inventory`/`llms`/`context`/`gen`) instead of the manifest alone, so
  adding a component/export no longer leaves `component-inventory.md`/`llms.txt`/
  `brand-ui-context.md`/the `pnpm gen`-owned doc regions/package READMEs stale
  (#396). No shipped component API changed.
- **`test-storybook` is green again, and three real a11y defects are fixed (#386, `@elabs-ai/components-ai`, `@elabs-ai/components-data`, `@elabs-ai/components-ui`, `@elabs-ai/components-editor`).** The repo's only real-browser interaction + axe surface was red on `main` (6 files / 14 tests, none baseline-exempt). Fixed in product/story, never by exempting: (1) `MessageAvatar role="agent"` now carries `role="img"` beside its `aria-label` — Radix's `Avatar.Root` renders a `<span>` whose implicit role is `generic`, and ARIA prohibits `aria-label` there, so the name was invalid AND never announced (axe `aria-prohibited-attr`); the user branch is unchanged. (2) `WebPreviewNavigationButton` takes its accessible name from `tooltip` — a Radix tooltip only contributes `aria-describedby` while OPEN, so these icon-only controls had no name at rest (axe `button-name`); an explicit `aria-label` still wins. (3) `buildInteractiveTerminalTheme` clamps every ANSI ink to WCAG AA against the terminal's own background — the mapping reaches for mark/fill-rung tokens (`--chart-2`/`--chart-4`/`--border-strong`, and `--success`/`--info`/… for the `bright*` siblings) which are only guaranteed ≥3:1, so EVERY palette shipped sub-AA ANSI slots — measured from `themes.css`: `:root` 7 (worst 2.39:1), `light` 4 (worst 2.91:1), `dark` 1 (3.16:1), `blueprint` 1 (4.32:1). The 7 axe `color-contrast` violations that red-ed the story test are the `:root` set, because that is the palette the story test resolves. `bright*` variants are now derived by pushing AWAY from the background instead of always lightening, which on a light theme had been making them the least legible colour on screen. Also: `Patterns/Templates/Data App` no longer nests a second `<main>` inside `SidebarInset`'s, and the `DropdownMenu`/`MarkdownEditor` menu stories now dismiss their modal menu before returning (an open Radix menu marks the rest of the document `aria-hidden`, which both fails `aria-hidden-focus` and leaks into the next story's role queries).

- **Merge discipline has teeth instead of a red X (#386, #379).** Branch protection is unavailable on this repo's plan (re-verified: `branches/main/protection` and `rulesets` both 403), so `pnpm merge:check` (`scripts/check-merge-readiness.mjs`, self-tested) refuses while any blocking check is failing **or has not reported yet**, and `.claude/hooks/gate-pr-merge-readiness.sh` blocks `gh pr merge` outright unless it passes — the exact hole PR #375 went through. Override: `ALLOW_UNVERIFIED_MERGE=1`.
- **`Gantt` renders sub-day and sub-second timelines (#360, `@elabs-ai/components-charts`).** A 12-second agent run (tool calls, model turns, streaming) and a two-year programme plan are now the same component. New exported type `GanttTimeUnit` — a **superset** of `GanttViewMode` adding `hour`/`minute`/`second`/`millisecond` — widens every tick-granularity input (`viewMode`, `defaultViewMode`, `GanttScale.unit`); new props `viewModes` (which units the toolbar offers), `zoomBounds` (override the zoom clamp) and `defaultViewMode="auto"` (derive the finest readable unit from the data's own span); new exports `GANTT_UNIT_MS`, `pickGanttTimeUnit`, `computeGanttZoomBounds`, `GANTT_NOMINAL_VIEWPORT_PX`. Zoom bounds are now derived from the actual data span instead of the hardcoded `[2, 200]` px/day pair (they can only ever WIDEN it, so every shipped preset is unaffected), `computeDomain`'s one-day pad floor now applies only at or above day scale, so a sub-day domain is no longer padded by a whole day (which collapsed a 12-second timeline to ~0.04 px bars) and padding is proportionally consistent across scales — byte-identical to v1 for any span of a day or more, and for a zero-length span, and `generateTicks` strides so a millisecond unit over a long domain can't hang the tab. `GanttViewMode` is **unchanged** and `pixelsPerDay`/`defaultPixelsPerDay`/`onPixelsPerDayChange` keep their exact meaning — _pixels per 86 400 000 ms, at every granularity_ — and are still passed through **unclamped**, exactly as before: the span-derived clamp applies only to the view-mode preset the component derives for itself (which by construction contains all four calendar presets), never to a value you supply. **Changed / migration:** (1) `onViewModeChange`'s parameter widened from `GanttViewMode` to `GanttTimeUnit`; under `strictFunctionTypes` a handler _explicitly_ annotated `(mode: GanttViewMode) => void` no longer assigns — annotate it `GanttTimeUnit`, or drop the annotation (the inferred `onViewModeChange={(mode) => …}` is unaffected). (2) Ctrl/⌘-wheel zoom is no longer capped at 2–200 px/day but at the span-derived range — that IS the new capability, and the range only ever _widens_, so nothing previously reachable is lost; pass `zoomBounds` to pin it. (3) A single timescale row now strides once it would exceed 5 000 ticks — unreachable below roughly 13.7 years of daily ticks. No static render of any existing configuration changes: verified by a browser A/B against the previous release across `pixelsPerDay` 0.5 / 2 / 48 / 201 / 400 / 500 and 15 shipped stories, comparing canvas width, every tick label, every bar rect and decoded painted pixels. New stories `Charts/Gantt → Agent run trace` and `→ Millisecond trace`.
- **New `MentionInput` — an `@`-mention text field (#368, ADR 0023, `@elabs-ai/components-ui`).** No package shipped a mention-capable input, so downstream teams re-solved caret arithmetic, chip atomicity and `aria-activedescendant` wiring by hand or reached for a `contentEditable` escape hatch. `MentionInput` is a compound component (`MentionInputTextarea` / `MentionInputContent` / `MentionInputList` / `MentionInputItem` / `MentionInputEmpty` + `useMentionInput`) over a **real `<textarea>`**, so IME, paste, native undo, spellcheck, mobile keyboards and `FormData` all keep working. It brings its own listbox rather than cmdk, so **focus never leaves the field** — arrow keys move `aria-activedescendant`, Enter/Tab insert, Escape closes without clearing the text — and an inserted mention behaves as one atomic unit (a single Backspace beside it removes the whole `@Name`; the arrow keys step over it, not into it). The value is `{ text, mentions }`; the pure, React-free `mention-value` algebra (`insertMention` / `remapMentions` / `mentionAt` / `mentionEnd` / `serializeMentions` / `defaultMentionFilter`) is exported alongside it, and `serializeMentions()` returns `{ text, mentionedIds }` with ids deduped in document order. Composes into `@elabs-ai/components-ai`'s composer with no `ai` change at all — `<MentionInputTextarea asChild><PromptInputTextarea name="message" /></MentionInputTextarea>`. The interception is bound as `onKeyDownCapture` because Radix `Slot` runs a child's handler before a slot's, so a bubble-phase handler would lose to an `asChild` child that binds `onKeyDown` **directly on a host element** (the `PromptInputTextarea` composition itself is unaffected either way — it destructures `onKeyDown` and bails on `defaultPrevented` — so the capture binding is what makes the raw-host case correct, and it is locked by its own unit test rather than by the composer story). Consumer props compose rather than clobber: the seven handlers the field owns are destructured out before `...props` is spread, so passing your own `onChange` no longer knocks out the component's value tracking, while `id`/`name`/`aria-*`/`placeholder` still win. Mentions are painted by an `aria-hidden` mirror layer over the field whose glyph metrics are re-snapshotted on theme/density/font-load changes (backgrounds only — no per-run text colour is possible behind a real textarea). ARIA note: the field stays a spec-valid `textbox` carrying `aria-autocomplete` / `aria-haspopup` / `aria-controls` / `aria-activedescendant` — **not** `role="combobox"` + `aria-expanded`, which `<textarea>` does not permit and axe rejects (`aria-allowed-role`; `aria-allowed-attr` is critical) — so the highlighted option is still announced while the open state is exposed as `data-state`. Additive: one new microcopy key (`ui.mentionInput.listLabel`); the empty state reuses the generic `noResults`.

- **`Dialog` gains a size/scroll/section/dirty-state contract (#341, `@elabs-ai/components-ui`).** New `DialogBody` (the scroll owner — with one present the header and footer stay fixed and only the body scrolls, via a `has-[[data-slot=dialog-body]]:` grid variant that is inert without it; it takes a `tabIndex={0}` so a keyboard user can scroll a body of static text, and `DialogContent` steps the OPENING focus past the wrapper to the first control that can actually take focus INSIDE the body, so the scroll region is not ringed on open — both behaviours gated on a `DialogBody` being present, and both falling back to Radix when the body holds nothing focusable), `DialogSection` (a real heading rung between `DialogTitle` and field labels), `ConfirmDialog` (an `AlertDialog` preset that always renders a Cancel, so Radix's open-autofocus lands on the safe action), `useDialogDismissGuard` (warn before discarding unsaved changes; the app still owns `open` and `dirty`) and `AdvancedGroup` (collapsed-by-default disclosure that summarises its non-default values). Additive — no existing prop removed or renamed. ONE visible change: `dialogContentVariants`' base gained `max-h-[calc(100dvh-2rem)] overflow-y-auto`, so a dialog taller than the viewport now scrolls internally instead of overflowing past both edges with its top unreachable; `size="full"` and any caller `max-h`/`overflow` still win through `cn()`. Decision record: `docs/ADR/0021-dialog-tier-model.md` (why there is no `tier` prop and no `WideDialog`/`FormDialog`/`WorkbenchDialog`). Every `dialog.tsx` part also now carries a `data-slot`.

- **`PromptInputSubmit` flips back to Send once the user types during a running turn
  (#351, ADR 0022, `@elabs-ai/components-ai`).** Previously the control stayed the Stop
  affordance for the entire duration of a turn, and Enter was blocked outright while
  generating — so a user with a genuine follow-up had no way to submit it at all. Now:
  running + composer EMPTY still shows Stop (unchanged); running + composer NON-EMPTY shows
  Send and submits normally, exactly like the resting state (the app's own `onSubmit`
  decides what a mid-turn submit means — brand-ui asserts nothing about queueing). New
  additive `sendIcon` prop (the Send-only glyph, survives the flip; `children` is now
  `@deprecated` in favour of it) and a new `PromptInputStop` part for the composed
  "separate two buttons" arrangement (mounting one keeps `PromptInputSubmit` permanently
  Send). `Composer` adopts `sendIcon` so its circular arrow no longer disappears mid-turn.
  Migration: an app relying on `[data-generating="true"]` to mean "the turn is running"
  should read the app's own `status`, or `[data-action="stop"]` if it specifically means
  "this control stops"; an app that cannot accept a mid-turn submit passes `disabled` to
  `PromptInputSubmit` (unchanged, already honoured).
- **`Command` gains an `onActiveItemIdChange` callback and a `useCommandActiveItemId` hook
  (#365, `@elabs-ai/components-ui`).** `cmdk` assigns each item's `id`/`role`/`aria-selected`
  internally and applies them after any consumer spread, so a consumer-supplied `id` on
  `CommandItem` (including `PromptInputCommandItem`) was silently dropped — the only way to
  wire `aria-activedescendant` from an input rendered outside the `Command` tree (a
  composer textarea driving an `@`-mention popup) was a fragile positional DOM query.
  `onActiveItemIdChange` reports the DOM id cmdk assigned to the currently-highlighted item;
  `CommandItem` also warns once (dev-only) when a consumer passes `id`/`role`/`aria-selected`,
  naming the supported path. It reports for EVERY highlight change, including the item cmdk
  auto-highlights on mount and the one it re-highlights after each filter keystroke — cmdk's
  own `state.selectedItemId` misses both (it is recomputed from a callback that runs before
  React commits `aria-selected`, so cmdk's own `Command.Input` renders no
  `aria-activedescendant` in either state), so `Command` resolves the id from the committed
  DOM instead. Purely additive; no change to cmdk's own selection/filtering.

- **`DataTable` gains column pinning (#333, `@elabs-ai/components-data`).**
  New `columnPinning` / `onColumnPinningChange` props freeze columns against the
  left and/or right edge while the rest of the table scrolls horizontally — the
  same controlled/uncontrolled slice shape as `sorting` / `columnVisibility` /
  `columnFilters` / `pagination`, seedable via `initialView.columnPinning`, and
  carried in `DataTableViewState` as a new OPTIONAL key. `ColumnPinningState` is
  re-exported from the package. A pinned cell paints an opaque base and
  re-applies the row's zebra / hover / selected wash as a second layer, so the
  stripe reads THROUGH the frozen column instead of being overpainted (the
  reported "floating pill" seam); the pinned/scrolling seam is a 1px
  `border-strong` rule drawn inside the sticky cell (a real `border` cannot be
  used — the collapsed border model paints it at the cell's static position, so
  it vanished as soon as the table scrolled), never a shadow. The pinned header
  corner composites to the same tone as the header row it sits in, and the
  scroll region carries `scroll-padding` equal to the frozen widths so keyboard
  focus can't be parked behind a frozen column (WCAG 2.2 SC 2.4.11). Every
  pinned column must declare an explicit `size` (a dev-only warning names any
  that don't). Additive: with no pinning the rendered DOM is unchanged.
- **`FacetFilter`'s trigger now takes `Button`'s default height (`h-9`), not the
  `sm` rung (`h-8`) (#346, `@elabs-ai/components-data`).** A facet
  filter lives in a toolbar beside `Select` / `Input` / `DatePicker`, all of which
  land on `h-9`, so the `sm` trigger was the row's lone short control and its top
  and bottom edges didn't line up. Visible change: the trigger is 4px taller with
  slightly wider padding and body-size (rather than `xs`) text. The new
  `Data/FacetFilter` → `ToolbarAlignment` story MEASURES all five controls'
  rendered boxes in a browser and asserts one height and one top edge. No shared
  `--control-h` token was introduced — that remains a separate cross-package
  decision.

- **`KeyValueEditor` — key/value rows with per-row secret masking (#370,
  `@elabs-ai/components-ui`).** New form-kit primitive: an ordered
  `{ key, value, secret? }[]` row editor (ordered over `Record<string,string>`
  so in-progress duplicate keys and row order survive mid-edit). A `secret`
  row renders `type="password"` with a per-row reveal toggle whose
  `aria-label` never carries the raw value.
- **`ListEditor` — one `Input` per row editing a `string[]` (#371,
  `@elabs-ai/components-ui`).** New form-kit primitive: add / remove
  / reorder rows. Reordering uses keyboard-operable move-up/move-down
  buttons (no drag-and-drop dependency exists in the monorepo, and none
  was added for this).
- **`SliderNumber` — a `Slider` and `NumberInput` bound in lockstep, plus an
  explicit `null` "provider default" (#372, `@elabs-ai/components-ui`).**
  Both the drag and type paths round through the SAME function before
  committing, so dragging to a value and then typing it never disagrees
  (fixes the floating-point-drift failure mode, e.g. `0.30000000000000004`).
  That includes the case where normalising the typed value lands back on the
  value already held — the number input is re-derived from the accepted value
  rather than left showing the raw keystrokes beside a differing slider.
  `null` renders the slider thumb dimmed/dashed and is reachable via a
  Reset control.
- **`BoundedNumber` — a `NumberInput` preset where empty reads as "No limit"
  (#373, `@elabs-ai/components-ui`).** A thin wrapper, not a parallel
  implementation: `NumberInput` already clamps on blur (not per keystroke)
  and already treats `null` as a real empty state — the only missing piece
  was rendering that empty state as a meaningful label instead of a blank
  box, added here as a `pointer-events-none` overlay shown only while empty
  and unfocused.
- **`SegmentedField` — a labelled segmented control with sticky selection
  (#374, `@elabs-ai/components-ui`).** Composes `Label` +
  `ToggleGroup`/`ToggleGroupItem` (`variant="segmented"` — no new visual
  style). Radix's `type="single"` `ToggleGroup` emits `""` when the active
  segment is re-clicked; `SegmentedField` swallows that emission so
  re-clicking is a true no-op instead of clearing the field. Per the
  WAI-ARIA radiogroup pattern each segment renders `role="radio"`, so
  arrow-key navigation also selects the newly focused segment (selection
  follows focus), matching native radio-button behavior. Selection follows
  focus for arrow/Home/End keys **only** — clicking the `<Label>`, tabbing
  into a not-yet-selected field, or a consumer's programmatic `.focus()`
  moves focus without mutating the value.

- **New `IconButton` in `@elabs-ai/components-ui` (#335).** A single affordance for
  icon-only controls: `label` becomes both the `aria-label` and the tooltip
  text (so they can never drift), `disabledReason` surfaces via
  `aria-describedby` on an `sr-only` node that does not depend on the tooltip
  being open — so it reaches AT even while the button is
  `pointer-events-none` disabled — and the tooltip trigger wraps a
  focusable `<span>` so it still opens for a disabled control. Composes
  `Button` + `Tooltip`; deliberately no `asChild`.
- **New `FieldRow` in `@elabs-ai/components-ui` (#354).** Label/description/error/
  `aria-describedby` wiring for a field OUTSIDE a `react-hook-form` context —
  the same anatomy as `Form`'s `FormItem`/`FormLabel`/`FormControl`/
  `FormDescription`/`FormMessage`, driven by plain `label`/`description`/
  `error` props instead of RHF field state. Purely additive; the existing
  `Form*` family is unchanged.
- **`Combobox` gains `allowCustomValue` (#359, `@elabs-ai/components-ui`).** When set,
  typed text that doesn't match any option is offered as a submittable
  "Use…" suggestion (still filtered live) and accepted via `onValueChange`
  on Enter or click. The suggestion is always ranked **last**, so the top
  real match stays highlighted and Enter still selects it — reach the custom
  value with ArrowDown, or directly when nothing else matches. The default
  (unset) selection-only behavior is unchanged.

- **`ThemeSwitcher` gains a controlled `preference`/`onPreferenceChange` mode
  (#366) and now narrows to a `ThemeProvider`'s `allowedThemes` subset instead
  of offering a disallowed theme whose click was a silent no-op (#384,
  `@elabs-ai/components-ui`).** Both additive; an unset `preference` and a
  non-restricting provider (the default) render exactly today's behavior.
- Docs: dropped stale `ThemeSwitcher` subset limitation notes from JSDoc and theming rule (#384 already shipped).
- **`Tree.TreeNode` gains an `accessory?: ReactNode` trailing slot** for
  per-node content (e.g. a size/token-count badge) rendered as a sibling of
  the label — never part of the row's accessible name, never triggers
  select/expand — in BOTH the virtual and non-virtual render paths (#369,
  `@elabs-ai/components-ui`). A `ReactNode` `label` now names its row
  via `aria-labelledby` (pointing at the label span) instead of falling back to
  the row's contents, and the accessory stops click/keydown/focus, so
  interactive accessory content is focusable and activates itself rather than
  selecting the row.
- **`StatusBadge.status` widens to `Status | CustomStatus`** so a domain with a
  state the closed 7-value enum doesn't express can pass a bounded
  `{label, tone, icon?}` object instead of dropping to a raw `Badge` (#363,
  `@elabs-ai/components-ui`). `tone` is CALM-only and reachable only
  through the object form — a canonical status can never be recolored. Fully
  additive; all 7 canonical values render unchanged (regression-locked).
- **`ViewToolbar` — a named grammar for the status/filters/actions row every view
  needs (#331, `@elabs-ai/components-ui`).** New, additive: `ViewToolbar`
  (row shell with an `info` ⓘ tooltip slot, a left cluster and an `actions`
  cluster), `ViewToolbarFilters` (the one home for active-filter chips + an
  optional `onClearAll`), `FilterChip` (the one removable chip — label-in-value,
  the whole chip is the remove button, so it is one tab stop with a ≥24px target
  and Enter/Space for free) and `ResultCount` (the one count — `tabular-nums`,
  locale-formatted, "N of M" when a filter is active, a placeholder while
  `loading`). Written contract: the new Storybook page
  `Docs/View Toolbar Contract`, which states the row's grammar as rules — the
  failure this closes was ambiguity, not capability. Adds five `t()` keys under
  `ui.viewToolbar.*`. No existing component changed. The `actions` cluster wraps
  instead of holding `shrink-0`, so it can never escape the row's box at phone
  widths (it overflowed by ~8px at 320px), and the `Patterns/Templates/Enterprise
Admin Console` scenario now uses the row in place of its hand-rolled
  "{n} total" header — a real screen, not only the component's own stories.
  Known limitation, documented in the contract page: the ⓘ `info` tooltip does
  not open on tap, so it is pointer/keyboard progressive enhancement only.
- **The `@elabs-ai/components-charts/test` double covers the drill-down
  parts and stops over-validating a non-temporal x (#364 ⨯ #349 ⨯ #352).** These
  three landed on separate branches and only conflict once merged, so the fix
  belongs to neither: `ChartDatapointLayer` / `ChartDatapointProvider` (#349) are
  new barrel components with no stand-in, which is the "No X export is defined on
  the mock" import crash the double exists to prevent; and the x-value contract
  demanded a parseable `Date` on `LineChart`/`AreaChart`/`ComposedChart`
  unconditionally, so a consumer using the now-legal `xScale="band"|"linear"`
  (#352) got a `ChartContractError` from the double for data the real chart
  renders fine. `requireDate` is now waived on a non-time scale — the double must
  never be stricter than the component it stands in for.
- **New `@elabs-ai/components-charts/test` subpath — the official jsdom-safe test double
  (issue #364).** `@visx/*`-backed charts don't render meaningfully under jsdom, so
  consumers were mocking the whole `@elabs-ai/components-charts` barrel as a no-op — hiding
  real chart-prop bugs (a fully green suite shipped a `RangeError: Invalid time
value` crash) from the quality gate. `vi.mock("@elabs-ai/components-charts", () =>
import("@elabs-ai/components-charts/test"))` swaps in contract-validated doubles for
  every top-level chart container (`AreaChart` … `SankeyChart`, `Gantt`,
  `AutoChart`) plus `MetricCard`/`MetricGrid`/`ChartCard`/`ChartFrame`/
  `Sparkline` (re-exported verbatim, already visx-free) — each THROWS a
  `ChartContractError` on a missing/invalid required prop or an unparsable
  date x-value, so a mocked test fails exactly where the real chart would.
  Every composition primitive and provider (`Line`, `Area`, `Grid`, `XAxis`,
  legend/tooltip/pattern parts, `ChartProvider`, …) ships as an inert stand-in
  so the mocked module namespace is complete — `vi.mock`'s factory proxy throws
  on any omitted export the moment your module reads it, so without them
  `<LineChart><Line dataKey="revenue" /></LineChart>` fails on import. Barrel
  constants, hooks and utility functions stay out (they live in `@visx`-backed
  modules or can't be faked); compose `importOriginal()` with the subpath when a
  test needs one.
  New `pnpm charts:test-double:check` gate (self-tested) guards component
  parity, engine isolation and the `exports`/`publishConfig.exports`/
  `tsup.config.ts` wiring against drift. See `.claude/rules/chart-components.md`
  § "Test double" and the "Testing Charts in jsdom" Storybook doc page.
- **Charts are drillable: `onDatapointClick` on every family, keyboard included (#349,
  `@elabs-ai/components-charts`).** Bar / line / area / composed / pie / ring / funnel gain
  `onDatapointClick`, `datapointLabel` and `maxInteractiveDatapoints`; `ChartLegend` gains
  `onItemClick` (which makes each entry a real `<button>`). One payload shape across every
  family — `{ datum, index, seriesKey?, seriesLabel?, value, category, source }` — so one
  drill-down handler works everywhere. The keyboard path is a new `ChartDatapointLayer`: real
  `<button>`s in a `pointer-events:none` layer OUTSIDE the `aria-hidden` chart SVG (a focusable
  inside it is an axe `aria-hidden-focus` failure), with roving tabindex so the whole chart is
  ONE tab stop, arrow keys to traverse and ≥24×24 hit boxes (WCAG 2.5.8). Fully additive: with
  `onDatapointClick` unset the DOM is unchanged and no new focusables appear.
- **`LineChart` / `AreaChart` / `ComposedChart` gain `xScale="time" | "band" | "linear"` (#352,
  `@elabs-ai/components-charts`).** An ordered non-temporal x dimension (turn number, step index,
  run sequence) is now a first-class axis instead of a crash: `xScale="band"` spaces categories
  evenly in first-seen order, `xScale="linear"` spaces numbers by magnitude, and in both modes the
  axis ticks, the ticker and the tooltip title show the caller's OWN x value — no more fabricating
  synthetic `Date`s and hiding the real label in the tooltip. Omitting the prop is unchanged for
  Date data; a dataset whose x values are ALL non-Date-coercible now degrades to the ordinal axis
  (plus a once-per-mount dev warning naming the explicit fix) instead of rendering `ChartFallback`.
  `ChartFallback` is now reserved for genuinely unplottable x values (all null/undefined/empty).
  `XAxis`'s `Date`-shaped `tickFormat` / `tickValues` are inert (with a dev warning) on a
  `band`/`linear` axis — honouring them printed the synthetic instant as the tick label.

### Changed

- **⚠️ BEHAVIOUR CHANGE — the density dial now scales TYPE as well as spacing
  (#340, `@elabs-ai/components-tokens`). Every screen already using
  `data-density="compact"` will render smaller text.** `[data-density]` used to
  tighten padding/height/gap only, so a compact table read as tight rows around
  unchanged text; consumers were re-declaring the whole role scale in their own
  stylesheets to make a surface scale as one. A single new knob —
  `--type-factor` in `density.css` — now multiplies every semantic type role's
  **size and line-height**: **compact `0.9375` (15/16, −6.25%) · comfortable `1`
  · spacious `1.0625` (17/16, +6.25%)`**. Font-weight and letter-spacing are NOT
  rescaled (weight is a semantic rung; tracking is authored in `em`, so it
  follows the size on its own).
  - **Type deliberately moves at ~half spacing's rate** (±6.25% against
    spacing's ~11–12%) and is capped by a **legibility floor**: body never
    renders below 13px (compact body = 13.125px at a 16px root), and no role
    below 11px (`meta`, the smallest rung, lands at 11.25px).
  - **`comfortable` — and no `data-density` attribute at all — is the EXACT
    prior scale**, verified by measuring computed `font-size`/`line-height` for
    all eight roles in a real browser before and after. `ThemeProvider` still
    omits the attribute for `comfortable`, so an app that never opts into a
    density is untouched. **Only surfaces that explicitly set `compact` or
    `spacious` change.** To keep the old behaviour on such a surface, stop
    setting `data-density` on it (or set `comfortable`) and tighten spacing
    locally instead.
  - **The dial reaches ROLE-TYPED TEXT ONLY — a known, still-large gap.**
    `--type-factor` rewrites the `--text-<role>` keys; a raw `text-sm`/`text-xs`
    reads Tailwind's own `--text-sm`/`--text-xs` and does not move. Density
    coverage on a given screen therefore equals that screen's role adoption.
    `Sidebar`, `Button`, `Badge`, `Table` and `DataTable` were migrated to roles
    as part of this change (a size/leading no-op — see below), which took the
    measured coverage on real screens (elements whose computed `font-size`
    changes between comfortable and compact, story root, 1440×900) from
    `data-datatable--with-toolbar` **0/11 → 10/11**,
    `patterns-templates-data-app--default` **1/31 → 27/31**,
    `patterns-templates-enterprise-admin-console--default` **33/52 → 47/52**,
    `layout-app-shell-mail--default` **1/49 → 10/49**. It is **not** closed:
    `pnpm text-scale:check` still counts **309 raw font-size uses across 111
    files** (112 `@elabs-ai/components-ui` — mostly the
    `src/blocks/**` copy-own blocks, which is why the mail shell still reads
    10/49 — 109 `@elabs-ai/components-ai`, 50
    `@elabs-ai/components-charts`), and every one of those is text a
    compact surface will not tighten. Closing it is ordinary text-scale ratchet
    work, not a change to the dial.
  - **Migrating a raw utility to its role is a size/leading no-op, not a
    byte-identical one.** Verified in a real browser across 18 stories / 577
    text elements at `comfortable`: computed `font-size`, `line-height` and
    `font-weight` changed on **0** of them. `letter-spacing` changed on 77 —
    every one a `text-xs` → `text-meta` site picking up the `meta` role's
    designed `0.01em` (+0.12px at 12px), which is the roles-bundle-all-four-
    dimensions rule working as intended. (One of those 77 had been inheriting a
    heading's −0.28px tracking through a `Badge` nested in an `<h2>`; it now
    carries its own.)
  - Mechanically the role literals moved one layer down, into `themes.css`
    § TYPE SCALE BASE (`--type-size-<role>` / `--type-leading-<role>`), with the
    `@theme` `--text-<role>` keys aliasing them; the density blocks redeclare
    the roles as `calc(base × var(--type-factor))`. `--text-<role>` remains the
    public token a consumer overrides, unchanged in name and resolved value.
  - The **legibility floor is really an x-height floor (~5.5px), not a px
    floor** — see the CAVEAT in `density.css`: measured on the shipped faces,
    blueprint's IBM Plex Mono at the compact `meta` size (5.81px x-height) is
    optically larger than the brand sans at today's comfortable 12px (5.83px),
    while the brand sans at compact `meta` sets the system minimum at 5.47px. A
    narrower brand face could clear "11px" and still fall under it.
  - This **supersedes** research 07 §E.4 ("type is NOT density-aware") and
    withdraws the reserved `[data-type-scale]` sixth dial; both records are
    amended in place. Locked by
    `packages/tokens/src/density-type-scale.test.ts` and shown by
    `Foundations/Typography → Density scale`.
- **`Progress`'s four tones now all clear 3:1 against the track, measured in a real browser (#358).** The `variant` axis shipped earlier this cycle with one hole: `warning` sat at 1.88:1 against the `bg-muted` track in `light`, which is why the story carried a "does NOT clear 3:1" caveat and the issue stayed open. #381 fixed that at the token, so the tones were re-measured on the live `display-progress--tones` story (`getComputedStyle` → canvas readback, not token arithmetic) in all three themes: light 4.09 / 5.19 / 4.44 / 4.94 and dark 7.17 / 9.07 / 7.88 / 4.79 for default / success / warning / destructive. `blueprint` renders all four as one identical DRAWN control (transparent fill, hairline border at 7.34:1) — there the tone must be read from `aria-valuetext` or an adjacent label, never the fill. The story's contrast table is updated with the measured numbers and its stale `#334` note dropped (`--primary` and `--success` are distinct now, so `default` and `success` no longer render identically). No API change.
- **BREAKING (visual), `@elabs-ai/components-tokens`: `--warning` is now a DEEP amber and `--warning-foreground` is LIGHT ink (#381).** In `light` (the default theme) and the `:root` light base, the old `--warning` (`oklch(0.78 0.16 67)` / `oklch(0.78 0.15 80)`) cleared WCAG 1.4.11's ≥3:1 non-text bar against **no shipped surface at all** — 2.07:1 on `--card` at best, 1.79:1 on `--secondary` — so any warning mark whose colour is its only cue (Timeline's `awaiting-approval` dot, a `warning` flow-node stroke, a `Rating` star, a colour-picker swatch) was effectively invisible. The fill is now `oklch(0.555 0.12 67)` / `oklch(0.555 0.115 80)`: 4.23-4.89:1 against `--background`/`--card`/`--muted`/`--surface-muted`/`--secondary`. Because one token cannot be both a light plate under dark ink and a mark on a light surface, the paired `--warning-foreground` flips to `oklch(0.985 0 0)` — which also makes `warning` the same "dark plate + white ink" shape as its `success`/`info`/`destructive` siblings. **Visible change:** `Badge variant="warning"` and `StatusBadge "awaiting-approval"` render as a deep-amber plate with white text instead of a pale-amber plate with dark text; `bg-warning/10` washes read very slightly warmer. `--warning-text` is unchanged. `dark` and `blueprint` are untouched (they already cleared 3:1). Locked by two new rows in `themes-contrast.test.ts`: every status fill rung ≥3:1 on all five mark surfaces in all four theme blocks, and `--warning-foreground` ≥4.5:1 on `--warning`.
- **`@elabs-ai/components-editor`'s entity chip uses `text-warning-text` for its `concept` kind (#381).** It was `text-warning-foreground` on a `bg-warning/10` wash — the plate-ink rung on a bare wash, which would have become near-white-on-near-white once `--warning-foreground` flipped. It now matches its `place`/`product` siblings.

### Fixed

- **`PromptInputButton`'s tooltip-derived `aria-label` no longer clobbers a
  visible text label or a caller's explicit `aria-label={undefined}`
  (follow-up to #356, `@elabs-ai/components-ai`).** The #356 default was
  unconditional, so a text+icon button that gained a `tooltip` (e.g. a
  model-switcher pill showing "Claude Opus 4") had its VISIBLE label silently
  **replaced** by the tooltip text in the accessible name — a WCAG 2.5.3
  "Label in Name" violation. The derived `aria-label` now applies ONLY to
  genuinely icon-only buttons (no visible text anywhere in `children`,
  adapting the same children-shape notion the size heuristic already used).
  Separately, `aria-label={ariaLabel}` was emitted BEFORE `{...props}`, so an
  explicitly-passed `aria-label={undefined}` (a key that IS present in JSX,
  just `undefined`-valued) was re-spread over the derived default, wiping the
  accessible name entirely; the prop is now pulled out of the spread and
  applied last, so a defined `aria-label` still wins and an `undefined` one no
  longer clobbers the default. Both cases are covered by new tests against the
  real rendered component.
- **`PromptInputButton`'s `tooltip` now defaults the button's `aria-label`
  (#356, `@elabs-ai/components-ai`).** Icon-only buttons that carry only a `tooltip`
  (`Composer`'s "Attach files" and "Voice" controls, both call sites
  unchanged) previously had NO accessible name at all — the tooltip content
  was visual-only. The button's `aria-label` now defaults to the tooltip's
  string content (or its `content` when `tooltip` is the richer
  `{ content, shortcut, side }` shape); an explicit `aria-label` still wins.
  Purely additive — no prop signature change, no behaviour change for a
  consumer who already sets `aria-label`.
- **`MessageBranch` gains a controlled `branch` prop (#361,
  `@elabs-ai/components-ai`).** Previously `defaultBranch` was read once into
  internal state with no way for a host to drive branch selection (e.g.
  restore it from a URL param) without discarding all internal/sibling state
  via a changed `key`. `branch` is optional and `undefined` by default, so
  existing `defaultBranch` + internal-navigation usage is unaffected;
  `onBranchChange` continues to fire in both modes, per the `isControlled`
  convention already used by
  `MessageFeedback`/`MessageEdit`/`MessageForm`/`MessageTable`.
- **`@elabs-ai/components-ui` — `SelectTrigger` recovers a clipped long/composed value (#332).**
  When (and only when) its rendered text is measurably clipped by
  `line-clamp-1`, the trigger sets a native `title` from that text — composed
  one child per segment, so a prefix beside `SelectValue` reads `"Env: Staging"`
  rather than `"Env:Staging"`. A value that fits gains nothing: an
  unconditional `title` would become the button's accessible name and paper
  over a genuinely unnamed combobox with the field's own VALUE. Opt out with
  the new `autoTitle={false}` (required when the trigger is also a
  `TooltipTrigger`, or the native and Radix tooltips both open on hover), or by
  passing your own `title`. `title` never reaches keyboard users — the
  `LongComposedLabel` story documents that pattern
  (`Tooltip`/`TooltipTrigger asChild`/`TooltipContent` + `autoTitle={false}`),
  which Radix also opens on keyboard focus. New exported type:
  `SelectTriggerProps`.
- **`@elabs-ai/components-ui` — `TabsList` scrolls instead of clipping when the tab strip
  overflows (#344).** `overflow-x-auto` (bounded by `max-w-full`) turns an
  overflowing strip into a horizontal scroll container; `justify-center-safe`
  replaces `justify-center` so the first tab is never stranded off-screen once
  the set overflows. On a genuine activation (keyboard, pointer, or a
  programmatic value change) the newly-active `TabsTrigger` scrolls ITS OWN
  STRIP — never `Element.scrollIntoView()`, which walks every scrollable
  ancestor and drags the whole page along. Activation is detected by observing
  the trigger's `data-state` attribute, because Radix flips it inside its own
  context consumer without re-rendering this wrapper: a render-driven effect
  never saw an activation at all, and it DID fire on every mount (measured:
  `window.scrollY` 0 → 900 for a strip that was not even overflowing). A strip
  that fits is now inert, mounting never scrolls the page or any ancestor, and
  the reduced-motion behaviour follows `useReducedMotion()` (the in-app motion
  preference on `ThemeProvider`, not just the OS setting). A `ResizeObserver`
  re-measures after a late relayout — a webfont swapping in on a cold load
  otherwise leaves the target stale (it stranded the last tab 45px outside the
  strip under the wider mono type of the blueprint theme).
- **`@elabs-ai/components-ui` — `Slider` forwards `aria-valuetext` and a `thumbProps` escape
  hatch to its thumb (#353).** Extends the existing `aria-label`/
  `aria-labelledby` forwarding: pass a top-level `aria-valuetext` (e.g. a
  replay scrubber announcing "step 3 of 12" instead of the bare numeric
  value), or `thumbProps` for `data-*`/`style`/an explicit override — an
  explicit `thumbProps` key always wins over the matching top-level prop. The
  six attributes that MAKE the element a slider (`role`, `aria-valuenow`,
  `aria-valuemin`, `aria-valuemax`, `aria-orientation`, `tabIndex`) are ignored
  in `thumbProps`: Radix derives them from live state and spreads consumer
  props after its own, so passing them would silently destroy the widget.
  Single-thumb only; `Slider` still renders exactly one hardcoded `Thumb` and
  does not support multi-thumb/range sliders (tracked separately, not in this
  change).
- **`@elabs-ai/components-tokens` — `useReducedMotion()` and `ThemeProvider` feature-detect
  `window.matchMedia`.** Both only guarded `typeof window`, so mounting either
  in a jsdom test environment without a `matchMedia` stub threw
  `window.matchMedia is not a function`. The hook is documented as safe to call
  from any library component, so the detection belongs in it — not in each
  consuming package's test setup.

### Added

- **`XAxis` gains a `tickFormat`/`tickValues` seam, and warns in dev when the
  default label-collision de-dupe collapses the axis below 2 ticks (#357).**
  `tickFormat?: (value: Date) => string` overrides the default `Intl` tick
  label formatter; `tickValues?: Date[]` renders exactly those tick positions,
  bypassing generation and the label-collision de-dupe entirely. Previously,
  dense/same-day data could silently collapse the x-axis to a single tick with
  no diagnostic — a one-time `console.warn` now fires when that happens and
  neither override is set. Both new props are optional and purely additive;
  default axis rendering is unchanged.
- **`DataTable` gains `caption`, `onRowClick`, `rowActionLabel`, `rowClassName` and
  `hidePaginationWhenSingle` (#337, #338, #342, `@elabs-ai/components-data`).**
  - `caption?: ReactNode` renders a screen-reader-only (`sr-only`) `<caption>` as the first
    child of `<table>` so the table has a real accessible name; every header `<th>` now also
    carries `scope="col"` unconditionally (#338).
  - `onRowClick?: DataTableRowClickHandler<TData>` (exported) makes a row activatable, and
    gives it exactly ONE activation target: a visually-hidden `<button>` in the row's first
    cell, which is the row's tab stop and its accessible name. The `<tr>` stays a plain
    `row` — a focusable `<tr>` would be a tab stop AT cannot read as activatable (it can't
    take an activation role without breaking table semantics) and would compete with the
    controls inside the row. Pointer clicks on the row body resolve to the same handler,
    guarded against firing when the click originated on a nested interactive control
    (button/link/input/…) or is the tail end of a text-selection drag — so consumers no
    longer hand-roll the delegated-click workaround (#337). `rowActionLabel?: (row) => string`
    names that button (default: the row's first cell value, else the localized
    `data.table.rowAction`); `rowClassName?: (row) => string` merges per-row classes
    alongside the zebra/hover/selected ones. All optional; omitting `onRowClick` renders
    rows exactly as before.
  - `hidePaginationWhenSingle` (default `true`) hides the pager once
    `table.getPageCount() <= 1`, except when `manualPagination` is set without
    `rowCount`/`pageCount` — there the page count isn't knowable and the existing #227 dev
    warning stays the diagnostic instead of a silently-hidden pager (#342).

### Fixed

- **`DataTable`'s non-virtualized scroll container was `overflow-hidden`, silently clipping
  columns that didn't fit instead of letting them scroll (#330, `@elabs-ai/components-data`).**
  It is now `overflow-auto` and shows a token-driven edge fade (`from-card to-transparent`)
  once the table actually overflows in that direction. The keyboard tab stop
  (`tabIndex={0}`) and its `aria-label` are gated on MEASURED overflow, so a table that
  fits gains neither a focus stop that does nothing nor a false "scrollable" announcement —
  a wide/desktop table is a complete no-op. Both accessible names now go through the
  `t()` locale seam (`data.table.scrollRegion`, ADR 0017) instead of hardcoded English.

- **`CardDescription` silently dropped its own `text-muted-foreground`, and its
  line-balancing never actually applied (#336, also repairs #148).** The root
  cause was an invalid, misspelled Tailwind class name in
  `packages/ui/src/components/card/card.tsx` — not a real `text-*` utility —
  so it emitted zero CSS. `tailwind-merge` correctly classified the unknown
  token as an unrecognized text-color value and, per its documented
  conflict-resolution behavior, dropped `text-muted-foreground` in favor of
  it. `tailwind-merge` was never buggy. Fixed by using the real, registered
  utility (`text-balance`, which sets `text-wrap: balance` and already lives
  in `tailwind-merge`'s own `text-wrap` conflict group, independent of text
  color) — this both keeps the color class and, for the first time, actually
  balances `CardDescription`'s line wraps as #148 originally intended.

### Added

- **`@elabs-ai/components-ui` `Card`/`Alert` heading + measure seams (#328, #329, #339).**
  - `CardTitle` gains `as?: "div" | "h1"-"h6"` (default `"div"`, byte-identical) so
    a card that titles a real page section can join the document outline instead
    of always rendering an unreachable `<div>`.
  - `AlertTitle` gains `as?: "h1"-"h6"` (default `"h5"`, byte-identical) for the
    same reason on inline alerts, and its `forwardRef` generic is corrected to
    `HTMLHeadingElement` (was mismatched to `HTMLParagraphElement`).
  - `CardDescription` and `AlertDescription` gain an opt-in `measure?: boolean`
    that caps genuine prose to a readable line length (`max-w-prose`, ~65ch);
    off by default so short, subtitle-style descriptions stay full width.
  - `CardTitleProps`, `CardDescriptionProps`, `AlertTitleProps` and
    `AlertDescriptionProps` are now exported.
- **5 new installable `registry:block` items (Phase 1 of #252) — 19 → 24 registry
  items.** Copy-own promotions of existing Patterns/Blocks Storybook exemplars,
  each extracted into a `registry/blocks/<name>-01/{components,data}/` file tree
  (one concern per file), following the `stat-card-area-01` shape:
  - `stat-cards-01` — elevated KPI tiles: `MetricCard` with an inline
    `Sparkline` (bar or line), a goal/progress tile, and a this-vs-last
    comparison tile.
  - `chart-card-kpi-01` — an elevated chart-in-a-card: a KPI header with a
    delta and a segmented period control (`ToggleGroup`) that re-renders a
    token-coloured `AreaChart`, with a footer breakdown legend.
  - `stat-list-01` — compact summary widgets: a ranked list with share bars
    and a delta, a leaderboard, and a transaction/activity feed.
  - `integration-grid-01` — a responsive grid of integration cards (icon,
    name, description, connect/manage action and connection status) under a
    page header.
  - `form-wizard-01` — a horizontal numbered-stepper checkout flow (Customer,
    Shipping, Payment, Review) with real fields and a `Descriptions` review
    step.
  - The original `*.stories.tsx` exemplars are unchanged and remain the visual
    reference/render check. Phase 2 (variant matrices per family: area, bar
    and line stat cards with goal and comparison variants; revenue-vs-expense,
    donut, gauge and radar chart blocks; ranked-list, leaderboard, feed and
    KPI-banner widgets; a horizontal form wizard) is deferred, blocked on the
    still-open source-composition issues #249/#250/#251 — tracked in a
    dedicated follow-up (#327) linked from #252 so the remaining scope stays
    visible; #252 itself is left OPEN (not auto-closed).
- **Brownfield analysis actually analyses (#124).** `brand-ui scan` now records
  per-file usage, the prop names each component is used with, the module import
  graph and a token-debt count (raw colour/spacing/font values, counted with the
  audit's own rule set). `brand-ui map` classifies against a new table-driven
  `SOURCE_ALIASES` list, so `props` / `compose` / `drop` are reachable verdicts
  instead of documentation — a MUI `Typography` maps to `Text` with a concrete
  prop remap, `Box`/`Stack` resolve to a composition, `Fragment`/`Head`/router
  tags are dropped. `risk`/`effort` are computed from verdict × usages × file
  spread rather than being constants, and the summary carries `coveragePct`
  (measured in usages, not names).
- **The migration deliverables are emitted (#124).** `--out <dir>` on `scan` /
  `map` writes `migration/repo-profile.md`, `migration/analysis.md` and a
  strangler-fig `migration/plan.md` with the mapped components per phase.
  Rendering lives in `packages/cli/lib/migration-report.mjs`, which imports no
  `node:fs` at all — `--out` is the only write in the whole brownfield path, and
  a test hashes the scanned project before and after to prove it.
- **`brand-ui-migrate` skill (#56).** The brownfield flow ships as a real skill
  (scan → map → phased plan → review-gated migration), registered in the plugin
  manifest and the agent kit, so `brand-ui-start` §2 no longer says "forthcoming".
  It states its own limits: the analysis is read-only and there is no automated
  codemod.
- **Composed-surface preview — rung 2 of the visual loop (#57).**
  `pnpm surface:preview -- --archetype <name> --theme <slug> --out <file.html>`
  renders an assembled multi-component screen as a self-contained HTML file (no
  network, no webfont, tokens inlined from `themes.css`), for the visual
  decisions no single Storybook story can show. Self-tested
  (`pnpm surface:preview:test`) across every archetype × theme.
- **`plugin:check` gains a shared-reference-doc rule (#57).** A doc two skills
  both run — the visual loop — must exist exactly once, with every cross-skill
  reference resolving, so "both flows call the same loop" cannot decay into two
  copies. The rule immediately caught a dangling relative link in `stages.md`.
- **The taste profile — the four taste axes as one readable object, and the
  anti-slop bar wired onto generated output (#72, #108, #109; ADR 0020).**
  - `@elabs-ai/components-tokens` gains a `register` axis
    (`TASTE_REGISTERS` / `TasteRegister` / `TASTE_REGISTER_META` /
    `DEFAULT_TASTE_REGISTER` / `isTasteRegister`) and assembles it with the three
    shipped dials into `TasteProfile` + `DEFAULT_TASTE_PROFILE` (**product /
    comfortable / system / 0** — restrained by default, expressive is opt-in).
    `ThemeProvider` takes `defaultRegister` / `registerStorageKey`, persists the
    choice and writes `data-register`; `useTasteProfile()` returns the live
    profile. **No new CSS dial:** `expressiveness` IS the existing `--decoration`
    dial (ADR 0020), so `themes.css` is untouched and nothing renders differently.
  - The profile is **machine-readable**, so the audit reads it instead of asking a
    human to pick a register: `brand-ui.manifest.json` carries a `taste` block
    (vocabulary + defaults, parsed from `theme-types.ts` so it can't drift), and
    `brand-ui info [--json]` reports the **resolved** profile — those defaults
    overridden by an optional project-root `brand-ui.config.json` `taste` key
    (invalid values degrade to the default and are reported, never thrown).
  - `brand-ui audit` now **judges severities against the active register**:
    `over-round` / `side-stripe` / `bounce-easing` soften to advisory in the
    `brand` register (`--register=product|brand` overrides). Banned rules (raw
    color, `gradient-text`, tiny text) and content slop never soften. Same for
    `mcp__brand-ui__audit` (new optional `register` arg) and `mcp__brand-ui__info`.
    The profile is resolved **nearest-first from the audit target** (its own
    ancestors → cwd → repo root), so `brand-ui audit <app>` run from anywhere
    honours the `brand-ui.config.json` that sits with that app.
  - **The anti-slop bar has an exit code.** `brand-ui audit --strict` exits `1` on
    any blocking style finding or any content slop (and `0` when clean), and the
    headline counts slop in its own bucket — `N style issue(s), M content-slop
(blocking), K advisory` — instead of folding it into "advisory". Plain runs still
    exit 0; the scaffold wires `"audit:brand-ui": "brand-ui audit src --strict"`
    into the generated app so the bar outlives the session that built it.
  - **`brand-ui-new-app` now sets the profile and runs the audit as a blocking
    step.** Stage 5 captures register + a feel preset (density · motion ·
    expressiveness) into a new `taste` block in the app-spec schema; the scaffold
    applies it through `ThemeProvider` props + a generated `brand-ui.config.json`;
    and "Verify before done" requires `brand-ui audit <target> --json --strict`,
    whose exit code (not the agent's memory) is what makes a content-slop finding
    ("John Doe", "99.99%", "Acme") block done. A new
    `reference/patterns.md` lists the curated arsenal — only patterns expressible
    with shipped components, each tagged with its minimum register/expressiveness
    and a motion note.
  - **A scaffold-declared profile may not set `motion: "full"`** (ADR 0020 §6).
    `[data-motion-pref="full"]` is the one state that keeps `--motion-factor: 1`
    through an OS `prefers-reduced-motion: reduce` request and escapes the
    third-party animation cap — informed consent a person gives for themselves via
    `useMotionPreference()`, never an app default imposed on every visitor. The
    "Expressive" preset is `system` (which already animates fully whenever the OS
    is neutral), the app-spec schema's `taste.motion` enum is `system | reduced`,
    and `pnpm app-spec:check` fails a spec that says `full`.
  - `brand-ui-start`'s brownfield route now reports a **taste score**
    (`brand-ui audit`) alongside the component map **and proposes the upgrades** —
    a fixed mapping from each finding class (raw colour, raw type sizes, content
    slop, register tells, hand-tuned density, ad-hoc ornament, missing states,
    motion) to the token/dial/component change that fixes it, plus the profile to
    record in `brand-ui.config.json`. It proposes; it still changes nothing.
  - **Not yet exercised end-to-end:** the bar is proven hermetically (a clean
    fixture exits 0, a placeholder fixture exits 1) but has never run over the
    output of a real `brand-ui scaffold`, because scaffolding is still a planner
    (#123); and the brownfield taste score + upgrade proposals live in
    `brand-ui-start`'s interim migrate route, since the `migrate` skill itself is
    VP-03 (#124).
  - `pnpm app-spec:check`'s validator subset gained `integer` + `minimum`/`maximum`
    (the `taste.expressiveness` dial is the contract's first integer field), and
    the gate now also rejects a spec that defaults motion to `full`.

- **`brand-ui scaffold` turns an `app-spec.md` into a RUNNABLE, born-compliant app
  (#123, #263, #55).** `planScaffold` reads the spec's fenced `json` Machine block
  (validated by the same module `pnpm app-spec:check` gates); `--write <dir>` emits
  `index.html`, `src/App.tsx` (the archetype template with the spec applied),
  `src/main.tsx`, `src/styles.css`, `vite.config.ts` (react + `@tailwindcss/vite`),
  `tsconfig.json`, `app-spec.md`, `CLAUDE.md`, `AGENTS.md`, `brand-ui-context.md`
  (the manifest-derived component inventory), `eslint.config.js`, a CI quality
  workflow and `package.json` — verified by `pnpm install && vite build` on the
  emitted app, not only by tests.
  - The **standalone install handoff**: the package set is derived by parsing the
    archetype template's imports (never hand-listed), and the dependency block, the
    `@source` lines and the peer list are generated from that one array. An
    **unreachable template is now a hard error** instead of a silent `{tokens, ui}`
    plan.
  - **Engine peers are derived from the packages themselves** — `peerDependencies`
    now ships in `brand-ui.manifest.json`, so `@xyflow/react` / `monaco-editor` /
    `maplibre-gl` / the `ai` SDK are installed at the range the library declares
    instead of a `"*"` wildcard (a mismatch on those context singletons breaks at
    runtime, not at install).
  - The published CLI **ships the archetype templates** (`files: ["templates", …]`,
    copied by `prepack`), so `scaffold --write` works in any project that installed
    `@elabs-ai/components-cli` — no brand-ui checkout required.
  - Emitting into a folder that already holds some of those files reports
    **`partial`** and exits non-zero, instead of a headline "written" over an app
    that cannot run.
  - New: `.claude/agents/brand-ui-scaffold-builder.md`, `packages/cli/lib/app-spec.mjs`,
    `packages/cli/scripts/bundle-assets.mjs`, `packages/cli/test/{scaffold,packaging}.test.mjs`.
- **Loading/streaming placeholders roll out to the remaining `@elabs-ai/components-ai`
  `packages/cli/scripts/bundle-assets.mjs`, `packages/cli/test/{scaffold,packaging}.test.mjs`.- **Loading/streaming placeholders roll out to the remaining `@elabs-ai/components-ai`
  output surfaces + the `@elabs-ai/components-data` toolbar (#269, `.claude/rules/loading-states.md`).\*\*
  - `Image` gains `showSkeleton` — a decode-aware `Skeleton` overlay (defaults to
    `Boolean(width && height)`, since a skeleton needs a box to reserve) plus an
    `onError` fallback (`ImageOff` glyph) so a broken image doesn't bleed its
    native broken-image glyph through a perpetually-pulsing skeleton.
  - `ToolOutput` gains `isStreaming`, rendering a skeleton in the result slot
    instead of `null` and suppressing the error branch while streaming.
  - `MessageResponse` gains `loading` (skeleton lines at the body line-height).
  - `CodeBlock` gains `isStreaming` (keeps building up the partial code, with a
    `Shimmer` "Generating…" cue) and its `CodeBlockProps` type is now exported.
  - `Artifact` and `Sandbox` gain `loading` via a lifted-provider pattern —
    `ArtifactContent`/`SandboxContent` render the skeleton while
    header/title parts keep rendering as passed.
  - `WebPreviewBody` gains a `loading` not-ready signal (`true` renders a
    layout-shaped `Skeleton` filling the iframe box; a `ReactNode` still
    overrides with custom placeholder content, as before).
  - `FacetFilter` and `ColumnPicker` open their prop interfaces (extend
    `ButtonHTMLAttributes`, spread `...props`, merge `className` via `cn()`,
    forward a ref to the trigger `Button`) so a consumer can disable the
    toolbar during a pending fetch. The Data App template gains a `Loading`
    story showing the toolbar disabled while `DataTable`'s existing `loading`
    skeleton rows render.
  - Every new prop ships a story (`Loading`/`Streaming` export) and a smoke test.
- **`ThemeProvider` gains `allowedThemes` (#355)** — a product that ships only
  some of the themes now passes one prop instead of hand-rolling three separate
  defenses. `useTheme().themes` narrows to the subset, a persisted value for a
  hidden theme is rejected in the SAME mount pass that applies the theme (so it
  can never flash on boot — the path a filter-only fix silently misses), and
  `setTheme` with a disallowed name is a no-op that warns in development and
  never reaches storage. Omitting the prop is unchanged behaviour. An explicit
  `defaultTheme` outside the subset falls back and warns; **omitting it never
  warns** — the library default yielding to a subset is not a consumer mistake.
  Locked by `packages/tokens/src/theme-provider.test.tsx`, which records EVERY
  `data-theme` write rather than only the settled value, and separately asserts
  the FIRST RENDER's context value (the `useState` initializer is coerced too, so
  a child reading `useTheme()` before any effect never sees a disallowed theme —
  an assertion a corrective-effect implementation fails).
  - **#355 stays OPEN — `ThemeSwitcher` does NOT inherit the subset.**
    `ThemeSwitcher` (`@elabs-ai/components-ui`) has its own `themes`
    prop defaulting to the light/dark pair and never reads `useTheme().themes`, so
    with `allowedThemes` it can still offer a theme the provider rejects — whose
    `setTheme` is now a silent no-op. **Consumers must pass
    `themes={useTheme().themes}` explicitly.** The fix is deliberately out of
    scope here: defaulting `ThemeSwitcher` to the provider's list would flip every
    existing 2-theme toggle into a 3-theme dropdown (a breaking visual change), so
    it needs a subset-of-`THEMES` guard designed in `@elabs-ai/components-ui`.
- **`@elabs-ai/components-tokens` ships font smoothing (#345).** The
  `@layer base` `body` rule now sets `-webkit-font-smoothing: antialiased` and
  `-moz-osx-font-smoothing: grayscale`, at the same layer as the `@font-face`
  declarations. **Rendered change on WebKit/Blink: UI type reads slightly
  lighter/cleaner** — the weight the self-hosted faces were drawn for. Consumers
  that added the same two lines locally can drop them. Documented for consumers in
  the tokens package README (generated from `scripts/gen-package-readmes.mjs`) and
  the `Foundations/Typography` Storybook page. Locked by
  `packages/tokens/src/themes-base-layer.test.ts`.

### Fixed

- **The 8 `data`/`lib`-backed registry blocks (5 new + the 3 pre-existing
  `stat-card-*-01`) shipped unresolvable relative imports at their installed
  `target`.** A round-2 fix had moved the `target` for `data`/`lib` files under
  the block's own `components/<block>/` dir but left the REPO tree with
  `components/` and `data`/`lib` as siblings — so `./data/x` (matching the new
  `target` layout) failed to resolve in the repo itself, while the previous
  `../data/x` had failed to resolve at the install target. Fixed by moving
  `data`/`lib` physically under `components/` in the repo tree too
  (`registry/blocks/<block>/components/data/…`, `.../components/lib/…`) so the
  `./data/x` import now resolves in BOTH trees, and updating the corresponding
  `files[].path` entries in `registry/registry.json`.
  - New gate: `pnpm registry:resolve:check` (self-tested via
    `pnpm registry:resolve:check:test`, wired in CI) materializes every
    registry item by both its repo `path` and its install `target` and fails
    if a relative import can't resolve in either tree — `registry:validate`
    only checked that a `files[].path` exists, never that imports inside it
    resolve.
  - The `stat-cards-01` description (and its manifest/CHANGELOG copies)
    claimed a `Sparkline` `area` variant that doesn't exist
    (`Sparkline`'s `variant` prop is `"bar" | "line"` only); corrected to
    "bar or line". A real `area` variant, if wanted, is tracked in #327.

### Changed

- **RENDERED COLOUR CHANGE — `--success` and `--ring` are no longer aliases of
  `--primary`/`--info` in `light` and `dark` (#334).** Both pairs were
  byte-identical, so a success chip was indistinguishable from a primary button
  and a focus ring from an "Info"/"Running" chip — by colour, the only signal
  these tokens carry. **Success chips, success text and focus rings (including
  `--sidebar-ring`) shift hue in both reference themes**; `--primary`/`--info` and the
  brand green are untouched (the #180 brand exemption stands), as is `blueprint`,
  which already separated the roles.
  - `light`: `--success` `oklch(0.553 0.143 153)` → `oklch(0.49 0.12 170)`
    (a deeper, cooler green — white on it goes 4.29:1 → **5.46:1**, now AA for
    normal text); `--success-text` → `oklch(0.46 0.12 170)`; `--ring` /
    `--sidebar-ring` `oklch(0.6 0.13 245)` → `oklch(0.52 0.17 255)` (3.74:1 →
    **5.36:1** vs `--background`).
  - `dark`: `--success` `oklch(0.75 0.14 153)` → `oklch(0.82 0.12 170)`;
    `--success-text` → `oklch(0.84 0.12 170)`; `--ring` / `--sidebar-ring`
    `oklch(0.7 0.13 245)` → `oklch(0.78 0.11 255)` (6.71:1 → **8.87:1** vs
    `--background`).
  - Edited in the DTCG source (`packages/tokens/tokens/themes/*.tokens.json`) and
    regenerated with `tokens:build`; locked by new `themes-contrast.test.ts` rows
    asserting both string inequality AND an OKLab ΔE floor, so a future retune
    can't reintroduce the collision with a cosmetic nudge.
- **`SandboxRootProps` → `SandboxProps`** to match the repo's `<Name>Props`
  convention; `SandboxRootProps` is kept as a `@deprecated` type alias so
  existing imports keep compiling.
- **`FacetFilter`/`ColumnPicker`** (`@elabs-ai/components-data`) are now
  `forwardRef` and extend `ButtonHTMLAttributes<HTMLButtonElement>` (see Added,
  above) — a non-breaking widening of their prop types.

### Changed

- **The last three eager engines in `@elabs-ai/components-ai` are now lazy (#313).**
  React Flow, xterm and media-chrome are reached through a dynamic `import()`
  instead of a static edge, finishing what ADR 0019 started with Mermaid and
  Rive. `pnpm heavy-deps:check` is down from **9 known eager sites to 0**, and
  the shipped `packages/ai/dist/index.js` has **no** `@xyflow/react` /
  `@xterm/xterm` / `media-chrome` import left (11 static edges before, including
  both engine stylesheets) — they moved into three new boundary chunks.
  - React Flow's six public modules (`Canvas`, `Controls`, `Edge`, `Node`,
    `Panel`, `Toolbar`) share **one** boundary (`_flow-boundary.tsx`, via
    `_flow-lazy.ts`), so the engine lands in exactly one chunk and the parts
    inside a canvas resolve from the cache it already populated. `Canvas`
    reserves its box with a `Skeleton`; the in-canvas parts use a `null` fallback.
  - `InteractiveTerminal` keeps its `forwardRef` + imperative handle and awaits
    the engine inside its mount effect (the `_lazy-mermaid.ts` shape, since xterm
    is only ever constructed from an effect). **Writes issued before the chunk
    resolves are buffered and replayed**, so a consumer's mount-effect
    `ref.current.write(banner)` now lands — it was silently dropped before, both
    here and on `main`.
  - `CanvasProps`, `PanelProps` and `ToolbarProps` are now exported (they were
    local types, against the component-api rule); no other public API changed.
  - New stories: `AI/Canvas` and `AI/AudioPlayer` — neither surface had one, so
    neither could be observed rendering across the themes.

### Release engineering & governance

- **The release path now runs exactly the gates a PR runs (#103, #71).** `ci.yml`
  is `on: pull_request` + `push: main`, so a `v*` tag never triggered it — and
  `release.yml` hand-copied a subset while its header claimed it ran "the
  same battery CI runs". A mechanical diff (at `c1a170b`, this branch's point of
  departure) found ci.yml running **81 blocking gate steps** and release.yml
  reaching **11** of them — so **70** (the whole artifact-freshness category — `manifest:check`, `gen:check`, `inventory:check`,
  `llms:check`, `context:check` — plus `components:check`, `registry:validate`,
  `plugin:*`, every ratchet) that ran on PRs and on no ref involved in a release.
  The list now lives once in the reusable **`.github/workflows/gates.yml`**, which
  both workflows call, and **`pnpm release-gates:check`** (self-tested via
  `release-gates:check:test`) fails if a blocking gate ever becomes reachable from
  one path but not the other. `check-docs-accuracy.mjs`'s CI-gate contract follows
  the `workflow_call` too, and now fails loudly instead of passing vacuously if it
  ever resolves zero gates. Both vacuity guards are locked by self-tests that drive
  the real CLI against a planted fixture root and assert a non-zero exit — deleting
  either guard turns the suite red, which asserting on the pure helper alone did not.
- **The blocking Storybook interaction tests moved onto the release path (#103,
  #280).** They are written `pnpm --filter <pkg> test-storybook`, a shape the gate
  parser could not see, and they lived in `ci.yml` — so a blocking PR gate ran on no
  ref involved in a release while `docs/RELEASING.md` claimed release.yml ran
  "literally the same job a pull request runs". The job now lives in `gates.yml`
  (both callers reach it), and the parity gate understands **both** shapes a gate
  is written in (`pnpm <gate>` and `pnpm --filter <pkg> <script>`). Its success line
  and the runbook now say what is actually covered, and name the one thing that is
  not: a `continue-on-error: true` job (today only the Playwright E2E suite) cannot
  fail a PR either, so it is out of scope by definition.
- **A release stores what it validated (#103, #71).** `pnpm release:report`
  (`scripts/write-release-report.mjs`) derives `validation-report.json` + `.md`
  from the workflows on disk — version, commit, tag, run URL, node/pnpm, every
  distributable package, every gate — and CI attaches both to the GitHub Release.
  It is written after the gates job and before the publish, so it cannot claim a
  validation that did not happen. The gate list is read from the workflows' `run:`
  **commands**, and a `pnpm <name>` is only counted when it is the command being
  run: scanning the raw YAML instead recorded two gates that never executed —
  `version:set` (a writer, named in release.yml's header comment and in a
  tag-mismatch error message) and `uses:` (the YAML key on the line after
  `- name: Setup pnpm`). Both were emitted as `passed`. The self-test's fixture now
  carries those exact traps.
- **The publishable-package set has ONE derived definition (#295).** The predicate
  lived as four hand-copies — `set-version.mjs`, `check-publish-ready.mjs`, an
  inline `node -e` in the workflow's pack loop, and a genuinely different one in
  `check-consumer-install.mjs` — with nothing detecting divergence. That is what
  let v1.7.0 ship without `@brand/maps`. It is now `scripts/lib/distributables.mjs`,
  imported by every caller; `check-consumer-install.mjs`'s narrower
  `publishConfig.exports` predicate is documented as deliberate (the CLI has no
  import surface to smoke-test), not drift. The runbook's last hand-kept literals
  went with it: `docs/RELEASING.md` § 7's `npm deprecate` loop now reads its package
  names out of the release's own `release-manifest.json`, and its prose counts
  ("all 16 lockstep sites", "the 11 component packages", "12 packages") are gated by
  a new `docs:check` rung against `versionSites()` / `distributablePackages()` — a
  number that drifts now fails CI instead of misleading a reader.
- **Every release asset is checksummed, and the snapshot runs locally (#105).**
  `pnpm release:snapshot` (`scripts/release-snapshot.mjs`) packs the derived set
  into `release/v<version>/` and writes **`release-manifest.json`** — version, git
  SHA, ISO date, per-package versions, and a SHA-256 + byte size for every asset.
  The `.tgz` files are the offline rollback path for consumers who by definition
  cannot reach the registry that would otherwise vouch for them, and the agent-kit
  and plugin `.zip` bundles are not npm packages at all, so they had **no**
  integrity story. The workflow's inline bash pack loop is replaced by this
  script, so the coordinated artifact set can finally be produced and inspected
  before a tag. Self-tested (`pnpm release:snapshot:test`): a planted fixture
  package appears in the derived set, and every checksum is verified against the
  bytes on disk.
- **The snapshot carries the record, not just the binaries (#105).**
  `release/v<version>/` now also holds **`RELEASE_NOTES.md`** (extracted from the
  changelog, never retyped — it cannot disagree with it), a **`CHANGELOG.md`** copy,
  and **`ground-truth/`** (`brand-ui.manifest.json`, the component inventory, and
  `llms.txt` + its per-package spokes) — the agent-facing truth for exactly that
  version. Each carries its own SHA-256 + byte size under a new `records` array
  (`schema: 2`), so "all checksummed" covers the documents too. Those records are
  then archived into **`release-record-<version>.zip`**, which is what makes the
  record _retrievable_ rather than merely hashed: `release/` is git-ignored and the
  Actions runner is discarded when the job ends, so a record that is only
  checksummed is one nobody can obtain — you could look up the SHA-256 of a
  released version's agent-facing ground truth and never get the bytes. Being a
  top-level `.zip` the archive is itself an asset, hashed like any other and
  attached by the workflow's existing glob, so the post-release verify contract is
  unchanged. `assets` means the `.tgz`/`.zip` **bundles**; `records` covers the
  documents. Everything the Release attaches out of the snapshot folder is in one
  of the two, except `release-manifest.json` itself — which cannot hash its own
  output. **The validation report is part of that**: it is written by an earlier
  step into the same folder and was attached with **no** checksum at all, which is
  the one artifact where that matters most (its whole job is to assert the build
  was validated) and it falsified the "a SHA-256 for every asset AND every record"
  line in the Release notes. It is now hashed under `records` and carried inside
  `release-record-<version>.zip`, and a self-test reads the real `release.yml` and
  fails if a newly attached file is not covered.
- **The validation report distinguishes "passed" from "skipped" (#103).** Every
  gate the release path declares used to be stamped `passed`, including a
  preflight step behind an `if:` — `pnpm marketplace:check` is
  `if: startsWith(github.ref, 'refs/tags/v')`, so a `workflow_dispatch` dry-run
  skips it and the artifact said otherwise. A conditional step on a non-tag run is
  now recorded as `skipped` (listed, not omitted — a reader must see the check
  exists and did not run).
- **A package-affecting change must record itself (#64).** WP-07 asked for "a
  changeset is required for package-affecting PRs (CI check)"; ADR
  [`0020`](./docs/ADR/0020-lockstep-versioning.md) rejected Changesets and
  accepted "no per-PR ceremony" as a gap. **`pnpm changelog-entry:check`**
  (`scripts/check-changelog-entry.mjs`, self-tested, in the CI battery) closes it
  in the lockstep idiom: a branch that touches
  `packages/<distributable>/src/**` — tests and stories excluded — must add a line
  under `CHANGELOG.md`'s `## Unreleased`. Touching the file is not enough; the
  diff must ADD content inside that section, since `## Unreleased` is exactly what
  `/release` renames and `release-snapshot.mjs` extracts `RELEASE_NOTES.md` from.
  It skips (exit 0) when there is no base ref to diff against, e.g. a `v*` tag
  build.
- **The gate list itself is ratcheted (#103, rung 3).** `pnpm release-gates:check`
  compared the two CALLERS; both go through `gates.yml`, so steps deleted from
  that file vanish from both sides at once and parity stays green over a shorter
  list. That is not hypothetical — this work replaced `ci.yml`'s inline gate block
  with a `uses:` call while `main` was concurrently adding gate steps to the same
  block, and a careless conflict resolution would have dropped them with every
  check green. `scripts/release-gates-baseline.json` records the gate steps the PR
  path runs, and the check now fails when one disappears. It ratchets UP;
  `pnpm release-gates:check -- --update` is the deliberate retire/rename path.
  The built shadcn registry JSON stays deliberately out — a release does not build,
  publish or host it (`docs/REGISTRY_GUIDELINES.md`), and the A2UI catalog is not
  shipped yet (WP-11).
- **A half-published release ends red, and a broken one does too (#106, #71).**
  `release.yml` resolves every published package at the released version from
  `https://npm.pkg.github.com` and asserts every asset the manifest names is
  attached — then runs a real **fresh-install smoke** (`pnpm release:smoke`).
  `npm view` proves a version _resolves_; it says nothing about whether the
  published thing _installs_. The smoke installs every package **from the registry**
  into a scratch dir outside the workspace with a consumer-shaped `.npmrc`, asserts
  each package's `exports` entry is really inside the tarball and non-empty, imports
  the published CLI and runs its consumer commands, and confirms
  `.claude-plugin/marketplace.json` — the pointer a `/plugin marketplace add`
  consumer follows — names the released version. `consumer:check` covers the artifact
  from **local** tarballs before the publish; this is the only step that installs what
  the registry actually serves. Self-tested (`pnpm release:smoke:test`) by planting
  each defect `npm view` is blind to: a package the install did not produce, an
  `exports` entry missing from the tarball, a zero-byte entry, a stale marketplace
  pointer, and a manifest naming zero packages (the vacuous pass).

  Two things in that step were wrong on the first cut and would each have made it
  worthless in exactly the way it exists to prevent. **The registry is mapped per
  scope, never process-wide:** the install carried a global
  `--registry=https://npm.pkg.github.com`, which makes GitHub Packages the default
  for every _transitive_ dependency too — and it does not proxy npmjs.org, so the
  install died on the first public dep
  (`E404 … GET https://npm.pkg.github.com/@hookform%2fresolvers`) and the smoke
  would have failed **every** release, after the irreversible publish. The scoped
  `.npmrc` `consumerNpmrc()` already writes is exactly what `docs/CONSUMING.md`
  hands a consumer, and is sufficient; the self-test now asserts the argv carries
  **no** bare `--registry=` and that the generated `.npmrc` contains only
  `@scope:registry=` lines. **The marketplace pointer is read from the DEFAULT
  BRANCH** over the GitHub API, not from the tag's working tree: `pnpm
version:check` in the same job has already forced that copy to agree, so the
  assertion was unfalsifiable, while a `/plugin marketplace add` consumer follows
  `main` — which § 4 pushes as a separate command and a revert can move afterwards.
  Under CI a pointer that cannot be resolved from the default branch now **fails**
  rather than falling back to the tautology, and the self-test asserts a
  default-branch pointer left on the previous version is flagged even when the
  worktree copy is on the new one.

- **The marketplace pointer is checked BEFORE the publish, not only after it
  (#106, #71).** The one post-release assertion that needs nothing the publish
  produces was reachable only from the post-release smoke — so the failure it
  exists to catch (a tag pushed without `git push origin main`, or a reverted
  version commit) surfaced once twelve immutable npm versions already existed.
  `pnpm marketplace:check` (`release-smoke.mjs --pointer-only`, two `gh api` calls
  against the default branch) now runs as a publish-only preflight in
  `release.yml`, where the fix is still "push `main` and re-tag". The smoke keeps
  its copy — the preflight saves the release, the smoke proves the end state, since
  a revert can land between the two — and both share one exported verdict
  (`judgeMarketplacePointer`) so they can never disagree. `docs/RELEASING.md` § 4
  and `/release` step 5 now state that `git push origin main` must precede the tag,
  because the preflight enforces that order.
- **The ordering invariant the release rests on is gated, not assumed (#103).**
  `release-gates:check` compared gate _sets_, which is blind to the single most
  load-bearing line in the workflow: deleting `needs: gates` from the publish job
  leaves both workflows reaching the identical gate list — parity green — while
  `pnpm -r publish` runs _concurrently_ with the battery, so a red gate stops
  nothing. The gate grew a second rung: it locates the job that runs a
  `pnpm … publish` step and the job that calls `gates.yml`, and fails unless the
  first declares `needs:` on the second. A workflow with no publish step at all
  fails too, rather than passing vacuously. Fixtures cover the deletion (asserting
  set parity stays green while the new rung fires), a `needs:` pointing elsewhere,
  the three YAML `needs:` forms including a trailing comment, and
  `publish-ready:check` not being mistaken for a publish.
- **The release notes are gated before the publish, not discovered after it
  (#106, #71).** `gh release create` lists `release/v<version>/RELEASE_NOTES.md` as a
  **required** asset, but that file only exists if `CHANGELOG.md` carries a
  `## v<version>` heading — and writing it is a manual step (`docs/RELEASING.md`
  § 2). `release-snapshot.mjs` merely warned (`! snapshot record not written`) and
  exited 0, so skipping the rename published all 12 immutable npm versions and then
  died at `gh release create`: no Release, no assets, no manifest, and neither
  post-release check ever ran — precisely the half-published failure the preflight
  block exists to prevent. New **`pnpm changelog:check`**
  (`scripts/check-release-notes.mjs`) asserts a non-empty `## v<version>` section
  and runs in `release.yml` **before** the publish, where the fix is still a commit
  and a re-tag; `release:snapshot` now **exits 1** on a record it cannot write
  instead of warning past it. The gate is release-path-only by construction (a
  feature branch correctly has no `## v<next>` heading), so its self-test
  (`pnpm changelog:check:test`) is what runs on every PR — planting the skipped
  rename, an empty section, and a heading for the previous version only.
- **The lockstep-vs-Changesets decision is written where it is cited (#104).**
  `CONTRIBUTING.md` asserted "no Changesets — that direction was considered and
  rejected (ADR 0016)", but ADR 0016 is about which _registry_ to publish to and the
  word "Changeset" appears nowhere in `docs/ADR/`. That sentence was the only record
  of the decision left in the docs corpus, and it was also the stated justification
  for de-scoping #104's and #71's Changesets acceptance criteria — a claim citing a
  source that does not support it, which is the doc-truth class `pnpm docs:check`
  exists to prevent. New **ADR
  [0020](docs/ADR/0020-lockstep-versioning.md)** records the actual decision: one
  number written by `pnpm version:set` across the derived site list, enforced by
  `pnpm version:check`, with the Changesets/independent-SemVer/manual-checklist
  alternatives weighed, the cost accepted (nothing mechanically proves a bump is a
  minor) and the reversal path stated. `CONTRIBUTING.md` now points there.
- **The release-count doc gate sees bold numbers (#295).** The rung added for the
  runbook's "all N lockstep sites" prose matched `\d+\s+lockstep sites`, which cannot
  cross the `**` in `all **16** lockstep sites` — the exact literal #295 singles out,
  and the form the runbook uses for its most load-bearing counts. Mutating
  `docs/RELEASING.md`'s bolded counts to `**17**` and `**all 99**` both left
  `pnpm docs:check` **green**, and the self-test fixture used the bold form to assert
  _zero_ violations, so it passed for the wrong reason and pinned the hole in place.
  Markdown emphasis is now stripped before matching (original line numbers kept), and
  the self-test asserts the bold **wrong** form is flagged, for all three rungs.
- **Rollback is a written procedure, not a phrase (#106, #71).** `docs/RELEASING.md`
  § 7 covers the three real cases — a bad published version (immutable: deprecate
  **every** package at that version, then patch forward; never re-tag), a bad
  plugin/marketplace pointer (it serves live from `main`, so rollback is a
  `git revert` of the version commit), and a consumer who must downgrade offline.
  The marketplace-revert path was rehearsed; the `npm deprecate` path is documented
  as un-rehearsed, since practising it needs a real bad published version.
- **Governance the repo practised but never wrote down (#64).** New
  **`.github/CODEOWNERS`** (with the honest note that branch protection is not
  available on this plan, so it buys review requests, not a gate) and new
  **`docs/DEPRECATION.md`** — how a deprecation is marked, deprecate-in-a-minor /
  remove-in-the-next-major, what a major's migration section owes, and which
  versions get fixes. `CONTRIBUTING.md` gained a "Release cadence & ownership"
  section that routes new-component admission through the existing dedupe gate and
  D4 rather than inventing an RFC process.
- **Stale governance artifacts fixed, with teeth (#64).** `PROJECT.md` no longer
  lists "releases via Changesets" as a future (lockstep publishing shipped; ADR
  0020 records the rejection). The PR template no longer asks for "all six themes
  (…, light, dark, high-contrast)" and no longer enumerates gates that drift — it
  points at `gates.yml`. `pnpm docs:check` now derives the allowed theme count from
  `THEMES` in `packages/tokens/src/theme-types.ts`, catches the **numeric** form
  (`6 themes`) the old word-only regex missed, and scans `.github/**` — which found
  three more stale claims. `docs/ADR/` is exempt (a dated record of what shipped
  then), and so are the four **generated, git-ignored** per-harness skill mirrors
  (`.cursor/`, `.gemini/`, `.agents/`, `.github/skills/`): scanning `.github/skills`
  made `pnpm docs:check` red on a clean tree the moment `pnpm skills:build` had run,
  holding generated output to a stricter standard than the canonical `skills/**` it
  is built from. `docs/RELEASING.md`'s "Actions spending limit" blocker note is
  removed: the workflow ran end-to-end on 2026-08-01.

### `@elabs-ai/components-ai`

- **`ChatGreeting` (#254).** The centered first-run chat/composer greeting —
  a display-scale headline (`title`, then `subtitle` + a `text-primary`
  `accent` phrase) over an optional soft primary glow — extracted from the
  greeting scene that was duplicated inline across the `Composer` and
  `AI Composer` block stories. Renders through the shared `Heading` primitive
  (so it carries the `--font-display` brand seam) and exposes `level` so it
  can sit under a page that already owns its own `<h1>`.
- **`PromptInput` gains a `tone` prop (#254).** `tone="surface"` (default,
  unchanged) is the standard muted composer well; `tone="card"` renders a
  `bg-card` well for nesting inside an already-tinted outer frame — the
  "double card" look. The well's fill is theme-driven, not universally
  "white": raised (lighter than the outer `bg-surface-muted` frame) on light
  themes, recessed (darker) on dark and blueprint — still a legible,
  distinct tone in every theme. `InputGroup` (`@elabs-ai/components-ui`)
  gains the backing `variant="card"`. `Composer` gains the matching `tone`
  prop (default `"surface"`, unchanged) so the reference tinted-outer/
  distinct-inner arrangement (`tone="card"`) is reachable from the canonical
  chat input, not only the raw `PromptInput` — demoed in
  `Patterns/Blocks/AI Composer`.

### Fixed

- **`LineChart`/`AreaChart`/`ScatterChart` (and `AutoChart` for both) no longer
  crash on a non-Date `xDataKey` value (#352).** A categorical x value (e.g. a
  turn/step label) coerced to an Invalid Date used to throw
  `RangeError: Invalid time value` from THREE independent, un-synced call
  sites: the `LineChart`/`AreaChart` axis-label memo, the identical memo in
  `ScatterChart`'s shell, and `XAxis`'s own `buildDomainTicks` (reachable via
  ScatterChart's default, un-degrading `Math.min`/`Math.max` domain — unlike
  the NaN-skipping `extent()` LineChart/AreaChart use — and hit by
  `AutoChart`'s scatter branch, which always mounts a default `<XAxis />`).
  All three are guarded now.
  - When ONLY SOME x values are invalid, the chart still renders normally with
    a text fallback (the raw x value) for the affected point(s) — unchanged
    from the original fix, still degenerate/time-based positioning; use
    `BarChart` for a genuinely categorical x dimension.
  - When NONE of the x values are Date-coercible, `LineChart`/`AreaChart` no
    longer draw a blank, degenerate SVG with every axis label overprinted on
    the same pixel — there is genuinely no usable time scale, so they render
    `ChartFallback` (the same "nothing to show" panel `AutoChart` already uses
    for bad/empty data, promoted to a shared `charts/chart-fallback.tsx`
    module so the cartesian shell can reach it without a package-internal
    import cycle). A one-time dev `console.warn` still explains why.
- **Two bugs in the manifest's dependency-free prop-table extractor**
  (`packages/cli/lib/core.mjs`, found/fixed while regenerating the manifest for
  the #269 rollout above): (1) `leadingDoc`'s block-comment regex matched from
  the FIRST `/**` in the preceding source rather than the nearest one, so two
  adjacent documented members spliced together (one member's description
  absorbed the other's doc block plus the bare declaration line between
  them); (2) `matchDelim` (and `splitMembers`) tracked string-quote state
  across the RAW source including comments, so a prose apostrophe inside a
  JSDoc/`//` comment (e.g. "isn't") was read as OPENING a string literal —
  corrupting brace-depth tracking for the rest of the file and silently
  dropping the **entire** prop table (`{ props: [] }`) for any component
  documented with a contraction. Both are fixed (comments are now skipped,
  not string-scanned, during delimiter/member matching — the original text is
  still returned untouched for `leadingDoc` to read), each with a regression
  test in `packages/cli/test/proptable.test.mjs`. Regenerating the manifest
  surfaced and cleaned up several other components' previously garbled or
  silently-empty prop tables (e.g. `PromptInput`, `ContextPanelBody`,
  `Gallery`, `ChatShell`, `AgentStep`, `PartGroup`) as a side effect.
- **`CodeBlock` syntax highlighting is derived from `--code-*` tokens, not a
  hardcoded `github-light`/`github-dark` Shiki theme, and now respects
  region-scoped themes too (#315).** Every theme block gets a `--code-*`
  syntax-token set (background/foreground + 9 hue roles), mirrored into the
  DTCG token source (`packages/tokens/tokens/themes/*.tokens.json`) alongside
  the existing `--calc-*` roles so the design-tool handoff and
  `pnpm tokens:check` stay authoritative for them. `CodeBlock` resolves its
  Shiki theme from the NEAREST `data-theme` ancestor — not always
  `document.documentElement` — so a code block nested inside a region-scoped
  `<div data-theme="dark">` (a supported `ThemeProvider`/decorator
  pattern) now picks up that region's palette instead of the document root's.
  `highlightCode`'s `callback` parameter stays in its original third position
  (no positional break for existing callers); the new theme-scope element is
  an additive fourth parameter.
- **Iteration node menu — right-click + `⋯`, and guided `/iterate` `/pivot`
  (#223).** The `:::iterate` / `:::pivot` node-view's `⋯` button is now a full
  menu — "Edit iteration…", "Change layout" (a submenu of radio items),
  "Transpose" (pivot only), and "Convert to static" — and the identical item
  list also opens on right-click, so the two surfaces can never diverge.
  `DropdownMenu` (`@elabs-ai/components-ui`) gains the `Sub` /
  `SubTrigger` / `SubContent` / `RadioGroup` / `RadioItem` / `CheckboxItem`
  parts `ContextMenu` already had, so both menus share one shape.

### Changed

- **`/iterate` and `/pivot` now open the guided builder instead of inserting a
  bare directive — but ONLY when a consumer has wired an
  `IterationEditContext` handler** (`IterationBuilderProvider` /
  `IterationTemplateProvider`, e.g. a consumer workbench app's write-mode
  `MarkdownWorkspace`, #223). With no handler wired, both commands fall back
  to today's direct-insert behaviour unchanged — this is an opt-in surface,
  not a breaking change for consumers who haven't adopted the provider.

### Fixed

- **The iteration node menu's "Edit iteration…" round-trips losslessly, and
  "Transpose"/"Convert to static" no longer silently no-op (#223).** The `⋯` →
  "Edit iteration…" dialog's save path now MERGES the guided builder's
  write-back into the directive's existing attributes (instead of replacing
  the record wholesale), so a consumer's own attributes (e.g. `source`/
  `region`) survive editing — mirroring the earlier `transpose()` fix.
  "Transpose" is now disabled (with the reason folded into its own visible
  label, e.g. "Transpose — needs embedded values") for a pivot whose rows/cols
  aren't embedded in its attributes, so it can no longer write bare `rows`/
  `cols` flags as a visual no-op. Both "Transpose" and "Convert to static"'s
  disabled reason now lives in the item's rendered text rather than a `title`
  attribute — a disabled Radix menu item is `pointer-events-none` (no hover
  tooltip can ever fire) and is skipped by keyboard focus, so `title` was
  unreachable by any input modality.

- **Streamdown's own chrome is localizable (#310).** `MessageResponse`,
  `ReasoningContent`, and `MarkdownView` now pass Streamdown a `translations`
  map resolved through `useLocale()`, so a `<LocaleProvider>` no longer stops at
  the markdown boundary — "Copy Code", "Download diagram", "Copy table",
  "You're about to visit an external website." and 25 more labels are
  overridable via the new `ai.streamdown.*` keys. English defaults are
  byte-identical to streamdown@2.5.0's, so nothing changes for consumers who
  override nothing.

### Test & CI

- **axe now fails the build, on a ratchet** (#78 AC3, #316).
  `apps/docs/.storybook/preview.tsx` sets `parameters.a11y.test: "error"`, so
  `@storybook/addon-a11y` asserts `toHaveNoViolations()` on every story and any violation
  reds the (blocking) `storybook` CI job — a new component can no longer ship an unnamed
  button with green CI. The 200 stories that were already violating are exempted per story
  from the **generated** `scripts/a11y-baseline.json` (187 measured in one full run, plus 13
  Monaco-mounting stories that violate intermittently), so `main` does not go permanently
  red; `pnpm a11y:baseline:check` (self-tested, in CI) keeps that list generated, keeps
  the preview.tsx wiring in place, refuses to let the ceiling grow, and — with a
  measurement run present — fails on any violating story that is not baselined. Re-measure
  with `pnpm a11y:baseline:run`, then `--update` (`--prune` ratchets down). Verified by a
  full run: **234 story files / 787 tests green with axe blocking.** The CI job's name goes
  back to `Storybook interaction + axe`, which is now true.
- **The Storybook interaction-test job is now blocking** (#280). `continue-on-error: true`
  and its undated TODO are gone. Branch protection can't be made a required check on this
  repo's plan (the `format:check` constraint from #239), so the teeth are the red X on the
  PR. The job itself has since moved out of `.github/workflows/ci.yml` into the shared
  `.github/workflows/gates.yml` (#103, Unreleased), so the release tag path runs it too.
- **Fixed the last flaky story** (#51). `Editor/CodeEditor` → "Context menu + minimap"
  raced Radix `ContextMenuContent`'s `fade-in-0` entrance: `findByRole` retries until the
  node _exists_, not until it is painted, so the one-shot `toBeVisible()` landed inside
  the fade window ~40% of the time. Both assertions now go through `waitFor`, matching the
  `dropdown-menu.stories.tsx` precedent. This was the precondition for the promotion above.
- **The Playwright Storybook smoke sweep stops manufacturing false positives** (#278).
  Its "did it render?" probe asserted `toBeVisible()` on the first `#storybook-root` child,
  which three legitimate stories can never satisfy (two zero-size motion probes, and
  `input-otp`, whose first child is a `<noscript>`). It now skips non-rendering node types
  and asserts _attached_, not painted. The sweep also no longer re-judges play-function
  assertions: `viewMode=story` auto-runs plays, so their throws were being graded a second
  time under different timing guarantees — the addon-vitest job is the single source of
  truth for play functions; this sweep judges mount + console health.
- **The cross-theme AA evidence is committed, and checkable** (#78, #59/WP-02).
  `apps/e2e/reports/theme-aa-audit.md` is a **generated, stale-gated** artifact
  (`pnpm audit-artifact` / `audit-artifact:check`, self-tested) computing every token
  pairing from `themes.css` — replacing `charts-aa-2026-06-07.md`, which documented two
  deleted themes for months because nothing checked it. Its rendered sibling,
  `apps/e2e/reports/visual-ux-2026-08-01.md`, is a real browser sweep (Playwright + axe
  4.12, oklch-aware numeric contrast) of 11 real screens × 3 themes, and now ships its raw
  per-run data as `visual-ux-2026-08-01.sweep.json` so every count in it is recomputable.
  One new finding was filed from it: **#321** (`--destructive-foreground` on
  `--destructive` in dark = 3.02:1). Smoke tests were added for the five
  `@elabs-ai/components-data` surfaces and five `@elabs-ai/components-ai`
  surfaces.

### `@elabs-ai/components-tokens`

- **Ground fade — a new opt-in decoration gesture (#257).** `data-decoration-fade="top|bottom|edges|center"`
  on any region fades the ambient graph-paper ground out across it instead of ruling
  it edge to edge. It is part of the decoration system, not a second background: it
  paints the same `--bp-grid` on a decorative `::before` layer and masks THAT, so the
  ink still rides the `--decoration` dial and the gesture is completely **inert at
  decoration 0** (light / dark render unchanged). The faded region owns its
  ground — the host **and its descendants** are excluded from the plain-grid rule, so
  a nested surface can't punch a crisp rectangle into a faded field. New tokens:
  `--bp-fade-top` / `--bp-fade-bottom` / `--bp-fade-edges` / `--bp-fade-center` and the
  `--bp-fade` default. Adopted on the marketing landing template's hero band.
- **The ground grid no longer pins on touch (#29).** `background-attachment: fixed` —
  what makes the grid read as ONE continuous sheet across panels — is now gated to
  `@media (hover: hover) and (pointer: fine)`. A fixed layer can't be composited with
  scrolled content, so every scroll frame repainted the viewport on touch devices
  (and iOS Safari ignored it inside scroll containers anyway). Touch keeps the grid;
  it simply scrolls with the element.
- **A documented browser floor, with a designed degradation (#29).** The decoration
  inks use relative color syntax (`oklch(from … l c h / α)`), the one feature in the
  system with a support floor (Chrome/Edge 119, Safari 16.4, Firefox 128). Below it,
  an `@supports not (color: oklch(from …))` block now pins the fallback — no ink, no
  grid, no hatch — instead of failing unpredictably at computed-value time. The floor
  is written down in the new [`docs/BROWSER-SUPPORT.md`](./docs/BROWSER-SUPPORT.md).
- **Fixed: `THEME_META.blueprint.decorationLevel` said `2`, the theme renders `10`.**
  `ThemeProvider` derives `effectiveDecoration` from `THEME_META`, so every UI that
  reads the dial (the new playground slider) showed "Theme default (2)" on a screen
  rendering the full dial-10 texture. A new `theme-decoration-parity` test parses each
  theme block's `--decoration` out of `themes.css` and asserts it equals `THEME_META`,
  so the two can't drift again.

### `@elabs-ai/components-ui`

- **`Slider`'s accessible name now lands on the thumb.** Radix puts `role="slider"` on
  the thumb, so an `aria-label` / `aria-labelledby` passed to `<Slider>` used to sit on
  a root element that assistive tech never reads as the widget; both are now forwarded
  to the thumb. **DOM change** for consumers asserting the attribute on the root (the
  public prop is unchanged). `SliderProps` is now exported.
- **`Toaster` merges a consumer's `toastOptions` into the library defaults instead of
  replacing them (#362).** Previously `toastOptions={{ classNames: { toast: "…" } }}`
  shallow-replaced the whole `classNames` object, silently dropping the default
  `description`/`actionButton`/`cancelButton` token classes. Each key is now merged via
  `cn()` — a consumer's override extends the default class string instead of erasing it.
  `<Toaster />` with no `toastOptions` is unchanged. `sonner.tsx` reorders the
  `ToasterProps` type alias to sit directly above the `Toaster` function (no behavior
  change) — the manifest crawler's structural prop-table extractor was reading past the
  alias's trailing `;` to the next `{` it found (the unrelated `DEFAULT_TOAST_CLASS_NAMES`
  object literal) and fabricating a bogus `Toaster` prop interface from its keys; moving
  the alias removes any `{` between the declaration and `Toaster`'s own body, so the
  extractor correctly finds nothing to synthesize.
- **`Combobox` gains `disabled`, an accessible-name passthrough, and a `triggerProps`
  escape hatch (#343, #347).** `disabled` forwards to the trigger `Button` (native
  `disabled` semantics — untabbable, doesn't open on click/Enter/Space) and gates the
  popover's `open` state so it can't be forced open while disabled. `aria-label` /
  `aria-labelledby` / `id` name the trigger's PURPOSE, independent of the selected
  value's own text. `triggerProps` is a spread escape hatch (the trigger `Button`'s own
  props, minus `role`/`aria-expanded`/`disabled` — those stay component-owned — plus a
  `data-*` index signature) for anything else (`data-testid`, `name`, …). `Combobox` is
  now `forwardRef` (forwards to the trigger button element) to match its sibling form
  primitives. `SelectTrigger` drops its `disabled:cursor-not-allowed` override so its
  disabled cursor now matches `Combobox`'s `Button`-based trigger (both compute
  `cursor: default`, per `interaction-guidelines.md`'s "disabled controls keep the arrow
  automatically") — the two pickers now render an identical disabled cursor, closing the
  remaining cursor-parity gap from #343.
- **`Checkbox`'s `indeterminate` state is now visually distinct from `checked` (#348).**
  The indicator renders both a `Check` and a `Minus` (lucide) glyph and toggles which is
  shown purely via CSS (`group-data-[state=indeterminate]:`), mirroring the
  `data-[state=checked]:` pattern already used on the root — no new render branch,
  `aria-checked="mixed"` (Radix-managed) is unaffected.
- **`Progress` gains a `variant` tone axis — `"default" | "success" | "warning" |
"destructive"` (#358).** The indicator fill now reuses the `StatusBadge`/`Alert`
  success/warning/destructive token vocabulary instead of always rendering
  `bg-primary`, so a tripped guardrail (a token budget, a cost cap) can be signalled by
  the bar itself. Default is unset/`"default"` (`bg-primary`, byte-identical). Pair a
  non-default tone with `aria-valuetext` (passes straight through to the underlying
  `role="progressbar"`) so the state isn't color-only — non-text contrast of the fill
  against the `bg-muted` track, re-measured in a real browser after #381 landed, now
  clears 3:1 for ALL FOUR tones in both painted themes (light 4.09 / 5.19 / 4.44 /
  4.94; dark 7.17 / 9.07 / 7.88 / 4.79). `warning` was the one hole (1.88:1 in
  light) and it was a `--warning` token-value gap, not a component one — fixed at
  the token by #381 rather than patched here. In
  `blueprint`, `decoration.css` turns all four filled tones into an identical DRAWN
  control (transparent fill + hairline border) — there is no painted fill to measure
  there, so the tone must be read from `aria-valuetext`/a label, not the fill. `Progress`
  also gains `progressIndicatorVariants` (exported for composition) and `ProgressProps`
  (exported for consumers), both now re-exported from the component's `index.ts`.

### `@elabs-ai/components-blueprint`

- **`GridPaper`'s `fade` prop is widened to `boolean | GridPaperFade`** (`"top" |
"bottom" | "edges" | "center"`), sharing the `--bp-fade-*` shapes with the ambient
  region hook so a hand-placed grid and a faded region read as one gesture. `true`
  still means the historic edge vignette — no behaviour change for existing callers.
  `GridPaperFade` is exported.

### Repo

- **New CI gate `pnpm decoration:check`** (self-tested via `decoration:check:test`) —
  fails if `background-attachment: fixed` escapes the pointer-device media query, if
  the ground fade masks the host instead of its `::before` layer, if a faded region or
  its descendants are re-ruled by the plain-grid rule, if a consumed `--bp-fade-*` is
  undeclared, or if the relative-color inks lose their `@supports` fallback.
- **Playground: a decoration dial (0–10 + "follow theme") in settings (#31)**, mirroring
  the motion-preference control.

### Docs — consumer-facing honesty about hosting + install (#264, #265)

- **Registry (#264):** the registry is **self-hosted** and now says so everywhere.
  `registry/registry.json`'s placeholder `homepage` (`https://example.internal/brand-ui`)
  is replaced with the real repo URL; `README.md`, `docs/REGISTRY_GUIDELINES.md` and the
  generated `llms.txt` describe the two real copy-own paths (build + serve the JSON from a
  host you control, or copy `registry/blocks/<name>/` source) instead of implying a hosted
  `/r/*.json` endpoint. New teeth: `pnpm registry:validate` fails on a placeholder /
  non-`https://` / missing `homepage`, self-tested via `pnpm registry:validate:test` (wired
  in CI).
- **CLI install precondition (#265):** every consuming-project
  `npx @elabs-ai/components-cli …` / `npx brand-ui …` example now carries its
  precondition — the CLI is a **private GitHub Packages** dependency needing an `.npmrc`
  scope mapping + a classic PAT with `read:packages` (`docs/CONSUMING.md` §1 + §7a) — and
  prefers the install-first `pnpm exec brand-ui <cmd>` form. Stale post-v2.0.0 "release
  tarball" / "not on npm either" claims in `GettingStarted.mdx` and the agent-kit README are
  corrected to GitHub Packages, and the plugin's `npx -y … mcp` MCP wiring is documented as
  auth-dependent rather than "no install needed". New teeth: `pnpm docs:check` rule 6 fails
  on a bare consuming-project `npx` line with no precondition cue in the same file — matching
  **both** the scoped package name and the `brand-ui` bin alias, over the union of the
  authoritative docs and the agent surfaces (`docs/**`, `skills/**`, `agents/**`,
  `.claude/agents/**`, `apps/docs/stories/**`); `pnpm docs:check:test` gained fixtures for
  the alias form plus a planted-tree scope test so the scope can't silently narrow again.

### The documented CSP now executes (#314)

`docs/CSP-AND-NETWORK.md` described what breaks under a strict Content Security
Policy, but nothing in the repo ever ran under one — so the guidance could only be
verified by hand, and only by someone who already knew the traps. `apps/playground`
now **serves a real `Content-Security-Policy` response header** in both `vite dev`
and `vite preview` (`apps/playground/csp-policy.json` → the `brand-ui-csp` plugin in
its `vite.config.ts`), and `apps/e2e/tests/csp.spec.ts` fails the build on any
violation the browser reports.

- **Fixed — `@elabs-ai/components-editor/monaco-environment` now
  de-duplicates Monaco's Trusted-Types policies.** `monaco-editor@0.55` ships the
  "mint `defaultWorkerFactory` at module init" block in two different source files,
  so it runs twice in the main thread — in dev **and** in a production Rollup build
  — and the second call is refused under `require-trusted-types-for 'script'`. The
  module now installs a memoizing `MonacoEnvironment.createTrustedTypesPolicy` hook,
  so consumers do **not** need `'allow-duplicates'` (which would let any script
  re-register any policy name). See `docs/CSP-AND-NETWORK.md` §2.6.
- **Carved out, not fixed — `style-src 'unsafe-inline'` is required in production.**
  React writes a `style` attribute for every `style={{…}}` prop and React Flow, Radix
  and Recharts all depend on it; measured on the production build, tightening it to
  `style-src 'self'` blocks 276 inline styles (54 distinct) on one walkthrough. It is
  documented as a named carve-out rather than quietly absorbed — as are `img-src
data:`, `script-src 'wasm-unsafe-eval'` (Rive/`Persona`), and the `trusted-types`
  allowlist (`dompurify`, `default`, ten Monaco names). Three of the five are
  droppable by not rendering the feature that needs them.
- **New gate `pnpm csp:check`** (+ `csp:check:test`, both in CI) — the served policy
  must stay byte-identical to the blocks published in `docs/CSP-AND-NETWORK.md` §2.7,
  every relaxation needs a named carve-out, no carve-out may name a source the policy
  no longer contains, and both the dev and preview servers must send the header. The
  failure mode it exists to stop is silent widening.
- `docs/CSP-AND-NETWORK.md` gains §2.5 (why a narrow `default` Trusted-Types policy
  is unavoidable if you render Mermaid — and why a pass-through one is not
  acceptable), §2.6 and §2.7.
- **`@elabs-ai/components-charts`: Sankey links no longer re-measure on
  every render** (#185). `AnimatedLink`'s `useLayoutEffect` had no dependency array,
  so `getTotalLength()` — a forced layout read — ran for every link on every
  hover/fade re-render. It is now scoped to `[path]`, the sole geometry input.

### Changed

- **Inert `biome-ignore` directives are gone, and can't come back.** This repo lints
  with ESLint 9, not Biome, so a `biome-ignore` comment silenced nothing while
  reading like a reviewed suppression. All 49 across `packages/charts/src` are now
  real `// eslint-disable-next-line <rule> -- <reason>` comments (or deleted, where
  the named Biome rule has no enabled ESLint equivalent), and a new
  `pnpm biome-ignore:check` gate (self-tested, wired in CI) fails the build on any
  new one. The five local `type CurveFactory = any` aliases collapse into one shared
  `CurveFactory` type derived from `@visx/curve`.
- **`react-hooks/exhaustive-deps` and `@typescript-eslint/no-explicit-any` are
  errors in `@elabs-ai/components-charts`** (`packages/charts/eslint.config.js`).
  CI runs a bare `pnpm lint` with no `--max-warnings`, so at the shared preset's
  `warn` level these would keep accreting silently. This is the alternative #185's
  own AC permits; the `--max-warnings=0` flip it preferred is blocked by 39 residual
  `brand/no-raw-font-size` + `brand/no-raw-color` warnings, which are a separate debt
  class postdating the issue and are now tracked in #319 (it owns the flip). #185's
  AC#1 was amended on the issue accordingly, so charts lint is clean of every rule
  class #185 diagnosed but is not yet at a zero warning count.

## v2.0.0 — 2026-08-01

### ⚠️ BREAKING: every package is renamed, and they now publish to a registry

`@brand/<pkg>` → **`@elabs-ai/components-<pkg>`**, for all 11
component packages plus the CLI.

**Why:** brand-ui is now distributed as **private npm packages on
[GitHub Packages](https://npm.pkg.github.com)** instead of tarballs copied by
hand. GitHub Packages only accepts packages whose npm scope equals the
repository owner, and `@brand` is a scope nobody owns — so the rename is not
cosmetic, it is the precondition for publishing at all. The name carries the
repo so it stays collision-free inside a scope shared by every repo in the org.

**Migrating a consumer:**

1. Add the registry + auth (a classic PAT with `read:packages`) — see
   [`docs/CONSUMING.md`](./docs/CONSUMING.md).
2. Replace the `file:vendor/…` dependencies with real ranges, e.g.
   `"@elabs-ai/components-ui": "^1.10.0"`.
3. **Delete the entire `pnpm.overrides` / `resolutions` mirror block.** It only
   existed because `workspace:*` peers in a hand-copied tarball had nothing to
   resolve against. Real registry resolution removes the need — this was the #1
   consumer pain point.
4. Update imports: `@brand/ui` → `@elabs-ai/components-ui`.
5. Update the Tailwind `@source` lines to the new `node_modules` paths.

Entries for released versions below intentionally keep the old names — v1.9.0
really did ship `@brand/ui`.

### Release pipeline

- **`/release <version>`** and `.github/workflows/release.yml` — publishing is
  now CI's job, triggered by a `v*` tag, authenticated with the repo's own
  `GITHUB_TOKEN`. No maintainer needs a `write:packages` token, and no publish
  can originate from an unverified working tree.
- **`pnpm version:set` / `version:check`** — one writer for the lockstep version
  across all **16** sites (the old hand-edit checklist listed 15 and had
  undercounted). Sites are derived, so a new package joins automatically.
- **`pnpm publish-ready:check`** — a preflight that refuses to tag when the
  scope, `private` flag, `repository` or `publishConfig.registry` would make the
  publish fail. npm versions are immutable, so a half-published release cannot
  be undone.
- **`pnpm consumer:check`** — packs every package, installs the tarballs into a
  throwaway Vite app and builds it. The only check in the repo that consumes
  `dist/` the way a consumer does.

---

Fixes for a downstream consumer report (a workbench app) against the shipped
tarballs. Items are grouped by the package a consumer feels them in.

### `@brand/tokens`

- **Fixed: self-hosted fonts shipped at the wrong path, so every consumer
  rendered in fallback fonts.** The build's `cp -r src/fonts dist/fonts` was not
  idempotent — `tsup`'s `clean` removes files but leaves empty directories, so
  from the second build onward the fonts nested at `dist/fonts/fonts/…` while
  `dist/themes.css` still referenced `./fonts/inter/…`. Nothing failed; the text
  just silently fell back. The copy now clears `dist/fonts` first.
- **Fixed: `@import "tw-animate-css"` in the shipped CSS resolved to a
  devDependency**, so installing the tarball hard-failed the consumer's whole CSS
  build (module not found) rather than merely degrading. `tw-animate-css` is now
  a real **dependency** of `@brand/tokens` (it is an implementation detail of the
  motion system — you do not install it), and its range is corrected to `^1.4.0`,
  which is what ADR 0005's retiming actually requires; `^1.0.0` would have
  silently dropped motion gating.
- **New peer dependency: `tailwindcss` `^4`.** The shipped CSS has always done
  `@import "tailwindcss"`; the manifest now says so. Every consumer already
  installs it for `@tailwindcss/vite` / `@tailwindcss/postcss` — declaring it a
  peer (not a dependency) keeps it a single instance and turns an opaque
  mid-CSS-build resolve error into a legible peer warning.
- **New gate `pnpm css-assets:check`** (self-tested, blocking in CI after
  `build`): every relative `url()`/`@import` in a stylesheet a package exports
  must resolve in the artifact that ships, and every bare `@import` must name a
  `dependency`/`peerDependency`. Both bugs above are locked as fixtures.

### `@brand/ai`

- **Fixed: `Composer`'s Stop affordance was invisible.** `PromptInputSubmit`
  renders `children ?? <status glyph>`, and `Composer` passed `<ArrowUp/>`
  unconditionally — so the send button showed an up-arrow in every state. `onStop`
  was always wired, which made this worse than a dead control: the Stop was live
  but looked like Send. `Composer` now yields the slot once generating/errored, so
  the spinner / stop square / error glyph render. `PromptInputSubmit`'s `children`
  is documented as replacing the glyph for **every** status.
- **Fixed: `PromptInput` submitted empty messages.** A bare Enter fired
  `onSubmit({ text: "", files: [] })`. Three separate defects: `handleSubmit` had
  no emptiness guard; the Enter handler's only bail read `disabled` off a button
  nobody ever disabled; and that lookup used `button[type="submit"]`, which
  matches nothing while generating (the button flips to `type="button"`), so Enter
  could send a second message mid-stream. Now: submit-readiness is lifted into
  `PromptInput`, the guard runs **before** the form reset (a later one would still
  have wiped the composer), and the Enter lookup keys off
  `[data-slot="prompt-input-submit"]` + `data-generating`.
  **An attachments-only message (no text) is still a legitimate submit.**
- ⚠️ **Behavior change.** (a) `onSubmit` no longer fires for an empty composer;
  (b) `PromptInputSubmit` renders **disabled at rest** inside a `PromptInput`
  until there is text or an attachment — visible in every `Composer` surface,
  including the playground and the scenario stories; (c) Enter no longer submits
  while `status` is `submitted`/`streaming`. An explicit `disabled` prop still
  wins, `error` stays clickable to retry, and a `PromptInputSubmit` rendered
  outside a `PromptInput` is unaffected.
- New `SendStates` story on `Composer` exercising ready-disabled → submitted →
  streaming(stop) → error in one frame.
- **`ReasoningContent` now takes `ReactNode`, not `string`.** A string is still
  parsed as streamed markdown; any other node renders as-is, so a structured live
  reasoning ledger (timeline, per-step status) can live inside the disclosure
  without being handed to a markdown parser. Pure type widening — existing string
  call sites are untouched. (An array of strings is not a `string` and renders
  raw; pass one string for markdown.) New `StructuredLedger` + `Streaming` stories.
- **`InlineCitation` sources no longer have to be URLs.**
  `InlineCitationCardTrigger` did `new URL(sources[0]).hostname`, so any non-URL
  string threw a `TypeError` — and with no error boundary in `@brand/ai` that took
  down the whole message subtree. Sources are now
  `string | { id?, label?, url? }`: a non-URL string renders verbatim, `label`
  wins over a derived hostname, and parsing never throws. `EvidenceChip` inherits
  it. New `inlineCitationSourceLabel` helper + `NonUrlSources` story. Consumers no
  longer need to synthesize fake URLs for warehouse tables or document ids.
- **`Message` and its parts now carry `data-slot`** (`message`, `message-content`,
  `message-header`, `message-avatar`, `message-actions`, `message-action`,
  `message-branch*`, `message-response`, `message-toolbar`) plus `data-role` on the
  root — stable selectors for e2e tests, matching the convention `plan.tsx` /
  `context-panel.tsx` already use. `UserMessage`/`AgentMessage` deliberately share
  the `message` root slot (they are presets); `data-role` disambiguates. The
  `is-user`/`is-assistant` classes are retained and load-bearing — `MessageContent`
  styles the user turn through `group-[.is-user]:` selectors.
- **Mermaid (and its d3 + DOMPurify tail) no longer ships in the entry chunk.**
  `@brand/ai` statically imported `@streamdown/mermaid` from three modules; since
  none of those packages declares `sideEffects`, several MB rode into every
  consumer's entry chunk whether or not they ever rendered a diagram.
  `_lazy-mermaid.ts` provides a drop-in `DiagramPlugin` that `await import`s the
  engine inside `render()` — Streamdown only calls `getMermaid()` from its async
  render path, so the plugin is present from the first frame and **there is no
  render flash**. Measured on `apps/playground`: entry chunk **6,231,119 →
  5,643,544 B**, with mermaid/d3 moving to a lazily-fetched `mermaid.core-*.js`.
  New opt-in `preloadMermaid()` warms the engine for surfaces that know they need
  it. `mermaid` becomes a direct dependency (it was transitive, which a dynamic
  import cannot resolve under pnpm). See ADR 0019 (renumbered from 0016, which
  collided with the distribution-via-GitHub-Packages ADR).
  _Note:_ DOMPurify still appears in the playground entry chunk from an unrelated
  path — `monaco-editor` vendors its own copy, reached via `@brand/editor`.
- **New gate `pnpm heavy-deps:check`** (self-tested): a new static import of a
  heavy engine (mermaid, Rive, xterm, React Flow, media-chrome) under
  `packages/ai/src` fails CI. `import type` is exempt, and a module tagged
  `@lazy-boundary` may hold the static import — with a second rule asserting
  nothing imports _it_ statically, so the marker can't become a rubber stamp.
  Existing sites are a ratchet baseline that only goes down.
- **Remote origins are now avoidable, and never fail to a broken box.**
  - `ModelSelectorLogo` gains `src` (self-host the logo) and `fallback`. Its props
    previously did `Omit<…, "src">` **and** spread props before `src=`, so a
    consumer behind an `img-src` CSP had no way to win. A failed load now renders
    a neutral glyph instead of a broken image.
  - `Persona` gains `src` (self-host the `.riv` artwork) and `fallback`, and
    exports `PERSONA_SOURCES`. `onLoadError` was previously a bare passthrough
    that rendered nothing, so a CSP-blocked fetch left an empty 64 px box forever;
    it now falls back to a token-driven orb. The Rive WebGL2 runtime also moved
    behind `lazy()`, so it no longer sits in the entry chunk of consumers who
    never render a `Persona`.
  - Both components gained their first stories; the **default** story of each is
    the offline/blocked state, so neither CI nor the visual sweep depends on a
    third-party origin being up.
- **New doc `docs/CSP-AND-NETWORK.md`** — every remote origin with its CSP
  directive and escape hatch, the Trusted-Types situation, and an offline
  checklist. Linked from `docs/CONSUMING.md` §7 and the new `packages/ai/README.md`
  (the package had no README at all).
- **Trusted Types:** two transitive markdown dependencies
  (`decode-named-character-reference`, `hast-util-from-html-isomorphic`) select
  `innerHTML`/`DOMParser` builds via their `browser` export condition, which blanks
  any message containing `&amp;` under `require-trusted-types-for 'script'`. A
  library cannot fix this — it is export-condition selection in the consumer's
  bundler, which no package manager override can change. The alias snippet is
  published in the new doc and **dogfooded** in `apps/playground` and `apps/docs`.
  Measured: the DOM builds are selected in Vite's dev pre-bundle for both packages
  and in the production build for `hast-util-from-html-isomorphic`; with the
  aliases, neither appears in either mode.
- **New gates** `pnpm origins:check` (every `https://` origin in shipped source is
  allowlisted **and** documented — it caught three origins the report missed,
  including `basemaps.cartocdn.com` in `@brand/maps`) and `pnpm tt-aliases:check`
  (the published alias snippet stays dogfooded **and** is verified against
  `node_modules` to actually resolve to the DOM-free build). Both self-tested.

### i18n / microcopy

- **The locale seam is now actually used.** `LocaleProvider`/`t()` shipped in
  ADR 0014 but was called by **zero** components, so all `@brand/ai` microcopy was
  hardcoded English. Every `aria-label` and `placeholder` in `@brand/ai` — plus the
  three end-user attachment **error messages** — now routes through `t()`.
  `useLocale()` is **provider-optional**, so this needs no `<LocaleProvider>` and
  is **not a breaking change**: every default is byte-identical to the literal it
  replaced (asserted by tests, and by the existing suite continuing to pass).
- `DEFAULT_MESSAGES` grows 10 → 32 keys. Generic keys stay bare and are **reused**
  — this closes the gap where `inline-citation` hardcoded `"Previous"`/`"Next"`
  and `artifact` hardcoded `"Close"` while `previous`/`next`/`close` already
  existed. Package microcopy is namespaced `ai.<area>.<key>`. See **ADR 0017**,
  which also resolves the open question left in ADR 0014 §(c).
- Fixed a latent bug found on the way: `PromptInput`'s three attachment error
  messages were **duplicated** across the `addLocal` and provider-validation
  branches, so a change to one silently diverged from the other.
- **New gate `pnpm microcopy:check`** (self-tested): a per-file ratchet over
  hardcoded `aria-label`/`placeholder`/`title`/JSX-text. Counts only go down;
  `// i18n-exempt: <reason>` covers brand names. It immediately caught one
  placeholder this change had missed (`MessageForm`'s "Select…").
- Known remaining: 177 hardcoded strings repo-wide (32 in `@brand/ai`, mostly JSX
  text nodes and default props), held by the ratchet. Plus a surface the original
  report could not see — `Streamdown` accepts a `translations` prop with **32
  keys** that `@brand/ai` passes nothing for, so every streamed-markdown surface
  still leaks that microcopy. Both are tracked follow-ups, not silently dropped.

### Accessibility follow-ups (from the pre-merge a11y review)

- **`PromptInputSubmit` uses `aria-disabled`, not the native `disabled`.** The
  first cut disabled the button natively when there was nothing to send — but a
  focused control that becomes natively disabled is removed from the focus order
  by the HTML focus-fixup rule, so focus dropped to `<body>` after _every_
  keyboard-initiated send, silently stranding keyboard and screen-reader users
  mid-conversation. It is now a real, focusable tab stop that still announces its
  state; `handleClick` + the `handleSubmit` guard do the actual blocking. This
  also resolves the conflict with `interaction-guidelines.md` ("submit stays
  enabled until the request starts"), which now carries an explicit,
  `aria-disabled`-only exception for "nothing to submit".
  _jsdom does not implement the focus-fixup rule, so this rests on the spec and
  browser behaviour rather than a repro; the added test locks the focusability
  contract and the click guard._
- `PromptInputSubmit`'s own `aria-label` ("Submit"/"Stop") was missed by the i18n
  sweep — and was **structurally invisible** to `microcopy:check`, whose regex saw
  only bare `attr="…"`, never a literal inside `attr={…}`, so it wasn't even in
  the tracked baseline. The gate now reads JSX expression containers (skipping
  `t()` keys and non-prose literals), which surfaced 7 more genuine cases; the
  a11y-critical `@brand/ai` ones (`VoiceSelectorPreview`, `MessageForm`,
  `MessageTable`) are routed. A test asserts zero hardcoded
  `aria-label`/`placeholder` remain in `@brand/ai`.
- `inlineCitationSourceLabel` uses `||` rather than `??`, so a present-but-empty
  `label: ""` falls through to the url/id instead of rendering an unlabelled chip.
- The `StructuredLedger` story no longer signals step status by colour alone
  (WCAG 1.4.1) — it is an exemplar consumers copy.

## v1.9.0 — 2026-07-17

Model-emittable, message-body components for generative-UI clients (an assistant
whose LLM composes UI from a curated `@brand/*` catalog). All land in `@brand/ai`,
are presentational only (no model calls / transport — D5), and follow the two
in-repo precedents: `AutoChart` (spec-driven, never-throws, typed fallback) and
`ChangeReview` (compound + lifted state, controlled/uncontrolled). `zod` is added
as a runtime dependency of `@brand/ai` for the spec schemas (the `ai` SDK stays
types-only — `ai:types-only` gate green).

### `@brand/ai`

- **`MessageForm`** (+ `message-form-spec`) — a model-emittable form. One
  serializable, zod-validated `FormSpec` (flat primitives: string with
  `email`/`uri`/`date`/`date-time` + length/pattern, number/integer, boolean,
  single- and multi-select enum), deliberately compatible with MCP elicitation's
  `requestedSchema`. Exports `formSpecSchema` for downstream prompt/validator
  compilation. Declarative validation (required · email · url · min · max ·
  minLength · maxLength · pattern · numeric) with inline errors + focus-first-error;
  controlled/uncontrolled; `submitting`/`submitted` (inert historical record)
  states; Enter submits from single-line fields; compound parts + `MessageFormFallback`.
  Composes `@brand/ui` inputs. _Left out:_ file/password fields (rejected by the
  schema by design), nested objects/arrays. _Unverified:_ three-theme **rendered**
  sweep (this env can't capture pixels; dark-theme story + token-only styling +
  a11y unit tests stand in).
- **`MessageTable`** (+ `message-table-spec`) — a model-emittable, column-oriented
  data table. Serializable, zod-validated `TableSpec` (`columns` with
  `text`/`number`/`currency`/`percent`/`date`/`badge` formats; `rows` keyed by
  column key). Never throws (unknown format → text, missing cell → em-dash);
  numeric columns end-aligned + `tabular-nums`; semantic badge-tone inference;
  optional client-side sort (controlled/uncontrolled), `maxRows` truncation notice,
  per-cell `renderCell` override; streaming-tolerant skeletons; `MessageTableFallback`.
  Lightweight (composes the `@brand/ui` `Table` primitive — NOT the `@brand/data`
  DataTable). _Left out:_ virtualization, filtering, column resize (app-chrome
  concerns). _Unverified:_ three-theme rendered sweep (as above).
- **`GroupedParts`** (+ `part-groups`) — a pure client-side view transform that folds
  adjacent reasoning/tool parts into collapsible traces. `groupBy(part, ctx)` →
  reserved `group-…` key paths; adjacent parts coalesce, multi-key paths nest; status
  rolls up (any member running → group running); stable leaf keys + a fingerprint memo
  so streaming rows don't remount. `groupPartByType()` helper with an
  `inline`/`standalone` classification hint (approval/human parts never fold).
  Render-prop switches on `part.type`, defaulting to `Reasoning`/`Tool`/collapsible
  trace renderers. _Left out:_ persistence, model-side grouping (this is a view
  transform, never an output format).
- **`MessageEdit`** — edit-in-place for user messages. Lifted edit state
  (controlled/uncontrolled), inline editor (the composer's `Textarea`) seeded with the
  original text, `onEditSubmit(newText)`; Enter submits, Shift+Enter newline, Esc
  cancels; focus moves in, is trapped, and is restored to the trigger; original
  restored on cancel. Compose with `MessageBranch*` to create a branch. _Unverified:_
  three-theme rendered sweep.
- **`MessageFeedback`** — thumbs up/down with a submit-once, auto-disabling state
  (`data-submitted`/`data-feedback`), `onSubmit({ type })`, `compact` variant for
  toolbars, controlled/uncontrolled. No persistence (host-owned).
- **`SelectionToolbar`** — a floating Quote toolbar over selected transcript text
  (`onQuote(selectedText)`), positioned with the `@brand/ui` Popover primitives at a
  virtual selection rect; dismisses on selection collapse/scroll/Escape. Exports
  `readSelectionWithin`. _Unverified:_ real-browser text-selection behavior (unit-tested
  via a mocked `getSelection`; the live selection path is exercised only in Storybook).
- **`StreamingSuggestions` / `SuggestionLoading`** — extends `Suggestion(s)` with a
  streaming trailing-loader: chips appear progressively while a generator streams and a
  shimmering trailing chip (composing `Shimmer`) shows until the set settles.

## v1.8.5 — 2026-07-05

Resolves the component/token gaps a downstream consumer (a workbench app,
vendoring v1.8.0) surfaced with RCA + a suggested API — built in the library so
they stop being app-local one-offs — plus a set of `@brand/flow` edge/anchor
fixes. All packages move to `1.8.5` in lockstep (root, the 11 publishable
packages, `@brand/cli`, both plugin manifests, and the MCP server's
`SERVER_INFO.version`). Issues #283–#306.

### `@brand/tokens`

- **Semantic match-highlight pair** — new `--highlight` / `--highlight-foreground`
  (utilities `bg-highlight` / `text-highlight-foreground`) for search / find-in-page
  highlighting. Ink clears WCAG AA (≥4.5:1) as body text on the highlight plate in
  every theme (light 9.98:1, dark 8.87:1, blueprint 8.56:1), replacing the
  sub-AA `bg-warning/40` improvisation (3.48:1 in dark). Locked by a new
  `themes-contrast.test.ts` assertion. (#296)
- **`--input` 1.4.11 exemption recorded** — the sub-3:1 form-control resting border in
  light/dark is confirmed by-design (blueprint already passes at 5.71:1).
  ADR 0010's Amendment gains a per-control redundant-cue map (Select/Combobox/date
  pickers exempt via their glyph; Input/Textarea/Checkbox/Radio rest on
  `shadow-sm`+focus-ring+hover) and a one-token `--input`→`--border-strong` escape hatch
  for external-conformance builds. No default token change. (#297, by-design)

### `@brand/ui`

- **`MatchHighlight`** — presentation-only primitive that wraps query matches in real
  `<mark>` elements styled with the `--highlight` token pair. `query` (case-insensitive
  by default, multiple needles, unicode) or precomputed `ranges`; overlapping and
  adjacent ranges merged. Exports `queryToRanges` / `normalizeRanges`. Replaces
  hand-rolled `<mark>` range-splitting across search surfaces. (#284)
- **`Tree` reveal-into-view** — new `scrollToId` / `scrollSelectionIntoView` props reveal
  a programmatically-selected node when `virtualize` is on (scrolls a windowed-out row
  into view, expanding loaded ancestors and kicking lazy `loadChildren` as needed).
  Keyboard navigation and non-virtualized behavior unchanged. (#298)

### `@brand/ai`

- **`InteractiveTerminal`** — a PTY-ready terminal wrapping xterm.js, with the ANSI
  palette + background/foreground/cursor/selection colors derived from semantic tokens
  per theme (no raw hex, no new tokens). `forwardRef` handle `{ write, clear, fit, focus }`,
  `onData` / `onResize`, `readOnly`, required `aria-label`, and a keyboard escape hatch
  (Tab/Esc released). The PTY/process stays consumer-owned. (#285)

### `@brand/flow`

- **`layoutGraph` + `useAutoLayout`** — pure, deterministic graph auto-layout:
  `algorithm: "concentric" | "force" | "layered-lr" | "grid"` (layered reuses the existing
  dagre `layoutFlow`; force rides a seeded `d3-force`). Returns the same nodes with
  `position` filled. (#286)
- **`FlowFloatingEdge` border anchor + robustness** — the floating edge now draws a small
  anchor dot at each border connection point (on by default; `data: { anchors: false }`
  via `FloatingEdgeData` to hide) so the line clearly terminates on the node's closest
  side instead of a bare, unanchored spot. The intersection math is guarded so a
  not-yet-measured node yields finite coordinates (no `NaN` edge) and snaps exactly onto
  the nearest border. (#302)
- **Facing-side connections by default (general graphs)** — new exported
  `FLOW_ALL_SIDE_HANDLES` helper (a one-line `data.handles` config for anchors on all four
  sides), and the general-graph demos (`FlowMiniMap`, `FlowLayout`, `CanvasShell`) now use it
  with `FlowSmartEdge` — so an edge connects on the side **facing** the other node
  (right/left when side-by-side, top/bottom when stacked) and re-picks it as the layout
  changes, instead of always routing top/bottom. No change to `FlowEdge` or the default node.
  (#306)
- **Layout-direction-aware handles** — `FlowNode` now honors `sourcePosition`/`targetPosition`
  from React Flow, and `layoutFlow`/`layoutGraph` set them per direction (LR → right-out /
  left-in, TB → bottom-out / top-in, etc.). A left-to-right layout now moves the anchors to
  the left/right sides so edges route horizontally, instead of every layout being stuck with
  top/bottom handles. Radial layouts (`concentric`/`force`) pair with `FlowFloatingEdge`. (#304)

### `@brand/editor`

- **Completion-provider API** — new `completions?: EditorCompletionProvider[]` on
  `MarkdownWorkspace` / `MarkdownEditor`. The library owns the Monaco
  `registerCompletionItemProvider` lifecycle (module-singleton, refcounted, per-model
  scoping, live provider reads with no re-registration) and mirrors a minimal suggestion
  plugin into the WYSIWYG pane, so consumers wire e.g. `[[wikilink]]` autocomplete with
  **zero `monaco-editor` imports**. Candidates/filter/insert stay consumer-owned. (#283)
- **Run-only source slash commands** — optional `runInSource?(ctx: SourceSlashContext)` on
  `SlashCommand`; the Monaco source slash menu now surfaces run-capable commands (not just
  snippet-bearing ones) and calls `runInSource` with the Monaco editor + stripped trigger
  range. `run` (Milkdown) is untouched — the 12 default commands need zero migration. (#299)

### Verify-stale / by-design (no code change)

- **Already shipped in v1.8.0** (consumer registry was stale): WYSIWYG table editing,
  editor fill-height, slash-menu scroll-into-view (both panes), Tab-to-exit code block,
  and the branded `@brand/flow` canvas. Confirmed against source; no rebuild.
- **`@brand/icons`** stays brand-vocabulary + logo only; `lucide-react` is the sanctioned
  set for generic nav + formatting glyphs (`icons.md` clarified). (#300, by-design)

## v1.8.0 — 2026-07-04

A feature minor built around a **new `@brand/maps` package** and a **major
`@brand/flow` expansion**, plus a11y/i18n hardening across charts/data and a batch
of new self-tested governance gates. All packages move to `1.8.0` in lockstep
(root, the 11 publishable packages, `@brand/cli`, both plugin manifests, and the
MCP server's `SERVER_INFO.version`).

### Headline — new package: `@brand/maps`

- **`@brand/maps`** — token-driven **MapLibre GL** map components, wrapping the
  engine the same way `@brand/flow` wraps React Flow and `@brand/editor` wraps
  Monaco (BSD-3-Clause; adapted from the MIT-licensed mapcn). Components:
  `MapCanvas` (theme-aware basemap; ref = the raw MapLibre `Map`),
  `MapMarker` + `MapMarkerContent`/`Label`/`Popup`/`Tooltip`, `MapPopup`,
  `MapControls`, and the layer components `MapRoute`, `MapArc`, `MapGeoJSON`,
  `MapClusterLayer`, with `useMap()` for descendant access.
  - **Theme → basemap** is driven by `THEME_META[data-theme].dark`; default layer
    paints resolve semantic tokens at runtime via `resolveTokenColor` (WebGL can't
    read CSS variables), re-resolving on theme change. **D5-clean** — data flows in
    via props; the package never fetches domain data or owns transport.

### `@brand/flow` — capability expansion (FL-01 → FL-07)

- **FL-01 foundation** — upgrade to `@xyflow/react` 12.11.1, `dagre` dependency,
  flow tokens, `CanvasShell` accessible defaults, `FlowMiniMap`.
- **FL-02/03/04 (Wave A)** — auto layout, helper lines (`useHelperLines`), smart
  anchors and edges (`FlowSmartEdge`, `FlowFloatingEdge`); same-side edges now fan
  out instead of stacking on the midpoint.
- **FL-05 grouping** — `FlowGroupNode` + `useFlowGroups` (collapse/expand with
  proxy edges).
- **FL-06 placeholders & add-node** — `FlowPlaceholderNode` + `FlowButtonEdge`.
- **FL-07** — the `flow-builder` registry block (palette, layout, grouping,
  placeholders, undo/redo, copy/paste) and a workspace-template showcase.

### Accessibility, i18n & charts/data hardening

- **Charts** — Gantt keyboard linking decoupled from pointer-drag (cancels on
  Tab/blur), bar-label contrast, and `Status` → `GanttStatus` rename; pattern-fill
  and flip stories made harness-independent.
- **DataTable** — hardening batch: pagination warning, filter ref, sort a11y,
  motion tokens, `tbody` dedup; ADR-0014 direction (RTL) seam.
- **UI** — `Carousel` gains a default accessible name; repaired stale story
  assertions and the `DateRangePicker` two-month Default story.

### Governance & tooling (enforcement over reminders)

- **New self-tested gates** — dependency-direction gate (`dep-direction:check`),
  state-story coverage ratchet (`states:check`), loading-states gate, doc version-
  literal gate, and a format self-test; pre-commit **format teeth** (`prettier
--write` on staged files) alongside manifest regeneration.
- **deps-sync** — `node_modules` auto-syncs with `pnpm-lock.yaml` changes via
  local git hooks (`post-merge`/`post-checkout`/`post-rewrite`), so a pull that
  adds deps can't leave Vite/Storybook resolving stale modules.

## v1.7.0 — 2026-06-25

A focused `@brand/editor` minor: it makes the editor surfaces **drivable from the
outside** so an app's AI assistant can read and edit content, adds a cross-pane
**slash command menu** in the Monaco source pane, and lets consumers **own the markdown
toolbar chrome**. All packages move to `1.7.0` in lockstep (root, the 10 publishable
packages, `@brand/cli`, both plugin manifests, and the MCP server's `SERVER_INFO.version`).

### Headline — AI content-access API

- `@brand/editor` — **`EditorContentAccess`**, an engine-agnostic interface for AI-driven
  editing across BOTH the Monaco code editors and the Milkdown WYSIWYG editor: `getText()`,
  `getSelection()`, `replaceSelection()`, `insertAtCursor()`, `focus()`, `onSelectionChange()`.
  It maps an assistant's use cases directly — add-text-at-cursor, rewrite-selection,
  summarize-selection, enable/disable actions on selection change. **D5-clean**: the app owns
  the AI/model call and APPLIES the result via these methods; no model or transport is bundled.
  - **`monacoContentAccess(editor)`** (`@brand/editor`) wraps any `CodeEditor` / `DiffEditor`
    (`.getModifiedEditor()`) / `CodeWorkspace` Monaco instance. **`proseMirrorContentAccess(deps)`**
    (`@brand/editor/markdown`) wraps the Milkdown view — **markdown-fidelity by default** (selection
    serialized to markdown; incoming text parsed as a markdown fragment), with a `fidelity:"plainText"`
    option and a graceful plain-text fallback.
  - `MarkdownEditorHandle`, `MarkdownWorkspaceHandle`, and the new `CodeWorkspaceHandle` all
    implement the interface (delegating to the active engine). `onSelectionChange` is robust to the
    editor's async mount and tab/mode switches.
  - Recipe: the `Editor/AI Content Access` Storybook story drives **both** a `CodeWorkspace` and a
    `MarkdownWorkspace` through the one interface with local stub transforms.

### Editor control surface (#270–#273)

- **Cross-pane slash menu (#271)** — the brand block-insert menu now opens in the **Monaco source
  pane**, not just WYSIWYG: type `/` at a line start (or after whitespace), or press the configurable
  `slashMenu.shortcut` (default **`Mod-Shift-O`**) in either pane. (`Mod-/` is intentionally NOT the
  default — Monaco binds it to Toggle Line Comment.) The typed `/` is replaced by the inserted block;
  arrow-keys scroll the active option into view; filter keystrokes never leak into the document.
- **`CodeEditor.actions`** — a declarative `EditorAction[]` prop (wraps Monaco `addAction`): register
  a command with a keybinding + command-palette entry + optional context-menu item. The Monaco-layer
  foundation the source slash shortcut builds on.
- **Imperative reveal / scroll (#273)** — `MarkdownWorkspaceHandle.revealLine(line)` /
  `scrollToHeading(slug)` (exact in Monaco source/split; best-effort heading-anchored in WYSIWYG) +
  `getEditor()` / `getElement()`.
- **Toolbar-chrome opt-outs (#270, #272)** — `focusWriting={false}` hides + disables the Focus-writing
  toggle; `modeSwitch={false}` hides the built-in Source / Split / Preview-edit switch; `toolbarActions`
  supplies host controls in the trailing slot.

### ⚠️ Breaking changes

- **`MarkdownWorkspace` `ref`** is now a `MarkdownWorkspaceHandle` (was `HTMLDivElement`). Replace
  `ref.current` DOM access with `ref.current?.getElement()`. (#273)
- **`CodeWorkspace` `ref`** is now a `CodeWorkspaceHandle` (was `HTMLDivElement`). Use
  `ref.current?.getElement()` for the DOM node; `getActiveEditor()` exposes the active tab's Monaco
  instance.
- The source-pane slash **default shortcut is `Mod-Shift-O`** (free in Chrome/macOS; override
  `slashMenu.shortcut` for Firefox / Windows-Chrome where it is the bookmarks shortcut, or just type `/`).

## v1.6.0 — 2026-06-23

A feature minor centred on two headline components — a charts **Gantt v2** and an
AI **Gallery** — plus the agent-facing infrastructure that makes brand-ui legible to
coding agents (a persistent **brand-ui MCP server** and an **agent-output contract**)
and a new cross-cutting **loading / streaming** convention. All packages move to
`1.6.0` in lockstep (root, the 10 publishable packages, `@brand/cli`, both plugin
manifests, and the MCP server's reported `SERVER_INFO.version`).

### New components & surfaces

- `@brand/charts` — **Gantt v2** (#242). A major, additive upgrade across two phases;
  every new capability is **emit-only / controlled** — the task model is never mutated
  (D5):
  - **Grid & timescale** — a multi-column task grid (`columns`; column 0 stays the
    accessible `@brand/ui` Tree label, columns 1..N render as an aria-hidden aligned
    overlay), a grouped / multi-row timescale (`scales`, with `viewMode` now a preset),
    a configurable bar-label position (`labelPosition`), and weekend / working-time
    **highlight bands** (`highlightTime`).
  - **Bars & annotations** — a planned-vs-actual **baseline** track
    (`GanttTask.baseline`), vertical annotation **markers** (`markers` / `Gantt.Markers`,
    generalizing the today line), a custom **`renderBar`** slot (keeps the
    selection / keyboard / drag / tooltip shell), and custom **task types** (`taskTypes`,
    per-type color + `shape:"milestone"`).
  - **Interaction** — pointer **drag** move / resize / create-link (fires the existing
    `onTaskMove` / `onTaskResize` / `onDependencyCreate`; live ghost + portaled link line;
    keyboard path unchanged), continuous **zoom** (`pixelsPerDay`, Ctrl/⌘ + wheel,
    controlled + uncontrolled), and column **sort** (`sortable` / `sort` / `onSortChange`,
    multi via Ctrl/Meta) + **resize** (`resizable` / `onColumnResize`).
  - **Localization** — `locale` / `formatDate` route one resolved formatter through every
    date string (bars, grid cells, timescale ticks). Follow-ups filed: #259 (inside
    bar-label contrast), #260 (Escape-refocus / keyboard drag-link), #262 (rename
    `Status` → `GanttStatus`).
- `@brand/ai` — **Gallery**: an image grid (with `+N` overflow) / single view that opens a
  Dialog **lightbox** (built on the shared `Carousel`) with a metadata panel and per-image
  **download**. Ships its not-ready states per the new loading convention — a per-image
  `Skeleton` inside a reserved `AspectRatio` (no CLS), plus `loading` + `expectedCount` for
  partial sets.

### Agent infrastructure

- `@brand/cli` — **brand-ui MCP server** (`mcp.mjs`): a persistent, dependency-free
  Model-Context-Protocol server over the CLI engine / committed manifest, registered as the
  `brand-ui` server in `.mcp.json` (tools `info` / `search` / `docs` / `tokens` / `audit`).
  It answers even with the Storybook dev server down — the anti-hallucination ground truth
  for component APIs and tokens. New Storybook docs: "Brand-UI MCP Server" and "AI Output
  Contract for Agents".
- `@brand/cli` — **agent-output contract** (`agent-output.mjs`): defines the structure of
  agent output for rendering in `@brand/ai`, enforced by a new self-tested
  `pnpm agent-output:check` gate so the manifest and source definitions can't drift.

### Conventions & quality

- **Loading / streaming / placeholder convention** — a new always-on rule
  (`.claude/rules/loading-states.md`): two orthogonal, prop-driven signals — `loading`
  ("no content yet" → a layout-shaped `Skeleton`) and `isStreaming` ("partial content
  arriving" → build up + suppress transient errors); error slots fire **only** on terminal,
  settled failures. Existing `loading` (DataTable / Gantt) and chart `status="loading"` are
  documented as canonical / aliases — **no breaking renames**.
- `@brand/ai` — **JSXPreview** now implements that convention: a four-state `status`
  (idle / pending / ready / error) classifies syntactically incomplete input as `pending`,
  so the **error box no longer flashes while typing or streaming** — it builds up and
  surfaces an error only on a terminal failure. A11y: a persistent live region (announces on
  NVDA) and `text-destructive-text` for the error cue (AA-safe, including dark).

### `@brand/ui`

- Shared browser **download helpers** (`downloadBlob` / `downloadUrl`,
  `@brand/ui/lib/download`) — one home for the `Blob` / URL → hidden `<a download>` →
  revoke dance previously copy-pasted across `@brand/ai` (ConversationDownload),
  `@brand/data` (CSV export) and Gallery. SSR-guarded, no React.
- **RevisionTimeline** — adds branch support (new exported `RevisionBranch` type) and
  related enhancements.

## v1.5.0 — 2026-06-21

A feature minor centred on app-chrome polish and the brand theme promotion: a
theme-aware **AppIcon** brand mark, the standard **Composer** chat input, and the
former "v2" brand palette promoted to the canonical `light` / `dark`
themes. Plus a new surface-elevation gate that stops an app shell going flat, an
automatic pointer-cursor affordance, and consumer-clean plugin hardening. All
packages move to `1.5.0` in lockstep (root, the 10 publishable packages,
`@brand/cli`, and both plugin manifests).

### New components & surfaces

- `@brand/icons` — **AppIcon**: the single source of truth for "the brand mark in
  the corner". Built on `BrandLogo`, so it renders the approved per-theme colorway
  automatically; with `morph="auto"` it shows the full lockup and crossfades to the
  bare mark when its enclosing `Sidebar` collapses to the icon rail (gated motion,
  reduced-motion safe). It now drives the sidebar headers of the dashboard
  (`@brand/charts`), data-app (`@brand/data`), flow-workspace (`@brand/flow`),
  admin-console, and ai-assistant template stories, with sizing standardized to a
  20px app-chrome height. (The `@brand/ui` settings story stays brand-neutral on
  purpose — `@brand/ui` must not depend on `@brand/icons`.)
- `@brand/ai` — **Composer**: the canonical AI chat input — a two-tone "double
  card" (muted status strip over a recessed `PromptInput` well, model pill, voice,
  circular send), built on the real `PromptInput` so it drops into a `ChatShell`
  footer or stands alone. Reach for it instead of hand-rolling a `PromptInput`
  footer. Adds `lucide-react` (`^0.577.0`) as a dependency of `@brand/ai`.
- `@brand/ai` — `PromptInput` gains a **`surfaceClassName`** seam (styles the inner
  well, the only way to shape its corners from outside; used by `Composer`), and
  `PromptInputButton` now self-provides its `TooltipProvider` so a bare composer
  works without a global provider. `ChatShell` gains a frameless **`"bare"`**
  immersive variant (edge-fade scrims, no redundant second frame) for shells that
  already sit inside a bounded region.

### Tokens & theming

- **Brand theme v2 promoted to canonical.** `light` and `dark` are
  recolored to the former brand-aligned "v2" design (near-white / warm-charcoal
  neutral surfaces, neutral grey / ivory text, 4px radius, blue focus ring, brand
  chart palette). The comparison-sibling `light-v2` / `dark-v2` blocks
  are dropped: the shipped theme list is now **three** (`light`, `dark`,
  `blueprint`), and `themes.css`, the DTCG token JSONs, `theme-types.ts`, the
  manifest, `component-inventory`, `brand-ui-context`, and the `llms.txt` index are
  all updated to match.
- **Automatic pointer cursor for interactive controls.** A base-layer rule in
  `themes.css` gives every native `<button>`, the interactive ARIA roles
  (`button`/`menuitem`/`tab`/`option`/`switch`/`checkbox`/`radio`/`link`),
  `summary`, and `select` a `cursor: pointer` (Tailwind v4's Preflight dropped the
  v3 button-cursor reset). It lives in `@layer base`, so an explicit `cursor-*`
  utility still wins and disabled controls keep the arrow — no per-component edits.

### Tooling & quality gates

- **Surface-elevation invariant, now enforced.** A new `pnpm surface-elevation:check`
  gate (+ self-test, wired into CI) requires every theme to keep the app chrome
  (`--sidebar`) recessed below the content canvas (`--background`) by a perceptible
  lightness step (`L(--background) − L(--sidebar) ≥ 0.02`), with raised `--card` at
  or above the canvas — so a future theme can't silently collapse the shell into
  flat design (the nav≈content regression that prompted it). Sidebar/canvas tokens
  were retuned to satisfy it.
- **Type is a role, even in stories.** Story sources were swept from raw
  `text-sm`/`text-xs` to the `text-body`/`text-meta` roles, and the ESLint config
  now **enforces** `no-raw-font-size` in `*.stories.*` (matching the
  `check-text-scale` ratchet); raw colors stay legitimate in stories for token /
  palette demos.
- **Plugin hardening.** The plugin zip now ships **only the declared surface** —
  `build-plugin.mjs` copies just the curated skills and consumer agents that
  `plugin.json` declares, not the whole `skills/` and `.claude/agents/` trees; the
  `plugin.json` `agents` array is drift-proofed via `gen-plugin-agents.mjs` (+
  self-test); and the consumer-clean gate is flipped to **enforce** the shipped
  skills and extended to all shippable text files, sanitizing repo-internal
  references (`/file-issue`, `packages/`, `.claude/`, `apps/`, `docs/playbooks`)
  out of consumer-facing prose.

### Fixes & polish

- Regenerated the playbook templates (`docs/playbooks/templates/*`) to resync with
  their `templates-*.stories.tsx` sources after the text-class refactor and the
  AppIcon adoption — unblocking `templates:check` / `agent-docs:check`.
- Cleared pre-existing Prettier format drift (whitespace/wrapping only) across
  stories, research, skills, and config so `format:check` passes for release (#239).

## v1.1.0 — 2026-06-20

A feature minor: a full interactive Gantt, an enterprise design-judgment skill,
Storybook-sourced templates that replace the hand-maintained registry copies, a
curated end-user plugin, and a form-control border re-tune. All packages move to
`1.1.0` in lockstep (root, the 10 publishable packages, `@brand/cli`, and the
plugin manifests).

### New components & surfaces

- `@brand/charts` — **Gantt**: an interactive Gantt/timeline widget (bars,
  dependencies, milestones, hierarchy, virtualization; day/week/month/quarter view
  modes), with stories + tests.
- `@brand/marketing` — a full-page, cross-theme **marketing landing template** story.

### Skills, plugin & agent kit

- **`brand-ui-enterprise`** — a new enterprise design-judgment skill over brand-ui
  (classify professional/consumer/marketing register → app-shell archetype →
  mandatory baseline → object/screen modeling). Shipped in the plugin + agent kit.
- **Full-screen templates are now generated from their Storybook stories**
  (`pnpm gen:templates` → `docs/playbooks/templates/<name>.tsx`, surfaced in the
  manifest). The hand-maintained `registry/templates/*` copies (`template-*` items)
  were dropped — ending the story↔registry drift. New `templates:check` gate + self-test.
- **The plugin is curated for end users**: ships only the 6 user-facing skills
  (drops maintainer `brand-ui-component`/`brand-ui-registry`) and 3 consumer-clean
  reviewer agents (`brand-ui-reviewer`, `-accessibility-reviewer`,
  `-visual-ux-reviewer`) under `agents/` — not the 11 repo-internal agents. New
  `plugin:consumer-clean` gate (+ self-test) keeps shipped prose free of
  repo-internal references.
- **Release wiring**: `build-plugin.mjs` packages the plugin as an offline asset,
  `plugin.json` + `marketplace.json` bump in lockstep, and the official
  `claude plugin validate --strict` is now the authoritative release gate.

### Tokens & theming

- Form-control borders re-tuned to the subtle hairline rung across themes (ADR 0010
  amendment) — segmented controls, Select, Combobox, date pickers, and all form
  fields now read on-theme; `--input` moved off the WCAG-strong rung (an accepted
  internal-use tradeoff).

### Fixes

- Fixed an invalid plugin manifest (`agents` must be an array of file paths) — the
  official validator caught it; the custom gate had false-greened it.
- `Dialog` OverflowGuard story uses a `~/` placeholder (machine-paths #203).
- Updated stale `@brand/cli` scaffold tests for the new generated-template names.

## v1.0.0 — 2026-06-15

First stable major. The `@brand/*` public component, token, and theme surface is
now considered stable — breaking changes follow semver from here. Distribution is
unchanged: GitHub Release tarballs (see `docs/RELEASING.md`), `private: true`, no
npm registry. All packages move to `1.0.0` in lockstep (root, the 10 publishable
packages, `@brand/cli`, and the Claude Code plugin).

### New components & surfaces

- `@brand/ui` — **RevisionTimeline** (revision history with tests),
  **BentoGrid** / **BentoGridItem** (spotlight bento layout), **ChangeReview**
  (the AI-edit trust gate).
- `@brand/data` — **DataTable** loading state (skeleton rows + overlay).
- `@brand/editor` — **CalcBlock** (titled calc tables: row dividers/tints, total
  override, author markers; renders without a `TooltipProvider`) and the
  **markdown extension seam**: `parseMarkdown` leaf, calc inline/tokens,
  wikilinks + transclusion + link-preview, a slash menu with directive insertion,
  ai-objects directive renderers (decision/entity/knowledge), and iteration
  directives + a template dialog for markdown previews.

### Tooling & quality gates

- **Content anti-slop detection** — new `slop:check` ratchet (+ self-test) catches
  placeholder/"Jane Doe" content; the `brand-ui-audit` UX-evaluation scorecard is
  expanded.
- Agent ground-truth docs (manifest, inventory, `llms.txt`, context) regenerated
  and kept fresh by the existing `agent-docs:check` gate.

### Fixes & polish

- De-slop AI cards; fix `Message` avatar, `TestResults`, and composer padding.
- Stabilize the `ChangeReview` Empty story (StatePanel fade-in).
- `@brand/workbench` test setup: stub jsdom `document.queryCommand*` so
  Monaco-importing tests load.
- CI: exclude the machine-paths self-test from its own scan; point plugin/install
  references at `mreimitz/elabs-components`.

### Consumer docs (carried forward from the 0.7.0 line)

- `docs/CONSUMING.md`, the version-pinned coding-agent kit
  (`brand-ui-agent-kit-1.0.0.zip`), and `@brand/cli` (`npx brand-ui
info|search|docs` in a consuming project) ship with the release. Claude Code
  can use the live plugin: `/plugin marketplace add mreimitz/elabs-components`.

## v0.7.0 — 2026-06-12

First tagged release. Internal distribution via GitHub Release tarballs (see
`docs/RELEASING.md`); the `@brand/*` scope is not published to any npm registry.

### Packages (all at 0.7.0)

- `@brand/tokens` — semantic CSS-variable themes (6: light, dark,
  light, dark, blueprint, high-contrast), `ThemeProvider`/`useTheme`, decoration
  dial, density/RTL, self-hosted Inter + IBM Plex Mono.
- `@brand/ui` — foundation + app UI (Button, Card, Dialog, Tabs, AppShell, …).
- `@brand/icons` — brand/product-vocabulary icons + `BrandLogo` (generic glyphs
  come from `lucide-react`).
- `@brand/data` — DataTable (TanStack), FilterBar, SearchInput, FacetFilter,
  ColumnPicker.
- `@brand/ai` — ChatShell, Conversation, Message, PromptInput, Tool, Reasoning,
  Sources, CodeBlock, Artifact, citations (AI SDK types-only).
- `@brand/flow` — branded React Flow canvas, nodes, edges, controls, inspector.
- `@brand/charts` — MetricCard/MetricGrid, ChartCard, ChartFrame, AutoChart.
- `@brand/marketing` — Hero, FeatureGrid, UseCaseCard, StatsBand, CTASection.
- `@brand/editor` — token-themed Monaco: CodeEditor, DiffEditor, CodeWorkspace,
  markdown subpath.
- `@brand/blueprint` — reprographic blueprint decoration furniture.

Plus the copy-own registry (24 items, `npx shadcn add`) and Storybook docs.

### Release mechanics added in this cut

- `files: ["dist", "src"]` on all 10 publishable packages — tarballs now ship
  deterministic contents (previously the root `.gitignore` did not apply to
  `pnpm pack`, so `.turbo/` logs and build configs leaked in).
- All versions bumped 0.1.0 → 0.7.0 (synced versioning across packages).
- Packages stay `private: true` — `pnpm pack` works; accidental `publish` stays
  blocked.

### Coding-agent kit + consumer docs

- `brand-ui-agent-kit-0.7.0.zip` — the coding-agent skill layer, attached to the
  release so a consuming project's AI agent knows what `@brand/*` offers and how
  to compose it: the `brand-ui` build/compose skill (+ `brand-ui-audit`,
  `brand-ui-theme`, `brand-ui-new-app`), the `brand-ui.manifest.json` inventory,
  `llms.txt`, and whole-screen playbooks. (Claude Code can also use the live
  plugin: `/plugin marketplace add mreimitz/elabs-components`.)
- `@brand/cli` (`0.7.0`, now packed into the release) — `npx brand-ui
info|search|docs` works in a consuming project: it reads the manifest bundled
  inside the package, with no monorepo present (consumer-mode fix).
- `docs/CONSUMING.md` — how to install and use `@brand/*` from another project:
  tarballs + `pnpm.overrides`, Tailwind v4 + token wiring (Vite & Next.js), and
  making your coding agent brand-ui-aware.
