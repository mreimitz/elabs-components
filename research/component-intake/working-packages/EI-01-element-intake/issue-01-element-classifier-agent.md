---
TYPE: issue
TITLE: "[dx] element-classifier agent — read-only library scan that decides what a new idea should become"
LABELS: type:feature, severity:P1, area:ai, area:governance, needs-triage
WP: EI-01
---

## Summary

Add a new read-only agent, **`element-classifier`** (the "library cartographer"), whose one job is to
take a rough idea for a new element, **scan the entire library**, and return a **structured
classification + a single recommended route** — without building anything. It is the brain behind
`/new-element` (issue-02) and is reusable by the vibe-coder plugin.

## Source

[`../../README.md`](../../README.md) (the two-axis decision model + routing table). User ask
(2026-06-06): "one function … help me decide what it will become … probably worth a new agent
specialized in that as he has to scan what we already have entirely."

## Severity & impact

**P1.** The classification quality is the whole value of the front door; isolating the exhaustive scan in
a dedicated agent keeps it reusable (plugin + command) and keeps the scan's tokens out of the caller's
context.

## Proposed solution

Create `.claude/agents/element-classifier.md`:

- **Frontmatter:** `name: element-classifier`; a `description` that triggers on "what should this be",
  "new element idea", "is this a component or a block", "where should X live"; `model: opus` (a
  structural taxonomy/placement decision — same tier as `design-system-architect`); read-only
  `tools: Read, Grep, Glob, Bash, mcp__storybook__*` (no Edit/Write — finders report, builders fix).
- **Inputs:** the idea (1-line + any clarifiers from `/new-element`), notably the **ownership signal**
  (shared-across-apps vs app-specific) when known.
- **The scan (ground-truth first, exhaustive):**
  1. **Manifest + llms.txt** — read `brand-ui.manifest.json` (and the generated `llms.txt` once doc 11
     lands) as the primary index of every package, component, hook, prop, token. Cheapest complete view.
  2. **Barrels + registry** — `packages/*/src/index.ts`, `registry/registry.json`, `registry/**`.
  3. **Live stories** — when the Storybook dev server is up, `mcp__storybook__list-all-documentation`
     (+ `get-documentation`) for real props/variants. Fallback to source when down.
  4. Match by **name, synonyms, and UI role/primitive** (the `/new-component` Step 1 synonym list:
     Modal→dialog/sheet/drawer/popover; Toast→sonner/alert; Table→data-table; …).
- **The decision (apply `.claude/rules/element-intake.md`, issue-03):**
  - Axis 1 overlap → reuse / extend / merge / replace / new.
  - Axis 2 kind (only if new) → component-at-all? (else token / icon / hook / playbook); primitive vs
    composition; **ownership** (stable-shared → package; prototype-tweak → registry); component vs block
    vs template; target package or registry folder.
- **Output (structured, no build):**
  - a **findings table** (existing item · location · overlap · key differences),
  - the **single recommended route** + one-line rationale (one of the routing-table rows),
  - **handoff notes** for the builder: target package/folder, reuse targets (`cn`, icons, existing
    components to compose), and the exact next command (`/new-component`, `/new-registry-item`,
    `/new-theme`, icon/hook/playbook).
- **Escalation:** for genuinely structural calls (warrants a **new package** or a **subpath export**),
  defer to **`design-system-architect`** per `component-api.md` / `quality-gates.md` rather than deciding
  alone.

## Affected files

- [ ] `.claude/agents/element-classifier.md` (new, read-only, `model: opus`)
- [ ] (referenced, not edited here) `.claude/rules/element-intake.md` (issue-03), `brand-ui.manifest.json`

## Acceptance criteria

- [ ] Given an idea, the agent returns a findings table + exactly **one** recommended route from the
      routing table, citing where each match lives and **why** the idea is/isn't a component / block /
      token / etc.
- [ ] It performs a **real whole-library scan** (manifest + barrels + registry + stories when up) — not a
      guess; it names the sources it used.
- [ ] It **never edits** product code; it ends by naming the exact builder command to run next.
- [ ] It escalates new-package / subpath decisions to `design-system-architect`.

## Test to add

A dry-run check: feed three known ideas and assert the route — (a) "a button that's just our Button with
a spinner" → **extend**; (b) "a pricing page section" → **registry template**; (c) "a `--card-detail-size`
spacing value" → **token / `/new-theme`**. (Process/agent issue — validate by invocation, not a unit test.)

## Risks / ripple effects

- **Stale ground truth** weakens the scan — depends on the manifest/`llms.txt` being fresh (doc 11 /
  WP-10 stale-gate). Note the dependency.
- Don't let it become a second builder — keep it strictly read-only; the value is the decision, not the
  code.

## References

- [`../../README.md`](../../README.md); `issue-02-new-element-command.md`, `issue-03-decision-rule-and-routing.md`;
  `.claude/commands/new-component.md` (Step 1 synonym list), `.claude/rules/registry.md`,
  `conceptual-framing.md`; agent-docs **doc 11**; `design-system-architect` agent.
