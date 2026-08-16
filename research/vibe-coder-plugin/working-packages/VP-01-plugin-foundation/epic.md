---
TYPE: epic (tracking issue)
TITLE: "[plugin] VP-01 — Plugin foundation: one guided plugin for Cowork + Code"
LABELS: type:tech-debt, severity:P1, area:governance, area:ai, needs-triage
---

## Summary

Extend brand-ui's existing plugin (`.claude-plugin/`, name `brand-ui`, v0.1.0) into a **guided plugin**
that serves internal vibe coders on both **Cowork** (guided experience) and **Claude Code** (in-repo
execution) from **one artifact**. Adds the router front door (`brand-ui-start`), wires the new
skills/subagents/hooks/MCP, and stands up the deterministic **engine functions** the two flows call.
Design: [`../../01-plugin-landscape.md`](../../01-plugin-landscape.md) +
[`../../04-skills-functions-architecture.md`](../../04-skills-functions-architecture.md).

## Why first

VP-02 (greenfield) and VP-03 (brownfield) both depend on the router, the plugin wiring, and the CLI
engine functions. This package makes the plugin a coherent product instead of a set of library skills.

## Child issues

- **issue-01-router-and-plugin-wiring** — add the `brand-ui-start` router skill; register the new
  skills/subagents/hooks + declare the MCPs (brand-ui MCP + Storybook MCP) in the plugin; verify it
  installs and runs in both Cowork and Code. _(P1)_
- **issue-02-cli-engine-functions** — add the deterministic backend the flows need:
  `brand-ui scaffold` / `scan` / `map` / `codemod` skeletons on `@qlik-coe-emea/qlabs-components-cli` (full behavior in
  VP-02/03), reusing the manifest + context + playbooks + templates. _(P1)_

## Definition of done

- One plugin, installable + runnable in **both** Cowork and Claude Code (skills/MCP everywhere;
  subagents/hooks in Cowork/Code).
- `brand-ui-start` routes the user to build-new / improve-existing / just-help.
- The CLI exposes `scaffold`/`scan`/`map`/`codemod` entry points (stubs OK; filled in VP-02/03).
- Plugin version bump via Changesets (enterprise-gap WP-07); `${CLAUDE_PLUGIN_ROOT}` used for bundled paths.

## Dependencies

Reuses enterprise-gap **WP-03** (manifest/context/MCP) + **WP-10** (gates) + **WP-07** (versioning).
Unblocks VP-02, VP-03, VP-04.
