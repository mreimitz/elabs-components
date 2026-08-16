# Architecture review (the repo-tier audit rubric)

The shared spec for **`/repo-architect-review`** — the repo/system-tier architecture
audit. Loaded **on demand** by the orchestrator and every `repo-architect-*` auditor
(NOT a CLAUDE.md always-import — it must not tax every session). Concept + rationale:
`research/repo-architect-review/` (01 concept · 02 structure · 03 external learnings) and
ADR `docs/ADR/0009-repo-architecture-review.md`.

This file is the single source for: the **nine dimensions** + their anchored rubrics, the
**evidence labels**, the **named-check catalog**, the **depth tiers**, and the **three
handover contracts**. Auditors and the synthesizer must conform to it verbatim so the
pipeline composes.

## Posture (non-negotiable)

- **Finder, not builder.** The audit and every auditor are **read-only on product code**.
  They diagnose and report; fixes happen separately, from a filed issue. (See
  `.claude/rules/issue-workflow.md`.)
- **Observed, not inferred.** Every claim cites a `file:line`, a command exit code, or a
  counted artifact. Token usage never proves theme-safety; a real render does. (See
  `.claude/rules/quality-gates.md`, `conceptual-framing.md`.)
- **Honest scope.** State what was run vs. read vs. assumed; flag `needs-run`; lead with
  the caveat.
- **Concept before conformance.** Score the repo against its **stated goals**
  (`PROJECT.md`, `docs/DECISIONS.md`), not a generic checklist.

## Depth tiers & confidence label

The orchestrator runs at one depth; the scorecard is stamped with the matching label.

| Depth      | Runs                                                               | Confidence  | Cost           |
| ---------- | ------------------------------------------------------------------ | ----------- | -------------- |
| `quick`    | Evidence pack + deterministic checks only (no auditor subagents)   | _Estimated_ | seconds, free  |
| `standard` | + the four `repo-architect-*` auditors + synthesis (the default)   | _Assessed_  | minutes, 5 LLM |
| `deep`     | + judgment-heavy passes (trigger-accuracy F1, real-screen renders) | _Certified_ | longer         |

`quick` is the cheap pulse; `standard` is the real audit; `deep` adds the costly
judgment. A `quick` scorecard must never be presented as if it were `standard`.

## Evidence labels (tag every signal)

- **Measured** — a command ran; this is its exit/output/count. Highest trust.
- **Observed** — a file was read / a render was _seen_; this `file:line` shows it.
- **Inferred** — reasoned from Measured/Observed evidence; must be labelled; cannot be the
  sole basis of a P0.
- **Assumed / needs-run** — not verified this run; flagged, never silently dropped.

## The nine dimensions & anchored rubrics

One rating per dimension on **●●●● strong · ●●●○ good · ●●○○ partial · ●○○○ weak**, plus a
trend arrow vs. the baseline (▲ improved · ▬ flat · ▼ regressed). A rating is valid only
with a one-line justification citing evidence. Anchors are concrete so two runs agree.

### D1 — Structure & boundaries

One-way deps (`tokens → ui/icons → data/ai/flow/charts/marketing/editor/blueprint`); no sideways/circular imports; packages match their charter.

- ●○○○ circular/sideways deps or a god-module; one-way rule broken in source.
- ●●○○ mostly one-way but ≥1 cross-package relative import, or a package whose content contradicts its `AGENTS.md` charter.
- ●●●○ one-way holds; packages match charters; only minor placement drift.
- ●●●● one-way enforced in source **and** a gate; every package single-responsibility; zero relative cross-imports.

### D2 — Maintainability

Change cost: duplication, dead code, test coverage on load-bearing modules, churn hotspots, no closed abstractions.

- ●○○○ heavy duplication/dead code; load-bearing modules untested.
- ●●○○ known duplication (e.g. StatePanel/AppSidebar/MetricCard forks — WP-13) **or** coverage below the documented bar on core packages.
- ●●●○ low duplication; coverage at the bar on core; hotspots tested.
- ●●●● consolidated; coverage at/above bar across packages; churn×low-coverage hotspots covered; no closed abstractions.

### D3 — Naming conventions

Predictable, guessable, collision-free: packages, files (kebab), components (Pascal), tokens (semantic), variants (`cva`), agents/commands.

- ●○○○ inconsistent casing/synonyms; agent/command name collisions; non-semantic tokens (`blue-500`).
- ●●○○ conventions mostly hold but ≥1 collision, a non-plugin-scoped agent name, or token synonyms.
- ●●●○ casing + token semantics consistent; names guessable; no in-repo collisions.
- ●●●● fully consistent **and** collision-gated; agent/command names plugin-scoped where shipped.

### D4 — Consistency (placement & **why**)

Every artifact's placement has a stated reason (app-UI vs marketing vs domain pkg; package-primitive vs registry-block; gated subpaths).

