/**
 * The runtime half of the #36 fix (the type-level `Omit` is the other half — see
 * `MarkdownViewProps`/`MessageResponseProps`).
 *
 * Streamdown installs its sanitiser chain (`rehype-raw` → `rehype-sanitize` →
 * `rehype-harden`) as the DEFAULT VALUE of its `rehypePlugins` prop — a plain
 * JS default parameter. Supplying the prop REPLACES the whole chain; there is
 * no merge (verified against `streamdown@2.5.0`'s `dist/chunk-BO2N2NFS.js`:
 * `xt = { raw, sanitize, harden }; gn = Object.values(xt)` is the default, and
 * the component signature reads `rehypePlugins: a = gn`).
 *
 * `MarkdownView`/`MessageResponse` render UNTRUSTED, model-authored markdown,
 * so that prop may never reach `<Streamdown>` — not even through a plain
 * JavaScript consumer, an `as any`/`as never` cast, or a wider
 * `{...spreadProps}` object a type-level `Omit` cannot see at runtime. `Omit`
 * closes the TypeScript surface; this function closes the runtime one. Both
 * are required — see issue #36.
 *
 * `remarkPlugins` is deliberately NOT stripped (PR #74 review, round 1). It is
 * the same *shape* of prop — a consumer array replaces Streamdown's own remark
 * defaults (`gfm`, `codeMeta`) rather than merging with them — but it is NOT a
 * sanitiser override: the remark stage runs strictly UPSTREAM of the rehype
 * chain, and Streamdown derives its rehype list without reading `remarkPlugins`
 * at all. Anything a remark plugin injects — a raw `html` mdast node, a
 * `data.hName`/`hChildren` hast element, an `onerror` via `hProperties`, a
 * `javascript:` link URL, a smuggled `raw` hast child — still passes through
 * `rehype-raw` → `rehype-sanitize` → `rehype-harden` before it can reach the
 * DOM. Measured with this strip removed: all five channels executed and none
 * produced a `<script>`, an `[onerror]` attribute or a `javascript:` href,
 * while the identical payload injected AFTER the sanitiser did. Stripping it
 * therefore removed real capability (remark-directive, footnotes, custom
 * syntax) and closed nothing.
 *
 * If a consumer needs to widen what survives SANITISATION, `allowedTags` /
 * `literalTagContent` are the supported seam: they MERGE into the sanitize
 * schema instead of replacing the pipeline outright.
 *
 * THIS LIST HAS A PARITY COUNTERPART, AND EDITING ONE SIDE FAILS CI (#75).
 * `scripts/check-sanitizer-passthrough.mjs` declares the same key set as
 * `SAFE_RENDERERS[streamdown].dangerousProps` and reads THIS array literal back
 * out of this file, asserting set-equality in BOTH directions — so removing a
 * key here (the runtime stops stripping it) and removing a key there (the gate
 * stops looking for it) are each a red build, and so is renaming the constant
 * or rewriting it into a shape the gate cannot parse. Change the key set in
 * both places, in the same commit, or don't change it.
 */
const SANITIZER_OVERRIDE_KEYS = ["rehypePlugins"] as const;

/**
 * Deletes `rehypePlugins` off `props` in place (if present) and warns in dev.
 * Call this BEFORE spreading `props` onto `<Streamdown>`.
 *
 * Takes a plain object rather than a typed `MarkdownViewProps`/
 * `MessageResponseProps` on purpose: the whole point is to catch a value that
 * reached this call with a wider runtime shape than its type says (a `.tsx`
 * consumer with no type checking at all, a force-cast, a spread of a bigger
 * object) — a parameter typed to the post-`Omit` props would only accept
 * values TypeScript already believes are safe.
 */
export function stripSanitizerOverrides(props: object): void {
  const record = props as Record<string, unknown>;
  for (const key of SANITIZER_OVERRIDE_KEYS) {
    if (key in record) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(
          `[@elabs-ai/components-ai] \`${key}\` is not a supported prop on this component: ` +
            "it would replace Streamdown's default sanitiser chain (rehype-raw → " +
            "rehype-sanitize → rehype-harden) and let untrusted markdown execute " +
            "script in the host page. The value was ignored. Use `allowedTags` / " +
            "`literalTagContent` to widen sanitisation instead — see issue #36.",
        );
      }
      delete record[key];
    }
  }
}

