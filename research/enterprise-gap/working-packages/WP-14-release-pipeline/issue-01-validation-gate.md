---
TYPE: issue
TITLE: "[governance] Release validation gate — one blocking check (quality + docs + wiring + assets)"
LABELS: type:tech-debt, severity:P1, area:governance, area:test, needs-triage
WP: WP-14
---

## Summary

Build the single **blocking validation gate** every release must pass: it composes the A–I checks from
[`../../08-release-process.md`](../../08-release-process.md) — code quality, coverage + six-theme AA,
generated-artifact freshness (no drift), wiring/registration, **assets present**, plugin validity, docs
accuracy, safety, and release intent — and emits a **validation report** (green/red per check) stored
with the release. A release is impossible unless this is 100% green.

## Source

[`../../08-release-process.md`](../../08-release-process.md) (the gate); supersedes/extends the local
`/prepare-release` checklist.

## Severity & impact

**P1.** This is the "validate first — full quality, documented, wired, in place, assets present"
requirement. It's the difference between "we hope it's good" and "it's proven before it ships."

## Current state & why the gap exists

`/prepare-release` runs a subset (format/lint/typecheck/test/build/registry:validate) **locally** and
asks a human to publish. There's no CI, no coverage/asset/wiring/plugin/doc checks, no report.

## Proposed solution

- A `release:gate` script (and CI job) that runs, and **fails on any red**:
  - **A quality:** clean git, frozen install, format:check, lint, typecheck, test, build, test:e2e,
    test-storybook (interaction+axe), registry:validate.
  - **B coverage/AA:** story+test per component (WP-02/WP-10); committed six-theme AA artifact, 0 P0.
  - **C freshness:** regenerate + `git diff --exit-code` the manifest, context file, decision summary,
    component index/package tables, A2UI catalog, CHANGELOG (WP-03/10/11/12).
  - **D wiring:** check-package-registered + check-component-registered; plugin manifest ↔ existing
    skills/agents/hooks/MCP (no orphans, no dangling).
  - **E assets:** every referenced file resolves (registry `files[]`, skill/doc links, bundled plugin
    assets); icons/templates shipped (WP-13); every theme overrides every token; no orphan theme.
  - **F plugin:** plugin.json/marketplace.json schema-valid; plugin version == system version;
    skills:build clean; .mcp.json resolves; fresh-install smoke.
  - **G docs:** doc-truth guard (no false claims); CHANGELOG entry; ADRs for decisions; WP-12 current.
  - **H safety:** no secrets/abs paths; no raw hex outside themes.css; no paid deps; SemVer vs diff.
  - **I intent:** a changeset exists; owner approval.
- Emit `validation-report.md` (+ `--json`) consumed by the snapshot (issue-03).
- **Compose, don't duplicate:** reuse the WP-01 CI jobs + WP-10 hooks; the gate orchestrates them.

## Affected files

- [ ] `scripts/release-gate.mjs` (or compose existing scripts) + a `release:gate` package script
- [ ] `.github/workflows/release.yml` (gate job) — coordinate with WP-01
- [ ] `.claude/commands/prepare-release.md` (repoint to the gate)

## Acceptance criteria

- [ ] `release:gate` runs all A–I checks and **blocks on any failure**.
- [ ] It regenerates + diff-checks all generated artifacts (fails on drift).
- [ ] It validates the plugin (schema + version match + install smoke) and asset presence.
- [ ] It writes a `validation-report.md` (+ JSON) for the snapshot.

## Test to add

A failing fixture per category (e.g. a stale manifest, a missing registry file, a plugin/library
version mismatch) → the gate goes red; fix → green. Locks the gate's coverage.

## Risks / ripple effects

- Depends on the underlying gates (WP-01/02/10/11/12/13) existing — sequence after them; until then,
  the gate runs the subset that exists and clearly reports "not-yet-enforced" items.

## References

- `../../08-release-process.md`; WP-01/02/10/11/12/13; `/prepare-release`.
