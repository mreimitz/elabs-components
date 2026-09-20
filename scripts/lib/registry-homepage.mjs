/**
 * lib/registry-homepage.mjs — shared `registry.json` `homepage` validator.
 *
 * A pure function in its own module rather than a helper inside
 * validate-registry.mjs: that module is a top-level-executing CLI script (no
 * `main()` guard), so importing it for one helper would re-run its ENTIRE
 * validation pass, and its own `process.exit`, as a side effect of the import.
 *
 * ## Why `homepage` is required in practice, though still optional in shape
 *
 * `homepage` is the base URL every `npx shadcn@latest add …` command in the docs
 * is built from, and `pnpm registry:build` (shadcn) refuses to run without one on
 * a root registry. It names the website's own `/r` route, which is the only place
 * the registry is served. This validator still treats an ABSENT `homepage` as fine
 * (a private fork with no public host is a legitimate configuration), and still
 * rejects a PRESENT one that is empty, non-https, or a recognizable placeholder
 * host.
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
