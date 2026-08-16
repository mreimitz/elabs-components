import type { AdapterManifest } from "../../core/types";
import { PROTOCOL_VERSION } from "../../core/types";

/**
 * Eager, data-only (see `image-manifest.ts`).
 *
 * `.mdx` is deliberately NOT claimed: it is JavaScript wearing markdown, and
 * rendering it would mean evaluating a foreign file's code — the one thing a
 * viewer must never do. An `.mdx` falls through to the plain-text adapter.
 */
export const markdownManifest: AdapterManifest = {
  id: "markdown",
  protocol: PROTOCOL_VERSION,
  extensions: ["md", "markdown", "mdown", "mkd"],
  mediaTypes: ["text/markdown"],
  // Both kinds address the SOURCE, which is what `text` is here — and both are
  // painted as a whole-block plate rather than as characters, because a source
  // offset can land inside markup the reader never sees. See `markdown-marks.ts`.
  capabilities: { text: true, search: true, highlight: ["quote", "range"] },
  requires: ["streamdown"],
};
