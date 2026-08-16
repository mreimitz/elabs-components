# CSP, Trusted Types & network egress

What `@qlik-coe-emea/qlabs-components-*` reaches on the network, and what breaks under a strict Content
Security Policy. Read this before deploying into a locked-down environment
(air-gapped, regulated, or CSP-enforcing).

Most of what's here fails **silently** — a blank logo, an empty animation box, a
message that renders as an empty string. That's the reason for the page.

**This page is checked, but it no longer executes — read that limit before you
rely on it.** Until 2026-08-02 the repo shipped a Vite demo app that served the
§2.7 policy as a real response header in `vite dev` and `vite preview`, with an
E2E test that failed CI on any violation a real browser reported. That app and
that test were deleted (80a12fb), and the maintainer's decision on 2026-08-10 was
to complete the removal rather than rehome the serving dogfood. **Nothing in this
repo now proves a browser can actually load a brand-ui surface under this policy.**
Everything below was true when it was measured; treat it as reviewed, not as
continuously re-proven, and verify against your own build.

Three gates still keep the page internally honest: `pnpm origins:check` (every
`https://` origin in shipped source is allowlisted and listed here),
`pnpm tt-aliases:check` (the §2.2 snippet still resolves to the DOM-free builds —
this one does execute, against the real filesystem), and `pnpm csp:check` (§2.7
matches `docs/csp-policy.json` and every relaxation carries a named carve-out).

---

## 1. Remote origins

### Fetched at runtime — a CSP will block these

| Origin                                            | Directive                 | Who                                       | Escape hatch                                                                                                            |
| ------------------------------------------------- | ------------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `models.dev`                                      | `img-src`                 | `ModelSelectorLogo` provider logos        | `<ModelSelectorLogo src="/local/x.svg">`, or `fallback`. A blocked load renders a neutral glyph — never a broken image. |
| `ejiidnob33g9ap1r.public.blob.vercel-storage.com` | `connect-src`             | `Persona` Rive `.riv` artwork             | Self-host the six files (see `PERSONA_SOURCES`) and pass `<Persona src={…}>`. A blocked load renders the fallback orb.  |
| `basemaps.cartocdn.com`                           | `connect-src` + `img-src` | `MapCanvas` default basemap style + tiles | Pass `mapStyle` for a self-hosted style, or `blank` for no basemap.                                                     |

Minimum policy to keep all three working as shipped:

```
img-src 'self' data: blob: https://models.dev https://basemaps.cartocdn.com;
media-src 'self' blob:;
connect-src 'self' https://ejiidnob33g9ap1r.public.blob.vercel-storage.com https://basemaps.cartocdn.com;
```

`Persona` also loads the Rive **WebGL2 `.wasm`** from your own origin (it is
bundled), which needs `script-src 'wasm-unsafe-eval'` — or don't render `Persona`.

### Navigation targets — NOT blocked by a CSP, but they do leak

`chatgpt.com`, `claude.ai`, `cursor.com`, `scira.ai`, `t3.chat`, `v0.app`
(`OpenIn*`), and `doi.org` (citation links).

These are `<a href>` targets the user clicks, so `connect-src`/`img-src` don't
apply and `form-action` doesn't either. **The concern is data egress, not CSP:**
the `OpenIn*` links place the prompt text in the URL query string, so user
content leaves your perimeter on click. Each provider is a separately exported
component — the mitigation is not to render it.

`www.npmjs.com`, `www.openstreetmap.org`, `carto.com` and `ui.shadcn.com` are
`AttributionPanel`'s links. They carry **no** user content — each is a fixed
licence/provenance URL — so there is no egress concern beyond the click itself.

`www.npmjs.com` covers **every** OSS dependency: the generator links each package
to its npm page rather than to its own homepage precisely so this inventory stays
one origin instead of ~60 (see `npmUrl` in `scripts/gen-attributions.mjs`). The
mitigation for any of the four is to scope the panel — `categories` /
`requiredOnly` — though note that dropping the `data` category while the Carto
basemap renders removes a credit the ODbL requires; change the basemap
(`MapCanvas` `styles` / `blank`) instead.

### Trusted Types (`require-trusted-types-for 'script'`)

