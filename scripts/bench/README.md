# brand-ui agent benchmark

The claim "agent-native" is what every library says. This harness turns it into
numbers a reader can re-derive: the same five screens (`tasks.json` — dashboard,
data app, AI assistant, settings, marketing), built by the same model with
brand-ui and with a comparison library, scored on what an agent gets wrong.

## Run

```bash
# 1. Inspect the prompts first — no API call, no cost.
node scripts/bench/run.mjs --dry-run --run fairness-check

# 2. Generate. Needs ANTHROPIC_API_KEY; ~10 calls per library × task set.
ANTHROPIC_API_KEY=… node scripts/bench/run.mjs --model claude-sonnet-4-5 --libs brand-ui,shadcn --run 2026-09-17

# 3. Score (static + a real-browser render with axe).
node scripts/bench/score.mjs --run 2026-09-17
#    --no-render  static axes only (seconds instead of minutes)
#    --keep       keep the throw-away apps for inspection
```

Output: `scripts/bench/out/<run>/scores.md` (the comparison table) and
`scores.json` (every finding). `out/` is git-ignored — commit a run only by
copying its `scores.md` into `docs/review/`.

## What the model sees

| library  | context pack                                                                                                                                                                                                                                          |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| brand-ui | `apps/docs/public/llms.txt`, every playbook `brand-ui search` names for the task's nouns, and `brand-ui docs <Component>` for the components it finds (≤ 5 per noun, ≤ 40 total) — the route the hosted MCP gives an agent, with no hand-picked hints |
| shadcn   | `scripts/bench/context/shadcn.md` if you write one (paste the shadcn/ui docs excerpts you consider fair); otherwise one sentence: use shadcn/ui as installed by `npx shadcn@latest add`, Tailwind, lucide-react, Recharts                             |
| `<name>` | `scripts/bench/context/<name>.md`, same rule                                                                                                                                                                                                          |

The system prompt is identical for every library (`run.mjs`, `SYSTEM`).

## What is scored

| axis          | brand-ui                                                                                                                                                                                                                                                         | other libraries                                                                                                                        |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| hallucination | imports of a package or export that does not exist in `brand-ui.manifest.json`; a JSX prop on a component with a prop table that is not declared, inherited, a cva axis or a native React DOM attribute; a cva axis with a value outside its real set            | imports not in `scripts/bench/context/<lib>.components.json` when you provide that list; props are unverifiable and the report says so |
| tokens        | `brand-ui audit` static findings: raw hex, raw palette utilities, arbitrary colours, content slop (blocking findings counted, advisory listed)                                                                                                                   | the same scan — it is library-agnostic                                                                                                 |
| a11y          | the file is dropped into an app made by `brand-ui create`, installed from npm, built with Vite, served, and run through axe-core (WCAG 2.0/2.1 A+AA); violations are node counts; a build failure is reported as such — it is the strongest hallucination signal | rendered only if `scripts/bench/baseline/<lib>/` holds a Vite app whose `src/App.tsx` the scorer may replace; otherwise `n/a`          |
| cost          | input/output tokens and wall time from the API                                                                                                                                                                                                                   | same                                                                                                                                   |

There is deliberately no weighted total. The table is the result.

## Fairness notes

- The brand-ui context is generated, not curated: change `nouns()` or the caps
  in `run.mjs` and re-run `--dry-run` to see the effect before spending money.
- A comparison library without a manifest cannot have its props checked. Give
  it the best context you can (`context/<lib>.md`) and a render baseline
  (`baseline/<lib>/`) so the a11y and build-failure axes apply to it too.
- `BENCH_CHROMIUM=/path/to/chromium` overrides the browser binary (CI images
  that ship their own Chromium).
