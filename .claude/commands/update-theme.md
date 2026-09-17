---
description: Enhance an existing theme family from new links, files or a brief — per-token diff proposal first
argument-hint: "<existing family, e.g. qlik> [links, file paths, what should change]"
---

Invoke the `brand-ui-update-theme` skill with `$ARGUMENTS` and follow
@skills/brand-ui-update-theme/SKILL.md exactly.

In this repository the families live in `themes/<slug>/`. After the approved edits run
`pnpm check --rule community-themes` and `pnpm gen`, and keep the family README's source table
in step with every value you changed.
