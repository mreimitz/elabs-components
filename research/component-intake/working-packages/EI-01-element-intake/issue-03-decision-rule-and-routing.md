---
TYPE: issue
TITLE: "[dx] element-intake decision rule (one source) + wire /new-component Step 0 + skills routing"
LABELS: type:tech-debt, severity:P1, area:governance, area:docs, needs-triage
WP: EI-01
---

## Summary

Author the **canonical decision tree** once — `.claude/rules/element-intake.md` — so the `/new-element`
command, the `element-classifier` agent, and the maintainer skills all read **one** source (not divergent
copies). Then wire it in: a `/new-component` "Step 0" pointer to the front door, and routing notes in
`brand-ui-component` / `brand-ui-registry`. This is the connective tissue that makes the front door real
and keeps it consistent (WP-12).

## Source

[`../../README.md`](../../README.md) (the two-axis model + routing table). Builds on the `/new-component`
analysis gap (no kind-classifier, no routing) and `.claude/rules/registry.md` (the taxonomy).

## Severity & impact

**P1.** Without one shared rule, the command and agent drift; with it, "what should this be?" has a
single authoritative answer the whole system points at.

## Proposed solution

1. **`.claude/rules/element-intake.md` (new) — the decision tree**, imported from `CLAUDE.md`:
   - Axis 1 (overlap): reuse / extend / merge / replace / new — the `/new-component` Step 1 logic, lifted
     to apply to _any_ element.
   - Axis 2 (kind): component-at-all? (token / icon / hook / playbook escape hatches) → primitive vs
     composition → **ownership: stable-shared → package; prototype-tweak → registry** → component vs
     block vs template → placement.
   - The **routing table** (idea → becomes → builder) as the normative reference.
   - The key clarifier: **"composition does NOT imply block"** — package compositions are normal
     (`AppShell`, `DataTable`, `ThemeSwitcher`); ownership decides package-vs-registry.
2. **Wire `/new-component`** — add a short **"Step 0 — Is this a component? (run `/new-element` first)"**
   pointer at the top of `.claude/commands/new-component.md`: if you haven't classified the idea, run
   `/new-element`; if you already know it's a package component, continue. (Keeps `/new-component` a valid
   direct builder while making the door the recommended entry.)
3. **Wire the skills** — add a one-line routing note to `skills/brand-ui-component/SKILL.md` and
   `skills/brand-ui-registry/SKILL.md`: "Unsure what it should be? Start at `/new-element`
   (element-intake rule)."
4. **Consistency** — `element-intake.md` is the single source; command + agent reference it rather than
   restating the tree (WP-12). If the generated-guidance machinery (WP-12/doc 11) lands, the routing
   table can be emitted into the agent-read surfaces too.

## Affected files

- [ ] `.claude/rules/element-intake.md` (new) + `CLAUDE.md` (import the rule)
- [ ] `.claude/commands/new-component.md` (Step 0 pointer to `/new-element`)
- [ ] `skills/brand-ui-component/SKILL.md`, `skills/brand-ui-registry/SKILL.md` (routing note)

## Acceptance criteria

- [ ] `.claude/rules/element-intake.md` states the two-axis model + the routing table + the
      "composition ≠ block" clarifier, and is imported by `CLAUDE.md`.
- [ ] `/new-component` opens with a Step 0 pointer to `/new-element` but still works standalone.
- [ ] Both maintainer skills point to the front door; none of them restates a _divergent_ decision tree
      (single source).

## Test to add

A consistency check: the routing-table outcomes named in `element-intake.md`, the `/new-element` command,
and the `element-classifier` agent match (no drift). (Docs/process — verify by review; fold into the
WP-12 guidance stale-check if/when it exists.)

## Risks / ripple effects

- Keep the rule **short and skimmable** (it's read often) — the table + the two axes, not an essay.
- Don't fork the taxonomy from `registry.md` — `element-intake.md` should _reference_ it for
  component/block/template definitions, not redefine them.

## References

- [`../../README.md`](../../README.md); `issue-01`/`issue-02`; `.claude/rules/registry.md`,
  `conceptual-framing.md`, `quality-gates.md`; `.claude/commands/new-component.md`,
  `new-registry-item.md`; enterprise-gap **WP-12** (one decisions source), **doc 11** (agent-docs).
