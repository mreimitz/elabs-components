---
TYPE: epic (tracking issue)
TITLE: "[governance] WP-07 — Versioning, release engineering & governance"
LABELS: type:tech-debt, severity:P1, area:governance, area:docs, needs-triage
---

## Summary

For brand-ui to become _the standard many internal teams adopt_, it needs the operational spine that
lets teams **pin, upgrade safely, and leave gracefully**. Today: every package is `0.1.0`, there are
**no Changesets**, no changelog, no published-release process (a `prepare-release` command exists but
no pipeline), no deprecation/migration policy or codemods, and no defined governance roles
(`CODEOWNERS`, RFC, cadence). The migration story is the single most under-rated adoption factor
(doc 01, dim 8/11).

## Issues (split when filing)

### issue-01 — Changesets + changelog + release pipeline _(P1)_

- **What:** Adopt **Changesets** for versioning across the workspace; generate per-package changelogs;
  wire a release workflow (publish to the internal registry/npm, or tag + build artifacts) into CI
  (WP-01). Define how the `@qlik-coe-emea/qlabs-components-*` packages version (independent vs locked).
- **Why:** consumers can't pin or see what changed today; `PROJECT.md` already lists this under
  "Later."
- **Acceptance:** a changeset is required for package-affecting PRs (CI check); a release produces
  versioned packages + changelogs; documented release runbook; gap F1.

### issue-02 — Deprecation & migration policy (+ codemods where APIs break) _(P1)_

- **What:** Write a consumer-facing deprecation policy (how a component/prop is marked deprecated,
  the warning mechanism, the removal timeline) and a migration-guide convention. Add **codemods**
  (jscodeshift) for any breaking rename — the MUI/Atlassian-Hypermod model. Reconcile with the
  existing internal rule "delete superseded components" (fine internally; consumers need a path).
- **Why:** teams adopt what they can upgrade safely; doc 01, dim 8/11; gap F2.
- **Acceptance:** a documented deprecation policy; a template migration guide; at least one example
  codemod (or a documented "no breaking changes yet" stance with the mechanism ready).

### issue-03 — Governance roles: CODEOWNERS, RFC, cadence _(P2)_

- **What:** Add `CODEOWNERS` (who owns each package), an RFC-for-new-components note (when something
  earns a place in a `@qlik-coe-emea/qlabs-components-*` package vs a registry block — extends the existing package-vs-registry
  rule), and a stated release cadence + support expectation. Connect to the existing issue-workflow.
- **Why:** the "how many teams contribute without it becoming a mess" controls; doc 01, dim 11; gap
  F3.
- **Acceptance:** `CODEOWNERS` exists and is enforced (CI/branch protection); an RFC/contribution note
  is documented; cadence stated in `PROJECT.md`/`CONTRIBUTING.md`.

## Definition of done

- Changesets-driven releases with changelogs; a deprecation/migration policy (+ codemod mechanism);
  defined governance roles and cadence. Closes **F1, F2, F3, F4**.

## Dependencies

Depends on **WP-01** (CI to enforce changeset checks, CODEOWNERS, validate). Can otherwise proceed
independently; valuable before brand-ui is promoted as "the standard."
