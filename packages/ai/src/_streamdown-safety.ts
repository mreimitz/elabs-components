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