A renderer that sets `require-trusted-types-for 'script'` makes every
`innerHTML` / `outerHTML` / `insertAdjacentHTML` / `document.write` assignment
throw. React performs `dangerouslySetInnerHTML` in `setInitialProperties` —
during **commit**, not render — so no error boundary catches it and React tears
down the **root**. The symptom is a **blank window**, not a broken component, and
neither the unit suite (jsdom enforces no CSP) nor a screenshot can see it. The
empty string is not a carve-out: Chromium throws on `innerHTML = ""` too.

**Fixed here.** `@radix-ui/react-scroll-area` and `@radix-ui/react-select` each
rendered an unconditional `<style dangerouslySetInnerHTML>` carrying nothing but
static scrollbar rules, which made `ScrollArea`, `Select`, `Suggestions`,
`StreamingSuggestions`, `QueueList`, `Composer` and `PromptInputSelect*` unusable
under such a policy. `patches/` removes the injection and
`packages/tokens/src/radix-viewport.css` ships the rules as real CSS. Nothing is
required of the consumer.

**CONSUMERS MUST APPLY THE PATCH THEMSELVES — it does not travel in the package.**
`pnpm patch` writes into _this_ workspace's `node_modules` through
`pnpm.patchedDependencies`; a published package cannot carry that. Your app
resolves `@radix-ui/react-*` from npm, unpatched, so the injection is still there
for you. The CSS half ships (it is in the tokens stylesheet) — the removal half
does not. Add this to your app's `package.json`, copying the two `.patch` files
from this repo's `patches/` (they are attached to the release):

```json
"pnpm": {
  "patchedDependencies": {
    "@radix-ui/react-scroll-area@1.2.10": "patches/@radix-ui__react-scroll-area@1.2.10.patch",
    "@radix-ui/react-select@2.2.6": "patches/@radix-ui__react-select@2.2.6.patch"
  }
}
```

Then `pnpm install`. The patches only delete a `dangerouslySetInnerHTML` prop, so
they are trivially reviewable. A version bump makes the patch fail to apply
loudly, which is the right failure mode. (npm/yarn: use `patch-package`.)

**Still fatal — avoid these components, or grant them a policy.** Recorded in
`scripts/csp-sinks-baseline.json` and enforced by `pnpm csp-sinks:check`:

| Surface                                                                | Sink                                     | Escape hatch                                               |
| ---------------------------------------------------------------------- | ---------------------------------------- | ---------------------------------------------------------- |
| `MermaidDiagram`, the Mermaid viewer (`…-editor`)                      | engine returns SVG markup                | don't render it; Markdown surfaces degrade to a code block |
| math in `…-editor/markdown` (KaTeX)                                    | engine returns HTML                      | don't enable the academic layer's math                     |
| `schema-display` (`…-ai`)                                              | highlighted schema markup                | render your own schema view                                |
| `ChartStatFlow`, `Gauge` (`…-charts`)                                  | `@number-flow/react` assigns `innerHTML` | use `MetricCard` for the same figure                       |
| streamed markdown (`streamdown`), `AudioPlayer`/media (`media-chrome`) | third-party                              | avoid the component                                        |

`pnpm csp-sinks:check` fails on a NEW sink in our source or in a direct runtime
dependency, and — the rung that matters most — if either Radix patch ever stops
applying. **Limit:** it scans direct dependencies, not a full transitive fixpoint,
so a sink reached only through a transitive dependency is not caught yet.

### Never fetched

`chanhdai.com`, `elements.ai-sdk.dev`, `github.com` appear only in attribution
comments. Listed so a security review that greps for URLs can account for all of
them.

---

## 2. Trusted Types

Under `require-trusted-types-for 'script'` two transitive dependencies of
`@qlik-coe-emea/qlabs-components-ai` reach DOM `innerHTML` sinks, and DOMPurify installs a pass-through
policy. None of this is fixable inside the library — see §2.3 — so the mitigation
is bundler configuration in **your** app.

### 2.1 The two `innerHTML` dependencies

Both packages ship a DOM build _and_ a DOM-free build, and both select the DOM one
via the `browser` export condition — which every web bundler picks by default.

| Package                            | Reaches `@qlik-coe-emea/qlabs-components-ai` via                                                                | `browser` build does                             | DOM-free build                      |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ----------------------------------- |
| `decode-named-character-reference` | `@streamdown/cjk`→micromark, `@streamdown/math`→mdast-util-from-markdown, `streamdown`→hast-util-to-jsx-runtime | `element.innerHTML = '&' + value + ';'`          | a `character-entities` lookup table |
| `hast-util-from-html-isomorphic`   | `@streamdown/math` → `rehype-katex`                                                                             | `new DOMParser()` + `template.innerHTML = value` | `hast-util-from-html` (parse5)      |

