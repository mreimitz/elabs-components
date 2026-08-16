/**
 * The Trusted-Types **default policy** this repo recommends, and why it exists.
 *
 * REFERENCE IMPLEMENTATION — copy it into your app; nothing in this repo runs it.
 * It was live in `apps/playground` until that app was deleted (80a12fb,
 * 2026-08-02) and kept here because `docs/CSP-AND-NETWORK.md` §2.5 publishes it
 * as the shape to copy. The observations below were measured while it WAS running.
 *
 * Running under a real `require-trusted-types-for 'script'` header
 * (`docs/csp-policy.json`) surfaced a gap the docs did not have:
 * sanitising HTML is not enough — the sanitised string still has to CROSS a DOM
 * sink, and React's `dangerouslySetInnerHTML` writes a plain string to
 * `Element.innerHTML`. Trusted Types blocks that however clean the string is, and
 * the throw takes the whole React tree down with it (observed: `#root` emptied to
 * 0 bytes the moment a Mermaid diagram finished rendering).
 *
 * The sinks that hit it, all third-party or third-party-shaped:
 *   - `streamdown`'s mermaid block (reached from `MessageResponse`), plus Mermaid
 *     itself writing its generated CSS and its HTML node labels
 *   - `@qlik-coe-emea/qlabs-components-editor` — `mermaid-viewer`, `mermaid-diagram`, `markdown-academic/math`
 *   - `@qlik-coe-emea/qlabs-components-ai`'s `schema-display`
 *   - `new Worker("<url string>")` from Vite's `?worker` transform, which is how
 *     `@qlik-coe-emea/qlabs-components-editor/monaco-environment` starts Monaco's five language workers
 *
 * None of them is fixable inside the library: React exposes no TrustedHTML-typed
 * prop, so a `dangerouslySetInnerHTML` needs a document-level policy. Per the
 * Trusted-Types spec that means a policy literally named `default`, which the
 * browser consults for every otherwise-untyped sink write.
 *
 * ## This is a TRIPWIRE, not a sanitiser
 *
 * A pass-through default policy would switch Trusted Types off for the whole
 * document — the silent widening this dogfood exists to catch. So this policy
 * enumerates exactly what the sinks above are known to emit and THROWS on
 * anything else: a newly-introduced sink fails loudly in dev and in CI
 * (`apps/e2e/tests/csp.spec.ts`) instead of quietly reopening the hole.
 *
 * That is the right shape HERE because the playground renders only its own
 * fixture content. **An app that renders untrusted user HTML must not copy this
 * file** — its default policy body should be `DOMPurify.sanitize(input)`. See
 * `docs/CSP-AND-NETWORK.md` §2.5.
 */

/** Matches a full SVG document — Mermaid's `render()` output. */
const SVG_DOCUMENT = /^\s*<svg[\s>]/i;

/** Tags Mermaid emits for HTML node labels (`htmlLabels`, on by default). */
const LABEL_TAGS = new Set([
  "p",
  "div",
  "span",
  "br",
  "b",
  "i",
  "em",
  "strong",
  "code",
  "sub",
  "sup",
]);

const TAG = /<\/?([a-z][a-z0-9-]*)\b[^>]*>/gi;
const EVENT_ATTRIBUTE = /\bon[a-z]+\s*=/i;
const ACTIVE_URL_SCHEME = /(?:javascript|data)\s*:/i;

/** Reject the two things that turn any of the allowed shapes into an injection. */
const hasActiveContent = (input: string) =>
  EVENT_ATTRIBUTE.test(input) || ACTIVE_URL_SCHEME.test(input) || /<\s*script\b/i.test(input);

/**
 * A string with no `<` cannot create an element — `innerHTML` parses it into a
 * single text node — so it is inert by construction. Two real sinks need it:
 * Streamdown's mermaid block renders `__html: ""` on the tick before the diagram
 * resolves, and Mermaid writes its generated diagram CSS into a `<style>` element
 * the same way. It is the same "no `<` takes a different code path" property that
 * makes DOMPurify smoke tests lie (`docs/CSP-AND-NETWORK.md` §2.4) — this is the
 * useful half of it.
 */
const isMarkupFree = (input: string) => !input.includes("<");

/** Only the small, attribute-light tag set Mermaid uses inside `foreignObject`. */
function isLabelMarkup(input: string): boolean {
  TAG.lastIndex = 0;
  let match: RegExpExecArray | null;
  let sawTag = false;
  while ((match = TAG.exec(input)) !== null) {
    sawTag = true;
    if (!LABEL_TAGS.has(match[1]!.toLowerCase())) return false;
  }
  // An unterminated `<script` would never match TAG; make sure nothing is left.
  return sawTag && !input.replace(TAG, "").includes("<");
}

declare global {
  interface Window {
    trustedTypes?: {
      createPolicy: (
        name: string,
        rules: {
          createHTML: (input: string) => string;
          createScriptURL: (input: string) => string;
        },
      ) => unknown;
    };
  }
}

/**
 * `new Worker("<url string>")` is a TrustedScriptURL sink. Same-origin only —
 * `worker-src` already resolves to `'self'` through `default-src`, and this stops
 * the policy from becoming a remote-script loader if a directive is ever loosened.
 */
function isSameOriginUrl(input: string): boolean {
  try {
    return new URL(input, window.location.href).origin === window.location.origin;
  } catch {
    return false;
  }
}

/**
 * Install the narrow `default` Trusted-Types policy. A no-op where Trusted Types
 * is unsupported (Firefox, Safari) or where `trusted-types` does not allow
 * `default`. Must run before React renders — `main.tsx` calls it first.
 */
export function installDefaultTrustedTypesPolicy(): void {
  const tt = window.trustedTypes;
  if (!tt) return;

  try {
    tt.createPolicy("default", {
      createHTML: (input) => {
        if (hasActiveContent(input)) {
          throw new TypeError("Refused: active content in a default Trusted-Types HTML sink.");
        }
        if (isMarkupFree(input) || SVG_DOCUMENT.test(input) || isLabelMarkup(input)) return input;
        throw new TypeError(
          "Refused to pass unrecognised HTML through the default Trusted-Types policy. " +
            "Sanitise it at the source, or widen apps/playground/src/trusted-types.ts deliberately.",
        );
      },
      createScriptURL: (input) => {
        if (isSameOriginUrl(input)) return input;
        throw new TypeError(
          `Refused a cross-origin script URL in the default Trusted-Types policy: ${input}`,
        );
      },
    });
  } catch {
    // `default` is not allowlisted, or a policy already exists. Not fatal: the
    // sinks simply stay blocked, which is the safe direction.
  }
}
