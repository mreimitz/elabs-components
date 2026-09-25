/**
 * status-tone — the closed tone vocabulary, as a pure module.
 *
 * `StatusBadge`'s escape hatch (`CustomStatus.tone`) and the definition base's
 * `status` group (`./definition/groups/status.ts`) read the same tuple. It lives
 * here, with no imports, so the React-free `@elabs-ai/components-ui/definition`
 * subpath can use the runtime values without importing a component module.
 * `status-badge.tsx` re-exports both names unchanged.
 */

/** Closed tone set for the out-of-vocabulary escape hatch (CALM treatments only). */
export const STATUS_TONES = ["neutral", "info", "success", "warning", "destructive"] as const;

export type StatusTone = (typeof STATUS_TONES)[number];