The first one is the nastier of the two: it decodes HTML entities, so under
enforced Trusted Types **any message containing `&amp;` renders blank**.

**Which build you get depends on your bundler AND your mode** — measured in this
repo on the Vite demo app it shipped at the time (since removed, 80a12fb):

|                                    | dev (Vite/esbuild pre-bundle) | production (Rollup) |
| ---------------------------------- | ----------------------------- | ------------------- |
| `decode-named-character-reference` | DOM build selected            | DOM-free already    |
| `hast-util-from-html-isomorphic`   | DOM build selected            | DOM build selected  |

So a smoke test in one mode tells you nothing about the other. With the aliases
below, both resolve to the DOM-free build in both modes — verified by rebuilding
with and without them.

### 2.2 The fix — alias both to their DOM-free builds

⚠️ **The replacement must be an absolute path, not a package subpath.**
`decode-named-character-reference` uses the conditions-shorthand `exports` form
with no `"."` key and no subpaths; `hast-util-from-html-isomorphic` exposes only
`"."`. An alias like `"decode-named-character-reference/index.js"` fails with
`ERR_PACKAGE_PATH_NOT_EXPORTED`.

Node's CJS resolver gives you the right file: its conditions are
`node`/`require`/`default` — never `browser` — so it lands on the DOM-free build.

```ts
// vite.config.ts
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

export default defineConfig({
  resolve: {
    alias: {
      "decode-named-character-reference": require.resolve("decode-named-character-reference"),
      "hast-util-from-html-isomorphic": require.resolve("hast-util-from-html-isomorphic"),
    },
  },
});
```

webpack and Next.js take the same `resolve.alias` shape (in Next, inside
`webpack(config)`).

**pnpm wrinkle:** both packages are _transitive_, so under pnpm's isolated layout
`require.resolve` throws from your app root. Add them as direct `devDependencies`
(or hoist them via `.npmrc`) for the alias to resolve. This repo dogfoods exactly
that in `apps/docs`, and `pnpm tt-aliases:check` resolves both packages for real
on every CI run — so this snippet, unlike §2.7, is still continuously proven.

**Cost, honestly:** the `decode-named-character-reference` DOM-free build pulls
`character-entities` (~10 KB) — cheap, do it unconditionally. The
`hast-util-from-html-isomorphic` one pulls parse5 (~100 KB+) and runs on _every_
math render — worth it only when Trusted Types is actually enforced.

### 2.3 Why the library can't fix this for you

- pnpm `overrides` / npm `overrides` / yarn `resolutions` are read from the **root
  manifest of the project being installed**, so a field in the `@qlik-coe-emea/qlabs-components-ai` tarball
  is ignored. And they remap **versions** — this is **export-condition
  selection**, which no package manager can change.
- No `package.json` field of a dependency alters how _your_ bundler resolves a
  _transitive_ package's conditions. `imports` (`#specifier`) applies only inside
  the declaring package, and these two are three levels deep.

### 2.4 DOMPurify

Mermaid uses DOMPurify, which creates a Trusted Types policy named `dompurify`
whose `createHTML` and `createScriptURL` are **pass-throughs**. Allowlist it:

```
trusted-types dompurify;
require-trusted-types-for 'script';
```

Two things that make this easy to miss:

- **It is not created at import time.** `_createTrustedTypesPolicy` runs only via
  `_parseConfig`, reached from `sanitize()`/`setConfig()` — i.e. on the _first
  Mermaid render_. A page that never shows a diagram never trips it. (As of
  ADR 0019 Mermaid is also lazily loaded, so that first render is also when the
  engine arrives.)
- **The smoke-test trap.** With Trusted Types enforced and no allowed policy,
  DOMPurify degrades to returning `""` — **except** for input containing no `<`,
  which takes an early no-HTML path and passes through unchanged. So "I tested it
  with plain text and it rendered fine" is a false negative. Probe with real
  markup, e.g. `<b>x</b>`, and expect an empty string when the policy is blocked.

### 2.5 A `default` Trusted-Types policy is unavoidable if you render Mermaid

