---
description: Research a brand from your links and files, then propose (and on approval write) a new theme family
argument-hint: "<theme name> [links, file paths, brief — e.g. 'Snowflake https://www.snowflake.com ./brand-guide.pdf']"
---

Invoke the `brand-ui-create-theme` skill with `$ARGUMENTS` and follow
@skills/brand-ui-create-theme/SKILL.md exactly.

In this repository the family goes into `themes/<slug>/` next to Ocean and Qlik: scaffold with
`pnpm theme:new`, verify with `pnpm check --rule community-themes`, wire Storybook with `pnpm gen`,
and add the row to `themes/README.md`. Nothing is written before the proposal is approved.
