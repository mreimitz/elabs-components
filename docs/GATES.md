# Gates

The repo is self-maintaining: automated checks keep its conventions true rather than
relying on contributors to remember them. This page is the short index — what to run and
the rough shape of what exists. A future stage replaces the individual gate scripts with
one `pnpm check` runner driven by a check-rule registry; this page will then be generated
from that registry instead of hand-kept.

## How to run

```bash
pnpm check:changed    # typecheck + lint + test for the packages changed vs origin/main
pnpm gates            # the full per-change gate battery, parallel, every failure reported
pnpm gates:selftests  # every gate's own self-test (a planted bad fixture must fail)
pnpm gates:all        # pnpm gates plus the slow pair (format:check, consumer:check)
```

`pnpm gates --list` prints every gate name; `--only <substr>` / `--skip <name>` scope a
run. CI runs the identical runner (`gates.yml`), so a green `pnpm gates` locally is the
real signal.

## What the gates cover, by concern

- **Tokens & theming** — `themes.css` matches the DTCG source; every theme defines every
  semantic token; no raw hex/palette utility outside tokens; the focus-ring contract holds;
  the decoration dial stays background-only and shadowless-consistent.
- **Component contracts** — barrel-registered + story-covered components; every `cva`
  variant rendered by a story; `data-slot` present on new components; loading/streaming
  states shown in a story; motion uses gated `duration-*`/`ease-*` tokens.
- **Package boundaries** — the one-way dependency DAG (`tokens → ui/icons → domain →
process`); no eager heavy-engine imports in `ai`/`terminal`/`viewer`; chart/process
  reuse rules (no redefining a sibling package's component names).
- **Accessibility** — axe is blocking on every story, on a ratchet that only tightens.
- **Docs & manifest freshness** — the component manifest, generated doc regions, README
  getting-started sections and the registry artifacts are all freshness-gated (never
  hand-edit a generated file; run its generator).
- **Attribution** — `ATTRIBUTION.md` and the in-product panel are derived from
  `scripts/attributions.sources.json`, not hand-kept.
- **Release safety** — lockstep versioning, a `CHANGELOG.md` entry per package-affecting
  change, and a publish that requires (never re-runs) the CI verdict for the tagged commit.

## Escape hatches

Most ratchet gates support an inline exemption comment (documented at the call site) or a
`--update`/`--force` flag on the gate's own script — never a blanket disable. A gate that
seems wrong is a reason to look at the rule it enforces (`.claude/rules/conventions.md` or
the relevant path-scoped rule), not to route around it.

## Definition of done

See `CONTRIBUTING.md` → "Pull request checklist" and `.claude/rules/conventions.md`.
