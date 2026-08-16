import type { AdapterManifest } from "../../core/types";
import { PROTOCOL_VERSION } from "../../core/types";
import { CODE_EXTENSIONS } from "./code-language";

/**
 * Eager, data-only (see `image-manifest.ts`).
 *
 * Claims EXTENSIONS only — never the `code` category. That is what keeps the
 * plain-text adapter as the backstop: a `.log`, a `.env` or an unknown
 * extension still opens as text instead of failing to find a grammar, and a
 * consumer who never installs Shiki loses highlighting rather than the file.
 */
export const codeManifest: AdapterManifest = {
  id: "code",
  protocol: PROTOCOL_VERSION,
  extensions: CODE_EXTENSIONS,
  capabilities: { text: true, search: true, highlight: ["quote", "range"] },
  requires: ["shiki"],
};
