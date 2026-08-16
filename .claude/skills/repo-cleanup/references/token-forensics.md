# Token forensics

Load in `tokens` mode and in a full audit. How to read `usage-forensics.mjs` and what it can and
cannot prove.

## Why this exists

Static inspection of `CLAUDE.md`, skills and MCP config tells you the **floor**. It cannot tell you
what a session actually cost, and it is structurally blind to subagents — which in the first repo
this ran against were **81 % of all spend**. If a report recommends trimming instructions without
having read the transcripts, it is optimising the smaller term.

## What the numbers are

Every figure comes from a transcript line's `message.usage` block, which is what the API returned.
These are **measured, not estimated**, and may carry `confidence: confirmed`:

| Field                         | Meaning                                                            |
| ----------------------------- | ------------------------------------------------------------------ |
| `input_tokens`                | Fresh, uncached input                                              |
| `cache_read_input_tokens`     | Re-read of already-cached context — **normally the dominant term** |
| `cache_creation_input_tokens` | Newly cached this request                                          |
| `output_tokens`               | Generated, including thinking                                      |

**Context size for a request** = `input + cache_read + cache_creation`. That is the number that
grows, and the number cost scales with.

## The four things to look at

### 1. `floorLatest` — what a new session costs today

`floor` is the cheapest session start ever observed (historical). **`floorLatest` is the one to
cite**; quoting the minimum as if it were current is the easiest way to make a report wrong. When
`floorLatest.note` is present, the floor has grown and that growth is itself a finding.

Cross-check against `context-footprint.mjs`: the difference between `floorLatest.tokens` and
`totals.combinedEstimatedTokens` is harness overhead — system prompt, built-in tool schemas — which
no repo change can move. Say so, or the report blames docs for bytes they do not own.

### 2. `sessions[].growthPerTurn` and `curve`

A least-squares slope of context against request index. With floor `F` and slope `g`, a session of
`n` turns costs roughly:

```
n × F  +  g × n² / 2
```

The second term is quadratic. A session that starts at 60 k and grows 700 tokens/turn is paying
~11× at turn 550 what it paid at turn 0. **This is the finding that matters most in a long-running
repo**, and its severity depends on how long sessions actually run — check `requests`, don't assume.

### 3. `subagents` — the leaderboard

Each sidecar is a full context of its own. `counterfactual` models the same work split across `k`
fresh contexts using the fitted slope. It is **modelled, not re-run** — say "modelled" in the
finding, and quote the measured `cacheRead` alongside it.

A subagent with hundreds of turns and a peak in the hundreds of thousands is not a subagent; it is
a second session. The remedy is scope (one bounded deliverable, written handoff, fresh context),
not prompt frugality.

### 4. `materialMix`

Share of characters by kind. This answers _what_ filled the window:

- `toolResult` dominant → outputs are too big. Narrow the commands, filter, paginate, stop dumping
  whole files.
- `toolUseInput` dominant → prompts/arguments are too big. Stop pasting file contents into briefs.
- `image` material → screenshots are expensive; take fewer, or crop.
- `thinking` at 0 does **not** mean thinking was free — it means these transcripts do not persist
  thinking blocks. Do not report a 0 here as a finding.

## Privacy — non-negotiable

The script emits **counts, token totals, timestamps and tool names only**. No message text, no tool
arguments, no tool results, no file contents. `tests/usage-forensics.test.mjs` seeds a transcript
with sentinel strings and asserts none reach the output.

Tool _names_ are deliberately allowed: they are API metadata with a fixed vocabulary, and
`TOK.tool-calls` is one of the more actionable observations. Everything else about a tool call
stays in the transcript.

When quoting a session in a finding, use its id and timestamps. Never characterise what the session
was _about_ — that requires reading content this analysis did not read.

## Cost

`cost.available` is `false` unless `.repo-cleanup.yml` sets `pricing` (USD per **million** tokens):

```yaml
pricing: { input: 15, output: 75, cacheRead: 1.5, cacheCreation: 18.75 }
```

Absent by default on purpose — guessing a price list makes the most quotable number in the report
the least defensible one. When present the figure is still an **estimate**: it ignores discounts,
plan tiers and model mix. Label it as one every time, including in the executive summary.

## Observation windows

`--since <ISO>` bounds the window. Use it when a settings change has landed and you want the after
picture — otherwise months of history dilute the signal and the report describes a repo that no
longer exists.

**Do not conclude "unused" from one session.** A plugin or MCP server absent from a single
transcript is not evidence of absence. Use a window wide enough to contain the work it would serve,
and say what the window was.

## Turning observations into findings

| Observation                                   | Finding shape                                                                                                                                         |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TOK.session-floor-current`                   | `TOK-` finding, `frequency: per-request`, `scope: every-session`. Impact = floor × requests in the window. Confidence `confirmed`.                    |
| `TOK.context-growth`                          | The quadratic finding. Severity from actual session length; `informational` if sessions are short.                                                    |
| `TOK.subagent-share` / `TOK.longest-subagent` | Usually the highest-priority finding in the report. Recommend scope-capping, and quote both the measured `cacheRead` and the modelled counterfactual. |
| `TOK.material-mix`                            | Points at _which_ remedy: narrower tool output vs smaller briefs vs fewer screenshots.                                                                |
| `TOK.tool-calls`                              | Supporting evidence, rarely a finding alone. A very high `Bash` count with a high `toolResult` share is the "unbounded command output" pattern.       |

## Limits — state these in every `TOK-` finding

- Transcripts show what the client sent and received. They **cannot** attribute cost to a specific
  skill, rule file, or MCP server. Any such attribution is inference and must be labelled.
- Sessions resumed from a previous context have a first request that is not a floor. The script
  reports `requests` alongside each floor so an outlier is visible; check before citing.
- Unparseable lines are counted (`malformedLines`) and excluded. If that count is non-zero, the
  totals are lower bounds.
- Absence of transcripts is reported as `resolved: false` with a reason. That is **unavailable**,
  not zero, and a finding must never be written from it.
