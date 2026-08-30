/**
 * lib/semver-lite.mjs — a minimal, dependency-free comparator for THIS repo's
 * own version shape, shared by `publish-registry-pages.mjs` (must not let an
 * out-of-order/retried release publish move `r/latest` backward) and
 * `check-registry-published.mjs` (must know which immutable `r/<version>/`
 * snapshots to probe for rot, newest first).
 *
 * Deliberately not the `semver` npm package: this repo's versions are always
 * `MAJOR.MINOR.PATCH` with an optional `-prerelease` suffix — the exact shape
 * `publish-registry-pages.mjs`'s `planRegistrySite` already requires — so a
 * small hand comparator is enough and keeps both gates dependency-free. It is
 * NOT a full SemVer 2.0.0 precedence implementation (e.g. it does not split a
 * prerelease into dot-separated identifiers and compare them numerically);
 * this repo's prereleases are plain `-rc.N` strings, so a lexicographic
 * compare of the whole suffix is sufficient here.
 */

/**
 * @param {string} v
 * @returns {{ major: number, minor: number, patch: number, pre: string | null }}
 */
function parseVersion(v) {
  const [core, pre = null] = String(v).split("-", 2);
  const [major, minor, patch] = core.split(".").map(Number);
  return { major, minor, patch, pre };
}

/**
 * Compare two semver-shaped version strings. Returns -1/0/1 (the
 * `Array.prototype.sort` comparator convention): negative when `a` < `b`,
 * positive when `a` > `b`. A release (no `-pre` suffix) always outranks a
 * prerelease of the same core version (`4.0.0` > `4.0.0-rc.1`).
 *
 * @param {string} a
 * @param {string} b
 */
export function compareVersions(a, b) {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  for (const key of /** @type {const} */ (["major", "minor", "patch"])) {
    if (pa[key] !== pb[key]) return pa[key] < pb[key] ? -1 : 1;
  }
  if (pa.pre === pb.pre) return 0;
  if (pa.pre === null) return 1;
  if (pb.pre === null) return -1;
  return pa.pre < pb.pre ? -1 : pa.pre > pb.pre ? 1 : 0;
}
