---
TYPE: issue
TITLE: "[ai] Auto-register and surface playbooks (manifest + context + skill), stale-gated"
LABELS: type:tech-debt, severity:P1, area:ai, area:docs, needs-triage
WP: WP-09
---

## Summary

Make playbooks **discoverable without manual bookkeeping**: a new playbook should automatically appear
in the manifest, the generated context file (WP-03 issue-04), the component/playbook index, and the
`brand-ui` skill's intent map — and a CI stale-check should fail if any of those drift. This is the
"enforcement over reminders" principle applied to playbooks: adding one is a single action, not a
checklist of files to update.

## Source

Maintainer requirement (enforcement over reminders); research doc 02 §B. Depends on the playbook format
from issue-01 and the generation/stale-gate machinery in WP-10.

## Severity & impact

**P1.** Without this, playbooks become another inventory to hand-maintain (exactly the pain the
maintainer wants gone). With it, playbooks stay in sync with zero effort and agents always see the
current set.

## Current state & why the gap exists

New (issue-01) — there's no registration path yet. The repo's existing pattern
(`check-package-registered.sh`, the manifest generator) is the model to extend to playbooks.

## Proposed solution

- Extend the manifest generator (`@qlik-coe-emea/qlabs-components-cli`) to **scan the playbooks directory** and include each
  playbook's `intent`, components, and path in `brand-ui.manifest.json`.
- Have `brand-ui context` (WP-03 issue-04) emit a **playbook index + intent map** into the agent-read
  files, so an agent matching a user intent ("dashboard") finds the right playbook automatically.
- Surface playbooks via `brand-ui search`/`docs` and a generated **playbook index page** for humans.
- **Stale-gate (WP-10):** a CI check + pre-commit hook fails if a playbook exists without a manifest
  entry / index entry, or if the generated index is out of date — with an actionable message.
- Update the `brand-ui` skill so the documented workflow includes "match intent → playbook → assemble."

## Affected files

- [ ] `packages/cli/lib/core.mjs` (scan + include playbooks in manifest)
- [ ] `bin/brand-ui.mjs` (`context` + `search`/`docs` surface playbooks)
- [ ] generated playbook index (page/`.md`)
- [ ] `skills/brand-ui/SKILL.md` (intent → playbook step)
- [ ] CI stale-check + registration hook (built in WP-10)

## Acceptance criteria

- [ ] Adding a playbook directory makes it appear in the manifest, the context file, and the index
      **with no other manual edits**.
- [ ] `brand-ui search <intent>` / the context file map a user intent to the right playbook.
- [ ] CI fails if a playbook is unregistered or the index is stale.
- [ ] The `brand-ui` skill documents the intent→playbook→assemble flow.

## Test to add

CLI test: a fixture playbook auto-appears in the generated manifest + index; the stale-check fails when
a playbook is added without regenerating. (Regression lock for the "no manual reminder" guarantee.)

## Risks / ripple effects

- Depends on WP-10's generation/stale-gate machinery — sequence after (or jointly with) WP-10's
  registration gate. Keep the intent map small and unambiguous so matching is reliable.

## References

- WP-03 issue-04 (context generator), WP-10 (stale-gate + registration gate); gap E8; the
  enforcement-over-reminders principle (doc 03 area G, doc 04 rule 3).
