/**
 * The runtime half of the #36 fix (the type-level `Omit` is the other half — see
 * `MarkdownViewProps`/`MessageResponseProps`).
 *
 * Streamdown installs its sanitiser chain (`rehype-raw` → `rehype-sanitize` →
 * `rehype-harden`) as the DEFAULT VALUE of its `rehypePlugins` prop — a plain
 * JS default parameter. Supplying the prop REPLACES the whole chain; there is
 * no merge (verified against `streamdown@2.5.0`'s `dist/chunk-BO2N2NFS.js`).
 * `remarkPlugins` has the same shape and feeds the same pipeline upstream.
 *
 * `MarkdownView`/`MessageResponse` render UNTRUSTED, model-authored markdown,
 * so neither prop may ever reach `<Streamdown>` — not even through a plain
 * JavaScript consumer, an `as any`/`as never` cast, or a wider
 * `{...spreadProps}` object a type-level `Omit` cannot see at runtime. `Omit`
 * closes the TypeScript surface; this function closes the runtime one. Both
 * are required — see issue #36.
 *
 * If a consumer genuinely needs to widen sanitisation, `allowedTags` /
 * `literalTagContent` are the supported seam: they MERGE into the sanitize
 * schema instead of replacing the pipeline outright.
 */
const SANITIZER_OVERRIDE_KEYS = ["rehypePlugins", "remarkPlugins"] as const;

/**
 * Deletes `rehypePlugins`/`remarkPlugins` off `props` in place (if present)
 * and warns in dev. Call this BEFORE spreading `props` onto `<Streamdown>`.
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