/**
 * The CONVERSE of `SANITIZER_OVERRIDE_KEYS`: the plugin slots that deliberately
 * stay reachable even though they land in the DOM *after* — or entirely outside
 * — Streamdown's sanitiser chain (#76).
 *
 * - **`math.rehypePlugin` is APPENDED to the END of the rehype pipeline**, i.e.
 *   after `rehype-raw` → `rehype-sanitize` → `rehype-harden` (verified against
 *   `streamdown@2.5.0`'s `dist/chunk-BO2N2NFS.js`). Its output is never
 *   re-sanitised.
 * - **`mermaid` never enters the rehype/remark pipeline at all.** Its
 *   `getMermaid().render()` result is written via `dangerouslySetInnerHTML`
 *   (streamdown's only such sink). brand-ui's own default pins mermaid's
 *   `securityLevel: "strict"` (`_lazy-mermaid.ts`).
 *
 * `cjk` (remark-stage, re-sanitised downstream), `code` (feeds `shikiTheme`
 * only) and `renderers` (ordinary React components) are NOT trust-bearing and
 * are deliberately absent — a warning that fired on them would be noise
 * consumers learn to ignore.
 *
 * **This is not a live vulnerability and must not be described as one.**
 * Supplying an executable `Pluggable` takes code in the consuming app's own
 * bundle, and an app author who can do that can already run code. The real,
 * non-hypothetical hazard is MISCONFIGURATION — most sharply KaTeX's `trust`
 * option (needed for anything beyond `singleDollarTextMath`/`errorColor`),
 * which silently disables KaTeX's own sanitisation for model-authored content
 * the consumer never intended to trust. Hence: WARN, never strip. Stripping
 * would break the legitimate trusted use and is the breaking change #76
 * explicitly rejects — `markdown-view.test.tsx`/`message.test.tsx` pin the slot
 * OPEN so a future "hardening" fails loudly.
 */
const TRUSTED_PLUGIN_SLOT_ADVICE =
  "This is a supported, TRUSTED-CODE seam — the plugin still runs and nothing was " +
  "dropped — so treat it as code you ship: it can put arbitrary markup in the page. " +
  "If you only needed KaTeX options, prefer `createMathPlugin({ singleDollarTextMath, " +
  "errorColor })` and leave KaTeX's `trust` option off for model-authored content. " +
  "See docs/CSP-AND-NETWORK.md and issue #76.";

const isPluginObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

/**
 * Dev-only `console.warn` when a consumer's `plugins` override replaces one of
 * the two slots that are NOT upstream of the sanitiser. Call it where the
 * consumer's overrides are merged over the internal defaults, passing both.
 *
 * **Reference-equality comparator, deliberately — not truthiness, not a deep
 * compare.** `useStreamdownPlugins()` returns a FRESH `code` object on every
 * theme change but a STABLE `math`/`mermaid`, so a truthiness check would fire
 * on every theme flip and a deep-equality check would stay silent for a consumer
 * who rebuilds an equivalent-looking object each render. For `math` the
 * comparison narrows further to the `rehypePlugin` member itself, so changing
 * only `remarkPlugin`/`getStyles` (upstream of, or outside, the DOM sink) stays
 * silent.
 *
 * Warns; never mutates. `stripSanitizerOverrides` is the other half of the
 * boundary — the props that must never be reachable at all.
 */
export function warnOnTrustedPluginSlots(overrides: object | undefined, internal: object): void {
  if (process.env.NODE_ENV === "production") return;
  if (!overrides) return;
  const consumer = overrides as Record<string, unknown>;
  const defaults = internal as Record<string, unknown>;

  if (isPluginObject(consumer.math)) {
    const theirs = consumer.math.rehypePlugin;
    const ours = isPluginObject(defaults.math) ? defaults.math.rehypePlugin : undefined;
    if (theirs !== ours) {
      console.warn(
        "[@elabs-ai/components-ai] `plugins.math.rehypePlugin` is appended to the END of " +
          "Streamdown's rehype pipeline, so it runs AFTER the sanitiser chain " +
          "(rehype-raw → rehype-sanitize → rehype-harden) and whatever it emits is never " +
          `re-sanitised. ${TRUSTED_PLUGIN_SLOT_ADVICE}`,
      );
    }
  }

  if (isPluginObject(consumer.mermaid) && consumer.mermaid !== defaults.mermaid) {
    console.warn(
      "[@elabs-ai/components-ai] `plugins.mermaid` never enters the rehype pipeline at " +
        "all: its rendered SVG is written with `dangerouslySetInnerHTML`, i.e. after and " +
        "outside the sanitiser chain (rehype-raw → rehype-sanitize → rehype-harden). A " +
        "replacement plugin must sanitise its own output — brand-ui's default pins " +
        `mermaid's strict security level. ${TRUSTED_PLUGIN_SLOT_ADVICE}`,
    );
  }
}
