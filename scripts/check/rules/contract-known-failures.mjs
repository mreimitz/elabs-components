/**
 * contract-known-failures — every entry in `scripts/check/contract-known-failures.json`
 * is a TRACKED, ratcheted gap (S2): the generated contract-test suites
 * (`scripts/gen-contract-tests.mjs`) wrap each listed key in `it.fails(...)`, so
 * fixing the underlying component flips that test from an expected failure to
 * an unexpected pass — a locking test, not a silent mute.
 *
 * This rule does not re-run the generated tests (they need a browser/jsdom
 * runtime this dependency-free checker doesn't have); it makes the ratchet
 * itself visible in `pnpm check`: one finding per key, `baseline: "keys"`
 * against the shared `scripts/check/baseline.json`. Growing the known-failures
 * file without an explicit `--update-baseline` is therefore a review-visible
 * event, exactly like every other gate here — never a way to launder a new gap
 * that the fix should have addressed instead.
 *
 * Key shape: `"<storyId>|<theme>|<width>|<assertion>"` — `theme`/`width` are
 * literally `"jsdom"` for the dependency/context-free jsdom suite (it has
 * neither axis); the browser suite uses a real theme slug and pixel width.
 */
const KEY_RE = /^[^|]+\|[^|]+\|[^|]+\|[^|]+$/;

export function findContractKnownFailureIssues(knownFailures) {
  const findings = [];
  for (const [key, reason] of Object.entries(knownFailures ?? {})) {
    if (!KEY_RE.test(key)) {
      findings.push({
        file: "scripts/check/contract-known-failures.json",
        line: 1,
        msg: `malformed key (want "<storyId>|<theme>|<width>|<assertion>"): ${key}`,
      });
      continue;
    }
    if (typeof reason !== "string" || !reason.trim()) {
      findings.push({
        file: "scripts/check/contract-known-failures.json",
        line: 1,
        msg: `${key} has no reason string`,
      });
      continue;
    }
    findings.push({
      file: "scripts/check/contract-known-failures.json",
      line: 1,
      msg: `${key} — ${reason}`,
      key,
    });
  }
  return findings.sort((a, b) => (a.key ?? a.msg).localeCompare(b.key ?? b.msg));
}

export default {
  id: "contract-known-failures",
  scope: "components",
  doc: "Every scripts/check/contract-known-failures.json entry is a well-formed, ratcheted contract-test gap; the shared baseline makes the count visible so growing it is a reviewed move, not a silent mute.",
  baseline: "keys",
  run(ctx) {
    const knownFailures = ctx.exists("scripts/check/contract-known-failures.json")
      ? ctx.json("scripts/check/contract-known-failures.json")
      : {};
    return findContractKnownFailureIssues(knownFailures);
  },
  fixtures: {
    // A populated-but-well-formed file is the NORMAL case, not a fixture: it
    // legitimately yields one finding per entry (that's the whole point —
    // `baseline: "keys"` is what turns "yields findings" into "passes once
    // baselined"). Only the true edge cases belong here: empty (0 findings)
    // and malformed (≥1 findings, unconditionally — a bad key/reason is a
    // problem no baseline should ever exempt).
    pass: [{ files: { "scripts/check/contract-known-failures.json": "{}" } }],
    fail: [
      {
        files: {
          "scripts/check/contract-known-failures.json": JSON.stringify({
            "malformed-key": "missing pipes",
          }),
        },
      },
      {
        files: {
          "scripts/check/contract-known-failures.json": JSON.stringify({
            "core-button--default|jsdom|jsdom|data-slot": "",
          }),
        },
      },
    ],
  },
};
