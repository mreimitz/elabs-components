# Context budget

Load in `context` mode and in a full audit. How to read `context-footprint.mjs` output and what to
recommend from it.

## The cost model

Per-request input cost is dominated by re-reading the conversation. Two terms:

```
total ≈ turns × floor  +  growth_per_turn × turns² / 2
```

- **floor** — what request #1 costs with nothing done: system prompt, tool schemas, instruction
  files, skill/agent listings, MCP wiring, hook injections.
- **growth** — everything the session accumulates. This term is **quadratic in turns**, which is
  why a long session's last quarter costs more than its first three quarters combined, and why
  splitting work across fresh contexts beats any amount of per-turn frugality.

Both levers matter, but they are not equal: cutting the floor is linear and safe; capping turns
per context is quadratic. **Recommend the turn cap first when both apply.**

## Reading the output

`context-footprint.mjs` reports bytes and `chars / 4` token estimates. Anchor rules:

- `totals.alwaysLoadedBytes` — instruction files loaded on every request in every session **and
  every subagent**. This is the number that multiplies by tens of thousands of requests.
- `totals.listingChars` — skill + agent + command descriptions. Grows silently when a plugin is
  enabled; the owner never sees it in a diff.
- `instructions[].alwaysLoaded === false` — nested `CLAUDE.md` files. Real cost but conditional;
  never fold them into the always-loaded total.
- `levers` — the settings that govern everything above.
- `measurementGaps` — MCP tool schemas and hook output. **Report these as gaps.** Do not
  substitute an estimate for a number you did not take.

**Calibration.** Compare `totals.combinedEstimatedTokens` to the measured floor from
`usage-forensics.mjs` (request #1 of a fresh session). The residual is harness overhead — the
system prompt, built-in tool schemas, bundled skills — which no repo change can move. Naming the
residual is what stops a report blaming `CLAUDE.md` for bytes it does not own.

## The levers, and what each actually does

| Lever                                                         | Effect                                                                                                                           | When to recommend                                                        |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `model` (drop a `[1m]` variant)                               | A 1 M-context session never compacts; cost at turn 550 is ~11× turn 0.                                                           | When sessions routinely exceed a few hundred turns                       |
| `autoCompactWindow`                                           | Caps the quadratic term regardless of model.                                                                                     | Whenever a long-context model is kept deliberately                       |
| `effortLevel`                                                 | Thinking is billed as output. `xhigh` on trivial turns is pure waste.                                                            | When output-per-request is high across routine turns                     |
| `enabledPlugins: {…: false}` (project scope)                  | Removes that plugin's skills, agents, commands, hooks and MCP servers from the listing. Project settings override user settings. | When a plugin's skills are never invoked — check usage, not intuition    |
| `disableClaudeAiConnectors`                                   | Drops auto-fetched cloud connector tool listings for this repo.                                                                  | When connectors are unrelated to the repo's work                         |
| `skillOverrides: {name: off\|name-only\|user-invocable-only}` | Surgical: trims one skill's listing entry without disabling its plugin.                                                          | When a plugin is mostly wanted but one skill is huge and rarely relevant |
| `skillListingMaxDescChars` / `skillListingBudgetFraction`     | Global caps on listing size.                                                                                                     | Last resort — they truncate good descriptions along with bad             |
| Splitting instruction files                                   | Rules stay always-loaded; evidence moves to `docs/` or `reference/` and is linked.                                               | When a rule file is mostly measurements, history, or archaeology         |

Settings edits route through the bundled **`update-config`** skill, which owns `settings.json`
merge semantics. Do not hand-edit the file from here.

## What NOT to recommend

- **Do not recommend shortening instructions by default.** An instruction is wasteful only when its
  context cost exceeds its practical value, or when it is duplicated elsewhere. A 5 KB rule file
  that prevents one production defect a quarter is cheap. Cutting a rule that was paid for in
  incidents is a regression dressed as an optimisation — if the host repo's docs say a rule was
  earned, that is evidence _for_ keeping it loaded.
- **Do not recommend disabling a plugin or MCP server because one session did not use it.** Use a
  meaningful observation window from `usage-forensics.mjs`. Absence over one session is not
  evidence of absence.
- **Do not optimise for fewer tokens alone.** The target is
  **correctness-adjusted cost**: a cheaper setup that causes retries, missed rules, or regressions
  is more expensive. State this trade-off explicitly whenever a recommendation removes context.
- **Do not touch what the host repo's rules protect** — see `safety-model.md`.

## Recommendation ladder

Ordered by impact-per-risk. Prefer the earliest rung that resolves the finding.

1. **Cap turns per context.** Bound each agent's work, hand off in writing, respawn fresh rather
   than continuing a large context. Quadratic win, zero information loss.
2. **Set a compaction window** (and/or drop a `[1m]` model when it is not being used deliberately).
3. **Prune the listing** — disable unused plugins at project scope, `skillOverrides` for surgical
   cases, disable unrelated connectors.
4. **Split docs: rules stay, evidence moves.** Always-loaded files carry what every session needs;
   measurements, history and archaeology move to linked reference docs. Preserve section numbering
   so existing citations still resolve, and say where things went.
5. **Split large indexes into index + detail.** A ledger, a status file or a catalogue that must be
   read to pick work should be short, with per-item detail in its own file, linked.
6. **Trim prose** — last, smallest, and the only rung that risks losing a rule.

## Turning observations into findings

`observations[]` are facts. Each becomes a finding only with impact, confidence and a
recommendation attached:

- `CTX.always-loaded-total` → `CTX-00n`, severity from bytes × request volume (get volume from
  `usage-forensics.mjs`; without it, confidence is at most `medium` and impact is `unquantified`).
- `CTX.skill-listing-by-origin` → attribute cost to the plugin that causes it. Recommend disabling
  only with usage evidence.
- `CTX.long-context-model` / `CTX.no-compact-window` → the quadratic finding. High severity when
  sessions are long; `informational` when they are not. Check before claiming.
- `CTX.injecting-hooks` → a measurement gap, not a finding, unless the user authorises running the
  hook to size its output.
- `CTX.mcp-servers` → count and attribution only. Schema cost is a declared gap.
