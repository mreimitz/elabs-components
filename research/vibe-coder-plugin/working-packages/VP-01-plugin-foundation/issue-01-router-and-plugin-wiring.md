---
TYPE: issue
TITLE: "[plugin] Add the brand-ui-start router skill + wire the plugin for Cowork + Code"
LABELS: type:tech-debt, severity:P1, area:ai, area:governance, needs-triage
WP: VP-01
---

## Summary

Give the plugin a single, obvious front door. Add a `brand-ui-start` router skill that asks "what do
you want to do?" and routes to **build a new app** (`new-app`/VP-02), **improve an existing app**
(`migrate`/VP-03), or **just help me use brand-ui** (`brand-ui`). Register the new skills/subagents/
hooks and declare the MCPs, and verify the one plugin installs and runs in both Cowork and Claude Code.

## Source

[`../../01-plugin-landscape.md`](../../01-plugin-landscape.md),
[`../../04-skills-functions-architecture.md`](../../04-skills-functions-architecture.md).

## Severity & impact

**P1.** Without a router, the guided product is just loose skills; this is the entry point that makes it
feel like one experience.

## Current state & why the gap exists

The plugin exists (`.claude-plugin/plugin.json` → `./skills` + `./agents`) but has no end-user router
and isn't yet wired for the two flagship flows or the MCPs.

## Proposed solution

- Add `skills/brand-ui-start/SKILL.md` (user-invocable): one `AskUserQuestion` round routing to
  `new-app` / `migrate` / `brand-ui`; degrade gracefully in plain chat (offer the consumer skill).
- Register the (forthcoming) `new-app`, `migrate` skills + their subagents in the plugin; add the
  WP-10 hooks; declare `brand-ui` MCP (WP-03) + Storybook MCP in `.mcp.json`.
- Confirm dual-surface behavior: skills + MCP in chat/Cowork/Code; subagents + hooks in Cowork/Code.
  Document install for both (Code marketplace already wired; Cowork UI install — preview).
- Use `${CLAUDE_PLUGIN_ROOT}` for any bundled script/asset paths.

## Affected files

- [ ] `skills/brand-ui-start/SKILL.md` (new)
- [ ] `.claude-plugin/plugin.json` (skills/agents/hooks), `.mcp.json` (MCPs)
- [ ] `scripts/build-skills.mjs` (include new skills in the multi-harness mirror)
- [ ] docs: install for Cowork + Code

## Acceptance criteria

- [ ] `brand-ui-start` routes to the three flows via one question.
- [ ] The plugin installs + runs in **both** Cowork and Claude Code; MCPs resolve; subagents/hooks
      active in Cowork/Code.
- [ ] Plain-chat degradation works (no subagents/hooks, but skills/MCP answer).

## Test to add

A smoke check that the plugin manifest is valid and each declared skill/agent/hook/MCP path resolves
(extend the repo's validation). Manual: install in Cowork + Code, run the router.

## Risks / ripple effects

- Cowork install is a **2026 preview** — document, don't hard-depend on org-marketplace features.

## References

- `../../01-plugin-landscape.md`; existing `.claude-plugin/`, `docs/CONCEPT-ai-skills.md`; WP-03 (MCP).
