/**
 * lib/registry-homepage.mjs — shared `registry.json` `homepage` validator.
 *
 * Extracted from validate-registry.mjs (#31) so a SECOND gate
 * (check-registry-published.mjs) can reuse the same placeholder/shape rules
 * without importing validate-registry.mjs itself. That module is a
 * top-level-executing CLI script (no `main()` guard) — importing it for one
 * helper would re-run its ENTIRE validation pass (and its own `process.exit`)
 * as a side effect of the import. Pulling the pure function out here keeps
 * both gates' failure modes independent and their own to report.
 *
 * ## Why `homepage` is required in practice, though still optional in shape
 *
 * `registry.json`'s `homepage` used to have nothing to point at — this repo
 * had no hosted registry endpoint, so a value here could only ever be a
 * placeholder. #31 fixed that: the registry is hosted on GitHub Pages
 * (`scripts/publish-registry-pages.mjs`), and `homepage` now names that real
 * base URL — both because `pnpm registry:build` (shadcn) refuses to run
 * without one on a root registry, and because it is the value
 * `check-registry-published.mjs` builds every hosted URL from. This
 * validator still treats an ABSENT `homepage` as fine (a private fork with no
 * public host is a legitimate configuration), and still rejects a PRESENT
 * one that is empty, non-https, or a recognizable placeholder host.
 */

const PLACEHOLDER_HOMEPAGE_RE =
  /example\.(internal|com|org)|<[^>]+>|localhost|your-registry-host|your-own-host/i;

/**
 * Validate a registry manifest's top-level `homepage`. Returns a violation
 * message string, or `null` if `homepage` is fine.
 * @param {string | undefined | null} homepage
 */
export function findHomepageViolation(homepage) {
  // Absent is fine — a fork with no public host has nothing to name.
  if (homepage === undefined || homepage === null) return null;
  if (typeof homepage !== "string" || !homepage.trim()) {
    return (
      "registry.json `homepage` is present but empty. Either omit the key, or " +
      "give an absolute, resolvable https:// URL."
    );
  }
  if (!/^https:\/\//.test(homepage)) {
    return `registry.json \`homepage\` "${homepage}" must be an absolute https:// URL.`;
  }
  if (PLACEHOLDER_HOMEPAGE_RE.test(homepage)) {
    return (
      `registry.json \`homepage\` "${homepage}" looks like a placeholder host — ` +
      "nothing serves it. Use a real, resolvable URL (e.g. the repo's GitHub URL)."
    );
  }
  return null;
}
