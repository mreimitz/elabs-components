# design-system — history

Moved out of .claude/rules/design-system.md on 2026-09-06 so it stops loading into every session. This is the record of incidents, measurements and rejected alternatives behind the rule; the binding rule itself lives in the rule file.

## Intro paragraph (original wording)

The rule's opening description was condensed; the original read:

> brand-ui is a **source-owned, token-driven** component system. The default look
> is modern enterprise SaaS: restrained, app-first, polished, and equally at home
> in dashboards, AI/chat clients, React Flow canvases, and the occasional
> marketing page.
>
> Core principles:

The list of surfaces (dashboards, AI/chat clients, React Flow canvases, the occasional
marketing page) restates the Purpose section of `CLAUDE.md`, which remains the canonical
home for it. The six principles themselves were kept in the rule unchanged; the
dependency line and the layer-3 sentence are byte-identical (ADR
`docs/ADR/0034-process-package-third-layer.md`).
