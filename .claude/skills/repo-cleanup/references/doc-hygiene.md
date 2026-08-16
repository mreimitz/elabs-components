# Doc hygiene

Load in `docs` mode and in a full audit. How to read `doc-hygiene.mjs`.

## The question this mode answers

Not "is this prose too long" — **"is this prose in the right place?"** Instruction context splits
into two classes and the whole analysis turns on the distinction:

- **`load: always`** — `CLAUDE.md`, `.claude/rules/**`. Paid on **every request of every session and
  every subagent**. A byte here is multiplied by tens of thousands.
- **`load: on-demand`** — `SKILL.md` files, skill references, command files. Paid only when
  invoked.

Most instruction bloat is not excess writing. It is correctly-written material sitting in the wrong
class.

## Do not recommend shortening by default

An instruction is wasteful only when its context cost exceeds its practical value, or when it is
duplicated elsewhere. A five-kilobyte rule that prevents one production defect a quarter is cheap.

**If the host repo's own docs say a rule was paid for — an incident, a defect that reached the
default branch, a near miss — that is evidence FOR keeping it loaded.** Cutting it is a regression
dressed as an optimisation. Look for that framing before proposing a single deletion.

What you _can_ always propose is **relocation**: keep the rule always-loaded, move its evidence
on-demand.

## The four signals

### 1. `duplicates` — the same passage in two files

Lexical, word-level shingles (reflowed prose defeats line-level diffing). `duplicatedWords` and
`estimatedTokensIfBothAlwaysLoaded` size it; `excerpt` makes it actionable.

Two always-loaded files sharing a passage is a straightforward `DOC-` finding: pick one home, link
from the other. A duplicate between an always-loaded file and an on-demand one is usually _fine_ —
the on-demand copy is the reference.

**Limit:** two rules that say the same thing in different words are not detected. Absence of
duplicates is not absence of redundancy.

### 2. `staleCitations` — the dangerous one

A citation that no longer resolves is worse than a missing link, because a stale line number still
lands on **real text making a different point**. It reads as authoritative rather than broken.

Three classes, in descending severity:

| `problem`           | Meaning                                                                                                                  |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `line-out-of-range` | The file exists, the line does not. **Every other line citation into that file is now suspect** — say so in the finding. |
| `path-moved`        | A file of that name exists elsewhere; `foundElsewhere` names it. Cheap, high-value fix.                                  |
| `unresolved-path`   | No such file anywhere.                                                                                                   |

`likelyIntentional` flags citations whose surrounding text reads as deliberate — "deleted",
"no longer", "do not reintroduce" — or that point into another repository. **These are labelled,
not filtered**, because a suppressed finding cannot be argued with. Read the sentence before
filing one; the observation's `entries` already excludes them.

Resolution tries the citing file's directory, the repo root, and common source roots (`src`, `lib`,
`app`, …), because docs routinely abbreviate `src/` away. If `entryPoints`-style abbreviation is
still producing noise, say so rather than filing 30 findings.

### 3. `density` — measurements per 100 words

Markers are numbers-with-units, dates, and commit SHAs. High density in an **always-loaded** file
means the file is carrying evidence, not rules — the exact split signal:

> keep the rule loaded · move the measurement to a linked reference · preserve section numbering so
> existing citations still resolve · say in the rule file where the evidence went.

Density in an on-demand file is not a finding. That is where evidence is supposed to live.

### 4. `toolEnforceable` — rules a formatter already applies

Only reported when a formatter config actually exists (`formatters` lists which). A prose rule about
quote style or indentation next to a `biome.json` is context spent restating something already
mechanically enforced. Low severity, trivial effort, real.

### Bonus: `overlappingHeadings`

The same heading in two always-loaded files. Not a defect by itself — a **place to look** for a
contradiction. The script cannot detect contradictions and does not claim to.

## Turning observations into findings

| Observation                | Finding shape                                                                                              |
| -------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `DOC.totals`               | Context for other findings. A finding on its own only with usage data to size it.                          |
| `DOC.duplication`          | `frequency: per-request` when both files are always-loaded. Impact = the duplicated tokens.                |
| `DOC.stale-citations`      | Use `actionable`, not `total`. `line-out-of-range` is its own higher-severity finding.                     |
| `DOC.evidence-density`     | The relocation finding. `estimated_impact` = the bytes that would move, labelled as an estimate.           |
| `DOC.tool-enforceable`     | `low` severity, `trivial` effort. Name the formatter that already enforces it.                             |
| `DOC.overlapping-headings` | `informational`, `confidence: low`. Frame as "check these for contradiction", never as "these contradict". |

## Limits — state these in every `DOC-` finding

- Duplication is lexical only.
- Contradictions are not detected at all.
- Whether a rule earns its cost is a judgement no script makes; if the finding depends on that
  judgement, say whose judgement it is.
- Token figures are `chars / 4` **estimates**. Label them every time.