Sanitising is not sufficient. The sanitised SVG still has to **cross a DOM sink**,
and React's `dangerouslySetInnerHTML` is a plain `Element.innerHTML` write. Trusted
Types blocks it however clean the string is, and the throw unmounts the React tree
(measured: `#root` emptied the moment the first Mermaid diagram finished rendering).
React exposes no TrustedHTML-typed prop, so the only document-level fix is a policy
literally named `default`, which the browser consults for every otherwise-untyped
sink write.

The sinks that reach it, all third-party or third-party-shaped: `streamdown`'s
mermaid block (via `MessageResponse`), Mermaid writing its generated CSS and its
HTML node labels, `@qlik-coe-emea/qlabs-components-editor`'s `mermaid-viewer` /
`mermaid-diagram` / `markdown-academic/math`, and
`@qlik-coe-emea/qlabs-components-ai`'s `schema-display`.

**A `default` policy that returns its input switches Trusted Types off for the
whole document.** Don't ship that. `docs/examples/trusted-types.ts` is the
reference shape: it enumerates what those sinks are known to emit (a full `<svg>`
document, Mermaid's small label tag set, markup-free strings) and **throws on
anything else**, so a newly-introduced sink fails loudly instead of quietly
reopening the hole. It is a tripwire, not a sanitiser — **an app that renders
untrusted user HTML must not copy it**; that app's default policy body belongs to
`DOMPurify.sanitize(input)`.

### 2.6 Monaco mints `defaultWorkerFactory` twice — memoize, don't `'allow-duplicates'`

`monaco-editor@0.55` ships the "mint the `defaultWorkerFactory` policy at module
init" block in **two different source files** —
`vs/base/browser/webWorkerFactory.js` (reached from `editorWorkerService`) and
`vs/common/workers.js` (the pre-bundled `createWebWorker` surface reached from
`editor.api`). Both are in the main-thread graph, so both run, in dev **and** in a
Rollup production build. No bundler can dedupe them: they are distinct source
files, not one module resolved twice.

Under `require-trusted-types-for 'script'` the second call is refused — _"a
TrustedTypePolicy with that name already exists and the directive does not contain
'allow-duplicates'"_ — and Monaco surfaces it through `onUnexpectedError`.

The tempting fix is to add `'allow-duplicates'` to the `trusted-types` directive.
**Don't** — that permits _any_ script to re-register _any_ policy name, which is a
real relaxation for a bug that is not yours. Monaco checks
`MonacoEnvironment.createTrustedTypesPolicy` before falling back to
`trustedTypes.createPolicy`, so the fix is a memoizing hook.
`@qlik-coe-emea/qlabs-components-editor/monaco-environment` installs one — if you
wire `MonacoEnvironment` yourself, cache by policy name:

```ts
const cache = new Map();
globalThis.MonacoEnvironment = {
  createTrustedTypesPolicy(name, options) {
    if (!cache.has(name)) {
      try {
        cache.set(name, globalThis.trustedTypes?.createPolicy(name, options));
      } catch {
        cache.set(name, undefined);
      }
    }
    return cache.get(name);
  },
  // …getWorker
};
```

### 2.7 The policy this repo recommends

**Serve it as a real response header, not a `<meta http-equiv>`** — a meta tag
silently ignores `frame-ancestors`/`report-*`, and it is a second copy of the
policy that drifts from what the deployment actually sends.

The single source is [`docs/csp-policy.json`](./csp-policy.json), and
`pnpm csp:check` (`scripts/check-csp-policy.mjs`) keeps the two blocks below equal
to it in meaning, requires a named carve-out for every relaxation, and rejects any
carve-out naming a source the policy no longer contains. So the policy and its
published explanation cannot drift from each other.

**What that gate does NOT do, since 80a12fb:** prove the policy works. The app
that served this header and the E2E test that caught real browser violations were
both deleted on 2026-08-02, and the removal was completed deliberately on
2026-08-10. Every relaxation below was measured against a running browser when it
was added, and the reasons in `carveOuts` record those measurements — but nothing
re-runs them. Verify against your own build before you rely on it.

**Published policy** — what a consumer's production build has to allow:

<!-- csp:published -->

```
default-src 'self';
img-src 'self' data: blob: https://models.dev https://basemaps.cartocdn.com;
media-src 'self' blob:;
connect-src 'self' https://ejiidnob33g9ap1r.public.blob.vercel-storage.com https://basemaps.cartocdn.com;
script-src 'self' 'wasm-unsafe-eval';
style-src 'self' 'unsafe-inline';
trusted-types dompurify default editorViewLayer richScreenReaderContent domLineBreaksComputer diffReview diffEditorWidget editorGhostText stickyScrollViewLayer defaultWorkerFactory standaloneColorizer tokenizeToString;
require-trusted-types-for 'script';
```

**Dev-server delta** — `vite dev` needs strictly more than the published policy.
These are **build-tool artifacts, not library requirements**, and are deliberately
NOT folded into the published policy: doing so would make this dogfood claim a
consumer needs them.

<!-- csp:dev -->

```
default-src 'self';
img-src 'self' data: blob: https://models.dev https://basemaps.cartocdn.com;
media-src 'self' blob:;
connect-src 'self' https://ejiidnob33g9ap1r.public.blob.vercel-storage.com https://basemaps.cartocdn.com;
script-src 'self' 'wasm-unsafe-eval' 'unsafe-inline';
style-src 'self' 'unsafe-inline';
trusted-types dompurify default editorViewLayer richScreenReaderContent domLineBreaksComputer diffReview diffEditorWidget editorGhostText stickyScrollViewLayer defaultWorkerFactory standaloneColorizer tokenizeToString;
require-trusted-types-for 'script';
```

`script-src 'unsafe-inline'` (dev only): Vite injects the `@vitejs/plugin-react`
Refresh preamble as an inline module script into `index.html`; blocking it kills
HMR ("can't detect preamble"). `vite build` emits only external hashed scripts.

#### Every relaxation, and why it could not be avoided

Read this as the honest cost of the policy above. Three of the five are **droppable
by not rendering a feature** — they are not a floor.

| Relaxation                            | Why it is there                                                                                                                                                                                                                                                                                                                 | Drop it by…                                                                   |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `style-src 'unsafe-inline'`           | **Not droppable, and not a dev artifact.** React writes a `style` attribute for every `style={{…}}` prop; React Flow (node/viewport transforms), Radix (popper positioning) and Recharts (responsive sizing) all depend on it. Attribute styles written from JS take no nonce, and their hashes are not knowable at build time. | nothing — measured 276 blocked inline styles (54 distinct) on one walkthrough |
| `img-src data:`                       | Inline SVG/PNG data URIs in icon and chart output.                                                                                                                                                                                                                                                                              | nothing practical                                                             |
| `img-src blob:` + `media-src blob:`   | `@qlik-coe-emea/qlabs-components-viewer` opens files the app did not write. An upload or an agent's output arrives as a `File`/`Blob`, which has no URL — so the viewer mints one with `URL.createObjectURL` and revokes it on dispose. Same-origin, cannot execute script. **Derived from the code, not re-measured.**         | viewing only files that already have a URL you control                        |
| `script-src 'wasm-unsafe-eval'`       | `Persona` instantiates the Rive WebGL2 runtime from a `.wasm` bundled on your own origin.                                                                                                                                                                                                                                       | not rendering `Persona`                                                       |
| `trusted-types dompurify` + `default` | Mermaid's DOMPurify pass-through policy (§2.4) and React's `dangerouslySetInnerHTML` (§2.5).                                                                                                                                                                                                                                    | not rendering Mermaid, KaTeX math, or `SchemaDisplay`                         |
| `trusted-types` × 10 Monaco names     | Monaco calls `trustedTypes.createPolicy` under ten fixed names at module init, including `defaultWorkerFactory` for its language workers. Ten **names** — not `'allow-duplicates'`, see §2.6.                                                                                                                                   | not rendering `CodeEditor`/`DiffEditor`/`CodeWorkspace`/`MermaidDiagram`      |

---

## 3. Offline / air-gapped checklist

1. Self-host the Persona `.riv` files; pass `src` (or don't render `Persona`).
2. Self-host provider logos; pass `src` to `ModelSelectorLogo` (or `fallback`).
3. Pass `mapStyle` (or `blank`) to `MapCanvas`.
4. Don't render `OpenIn*`.
5. Fonts already ship inside `@qlik-coe-emea/qlabs-components-tokens` — no remote font origin is used.
6. Apply the §2.2 aliases if Trusted Types is enforced.
7. Start from the §2.7 policy, then delete the relaxations for the features you
   don't render — three of the five come off that way. **Verify against your own
   build**, which this repo no longer does for you (§2.7): serve the header from
   your dev and preview servers, and make the probe render real markup, never
   plain text (§2.4).