- ●○○○ placement by convenience; no rationale; registry/package splits ad hoc.
- ●●○○ mostly rule-aligned but ≥1 unexplained placement or a registry/primitive miscategorization.
- ●●●○ placements match `DECISIONS.md` + `registry.md`; subpaths cleared the gate.
- ●●●● every non-obvious placement has an ADR/rule; zero drift.

### D5 — Engineering best practices

TS/React 19 idiom, Radix-first, `cva` variants, testing, motion-tokening, a11y baseline, no paid deps.

- ●○○○ `typecheck`/`lint`/`build` red, or rules widely violated (raw hex, `<div onClick>`).
- ●●○○ gates green but pattern violations present (some raw hex, non-`cva` forks, missing tests).
- ●●●○ gates green; patterns followed; minor idiom gaps.
- ●●●● gates green; idiomatic React 19 / Tailwind v4 / Radix; tests where rules demand; motion-tokened.

### D6 — AI readiness (agent legibility)

Ground truth (manifest/CLI/MCP), portable guidance (AGENTS.md/llms.txt), trigger quality, story coverage (the MCP serves _stories_).

- ●○○○ manifest stale/shallow; unstoried components; no AGENTS.md/llms.txt; descriptions don't trigger.
- ●●○○ manifest fresh but index-only; coverage gaps; AGENTS.md present but not a runnable contract.
- ●●●○ fresh manifest + runnable AGENTS.md; most surfaces storied; trigger phrases present.
- ●●●● enriched manifest (props/variants/anti-patterns); `llms.txt`; trigger-accuracy measured; full story coverage.

### D7 — Enterprise readiness (operational spine)

CI runs the gates; versioning/release; distribution; governance (CODEOWNERS/RFC/deprecation); i18n/RTL; doc-truth.

- ●○○○ no CI; no versioning/release; docs claim machinery that's absent.
- ●●○○ CI exists but partial; release ad hoc; thin governance.
- ●●●○ CI runs the documented gates; release process documented; doc-truth gated.
- ●●●● CI + release pipeline + versioning + governance + an i18n/RTL posture.

### D8 — Compiled-output fidelity (shipped surface vs intent)

The built `dist/`: exports/types resolve in a consumer; tree-shaking; no dev leakage; six themes render right on a **real, unmodified** screen.

- ●○○○ build fails, or `dist` exports/types broken, or a theme renders wrong on a real screen.
- ●●○○ builds but a subpath/types gap, dev leakage, or a theme glitch on a real `scenarios-*` screen.
- ●●●○ build clean; exports/types resolve in a scratch consumer; six themes render correctly on a real screen.
- ●●●● + tree-shaking/bundle-size sane; six-theme render verified on real scenario screens; RSC-safe.

### D9 — Agentic-repo hygiene (`.claude` / `CLAUDE.md` / `PROJECT.md` / `AGENTS.md`)

The governance layer itself: imports/links resolve; agents reachable; hooks valid; CLAUDE.md lean; rules non-contradictory; must-hold rules are hooks.

- ●○○○ broken `@import`s/links; orphan agents; a wired hook file missing; CLAUDE.md bloated or self-contradictory.
- ●●○○ imports resolve but ≥1 oversized context file, orphan agent, or rule contradiction.
- ●●●○ imports/links resolve; every agent reachable; hooks valid; CLAUDE.md reasonably lean.
- ●●●● + progressive disclosure enforced (size caps), one canonical context file, every must-hold rule is a hook not a sentence.

## Named-check catalog (codes)

Every finding cites one **code**. `D` = produced deterministically by the evidence script;
`J` = produced by an auditor's judgment. Severity is the _default_ (an auditor may
raise/lower with justification). **This catalog grows** — add a code rather than filing an
un-coded finding. Each finding instance MUST carry a concrete `remediation` string.

