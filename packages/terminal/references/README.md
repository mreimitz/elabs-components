# Provenance notes

The agent-session family in this package (#117) reproduces the **information design** of real
coding-agent CLIs. This directory records what each component's grammar was derived from, which
version it was measured against, what was actually checked, and — the part that matters most —
**where we deliberately diverged**.

The practice is borrowed from the upstream this family learns from, which commits real captured
terminal frames beside its components and names the CLI version in each docblock. It is cheap, and
it is what stops "what did we base this on?" drift once the original reading is a year old.

## Upstream

|               |                                                               |
| ------------- | ------------------------------------------------------------- |
| Project       | [`theswerd/brainless`](https://github.com/theswerd/brainless) |
| License       | MIT                                                           |
| Copyright     | `Copyright (c) 2026 Ben Swerdlow`                             |
| Dataset entry | `scripts/attributions.sources.json` (`id: "brainless"`)       |

The copyright line above was read off the upstream `LICENSE` file on 2026-09-01 and matches the
attribution dataset byte for byte. Per `.claude/rules/attribution.md` a license is never verified
from a badge, a README claim or memory.

**No upstream code, styling or terminal palette is shipped.** What crossed over is anatomy, state
models and accessibility mechanics, re-expressed on semantic tokens. Every colour in this package
comes from the `--terminal-*` / `--terminal-ansi-*` group, enforced by
`packages/terminal/src/no-raw-color.test.ts`.

## How the upstream captured its ground truth

Quoted from the upstream README:

> "Fidelity starts from real terminal output. The capture tools under `tools/capture/` drive agents
> in tmux, dump frames as ANSI / HTML / text, and land them in `references/captures/` for
> side-by-side review."

## Versions the grammar was measured against

**Re-verified against upstream on 2026-09-02**, file by file, rather than carried forward from the
analysis notes. This table now records only what an upstream file actually says. It replaces an
earlier version of this table that attributed a CLI version to every component — six of those
attributions were not supported by the file they named, which is exactly the drift these notes
exist to prevent, so the correction is recorded here rather than quietly applied.

| Upstream file                  | Version the file itself names | Component here                      |
| ------------------------------ | ----------------------------- | ----------------------------------- |
| `grok/grok-working.tsx`        | **v0.2.93**                   | `TerminalWorking`                   |
| `grok/grok-status.tsx`         | **v0.2.93**                   | `TerminalStatusBar`                 |
| `grok/grok-write.tsx`          | **v0.2.93**                   | `TerminalDiffHunk` (check sections) |
| `grok/grok-settings.tsx`       | **v0.2.93**                   | `TerminalOverlay` (frame only)      |
| `claude/claude-todo-list.tsx`  | **v2.1.207**                  | `TerminalTodoList`                  |
| `grok/grok-event.tsx`          | _none_                        | `TerminalEventLine`                 |
| `grok/grok-shortcuts.tsx`      | _none_                        | `TerminalOverlay`                   |
| `grok/grok-prompt.tsx`         | _none_                        | `TerminalComposer`                  |
| `claude/claude-tool-call.tsx`  | _none_                        | `TerminalToolCall`                  |
| `claude/claude-diff.tsx`       | _none_                        | `TerminalDiffHunk`                  |
| `claude/claude-permission.tsx` | _none_                        | `TerminalPermission`                |
| `claude/claude-prompt.tsx`     | _none_                        | `TerminalComposer`                  |
| `codex/codex-prompt.tsx`       | _none_                        | `TerminalComposer`                  |

A file that names no version still names its product ("Claude Code's collapsed tool/result line",
"a ◆ diamond event line from Grok's transcript") and still quotes captured examples, so the
grammar is sourced — it simply is not pinned to a release, and this table must not pretend
otherwise.

`v2.1.206` appears widely upstream (in `claude-header.tsx` and in many capture frames) and is what
the original analysis notes generalised to "the Claude family". That generalisation does not hold
per component and is not used here.

**How it was checked:** `gh api repos/theswerd/brainless/contents/<path> -H "Accept: application/vnd.github.raw"`
for each file above, grepping its own text for a version string. Reading another repository for
context; nothing was written to it.

## What these notes are, and are not

Read against the upstream **source** on 2026-09-01 — so they verify each component's own claims
about the captured grammar, not the captures themselves. That is one rung better than recall and
one rung short of the frames.

Nothing here is a rendering observation. No cross-theme or accessibility claim follows from it;
those are made against a real rendered story, per `.claude/rules/quality-gates.md`.

## Per-component notes

- [`agent-session-family.md`](./agent-session-family.md) — the grammar and the divergences,
  component by component.