| Dim | Code                                                                                                                                                                                   | Layer                         | Default sev                           |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- | ------------------------------------- |
| D1  | `DEP_DIRECTION_VIOLATION` · `CROSS_PACKAGE_RELATIVE_IMPORT` · `PACKAGE_CHARTER_MISMATCH`                                                                                               | D · D · J                     | P0 · P1 · P1                          |
| D2  | `DUPLICATE_COMPONENT_SET` · `ZERO_TEST_PACKAGE` · `CHURN_HOTSPOT_UNTESTED` · `CLOSED_ABSTRACTION`                                                                                      | J · D · J · J                 | P1                                    |
| D3  | `AGENT_NAME_COLLISION` · `NON_SEMANTIC_TOKEN` · `FILE_CASING_VIOLATION` · `NAME_SYNONYM_DRIFT`                                                                                         | D · D · D · J                 | P1 · P1 · P2 · P2                     |
| D4  | `MISPLACED_EXPORT` · `REGISTRY_PRIMITIVE_MISCATEGORIZED` · `UNDOCUMENTED_STRUCTURAL_CHOICE` · `UNGATED_SUBPATH_EXPORT`                                                                 | J · J · J · D                 | P1                                    |
| D5  | `TOOLCHAIN_RED` · `RAW_HEX_IN_COMPONENT` · `DIV_AS_BUTTON` · `MISSING_SMOKE_TEST` · `RAW_MOTION_UTILITY`                                                                               | D                             | P0 · P1 · P1 · P1 · P2                |
| D6  | `STALE_MANIFEST` · `SHALLOW_MANIFEST` · `UNSTORIED_COMPONENT` · `MISSING_TRIGGER_PHRASE` · `MISSING_LLMS_TXT` · `LOW_TRIGGER_ACCURACY`                                                 | D · J · D · D · D · J         | P1 · P2 · P1 · P1 · P2 · P1           |
| D7  | `NO_CI` · `DOC_CLAIMS_ABSENT_MACHINERY` · `NO_VERSIONING` · `GOVERNANCE_GAP`                                                                                                           | D · D · D · J                 | P0 · P1 · P1 · P2                     |
| D8  | `BUILD_RED` · `BROKEN_EXPORT_OR_TYPES` · `THEME_RENDER_DEFECT` · `DEV_LEAKAGE_IN_DIST` · `BUNDLE_SIZE_REGRESSION`                                                                      | D · D · J · J · D             | P0 · P0 · P0 · P1 · P2                |
| D9  | `DEAD_DOC_LINK` · `UNRESOLVED_RULE_IMPORT` · `ORPHAN_AGENT` · `DANGLING_AGENT_REF` · `HOOK_FILE_MISSING` · `OVERSIZED_CONTEXT_FILE` · `RULE_CONTRADICTION` · `REMINDER_SHOULD_BE_HOOK` | D · D · D · D · D · D · J · J | P1 · P1 · P2 · P1 · P0 · P2 · P1 · P2 |

## Scoring

- **Per-dimension rating** (●-scale) + **trend** vs. baseline + a one-line evidence-cited
  justification. This is the primary output.
- **Severity-weighted finding count** feeds the rating so score and register can't
  disagree (a dimension with an open P0 cannot be ●●●●).
- **Composite grade — OFF by default.** A single rolled-up grade/badge invites optimizing
  the number over the goal (`conceptual-framing.md`: don't manufacture false rigor). If the
  manager opts in, print it only as a _headline_ next to the caveat "a headline, not a
  target — the dimension reasoning governs," using the enterprise-gap letter vocabulary
  ("A on architecture, C on operations").

## The three handover contracts

### ① Evidence pack → auditors

`arch-evidence-pack.mjs` writes `runs/<date>/evidence/` + an `index.json` (and `index.md`).
Each entry: `{ check, layer:"D", code?, command?, exitCode?, summary, artifact, severity? }`.
Auditors **cite pack entries by path** for Measured signals; they do **not** re-run builds.

### ② Auditor → synthesizer (each auditor returns exactly this)

```
## <cluster> audit — <auditor name>
**Scope:** <dimensions · evidence-pack entries used · what I could NOT verify>

### Per-dimension reading
#### D<n> — <name>
- Proposed rating: ●●●○  (trend: ▲|▬|▼)
- Justification: <one line, cites evidence>
- Signals: <Measured|Observed|Inferred|Assumed> — <file:line | pack-path | count>

### Findings
#### <CODE> · <short title>
- Dimension: D<n>   Severity: P0|P1|P2
- Evidence: <label> — file:line | command | count        (no citation → not a finding)
- Symptom: <one factual line>
- Remediation: <concrete, rule-aligned fix string>       (REQUIRED — a finding without this is malformed)
- Routes to: /file-issue | component-tier | a11y-tier | governance(session-retro)
- needs-run: <what to confirm before building, or "none">

### What I could not verify
<explicit list — feeds the run's honest-scope section>
```

### ③ Synthesizer → orchestrator (merged result)

```
## Architecture Health Scorecard — <date>  (baseline: <date>, depth: <tier>, confidence: <label>)
**Verdict:** <2–3 honest sentences, calibrated, no flattery>

| Dim | Rating | Δ | One-line justification |
| --- | ------ | - | ---------------------- |
| D1 … D9 | ●●●○ | ▬ | … |

**Top risks:** <3–5, plain language + impact>
**Movement since baseline:** <improved / regressed>
**If only one thing next:** <single highest-leverage rec>
**Honest scope:** <run vs read vs assumed · needs-run items>
[**Overall grade:** <only if opted in> — "a headline, not a target"]

### Findings register
<deduped, severity-ordered; each = the ② finding record + a stable RAR-<run>-<NN> id>
```

The orchestrator renders ③ verbatim into `scorecard.md` (manager) and `findings.md` +
`findings.json` (agents) — one evidence base, two surfaces, no re-interpretation.
