# Roadmap

One file per change, `RM-NNN-<slug>.md`, each with frontmatter (`id`, `status`, `priority`, `effort`, `depends_on`, `blocks`, `source`) and the sections Finding / Change / Acceptance / Test-gate. Every item below comes from `docs/review/2026-09-03-storybook-ia-and-ambiguity-review.md`; the Finding section restates the evidence with file paths so an item can be picked up without reading the review.

Status values: `planned`, `in-progress`, `done`, `dropped`. Update the frontmatter and this table together.

## Items

| ID | Title | Priority | Effort | Depends on | Status |
|---|---|---|---|---|---|
| [RM-002](RM-002-storybook-group-gate.md) | CI gate: every top-level group must be in `storySort.order` | P1 | S | – | planned |
| [RM-003](RM-003-storysort-order.md) | Deterministic sidebar order (alphabetical + explicit reading order) | P1 | S | – | planned |
| [RM-004](RM-004-fold-providers-into-foundations.md) | Fold Providers into Foundations; ThemeProvider + LocaleProvider get one home | P2 | S | RM-003 | planned |
| [RM-005](RM-005-story-title-hygiene.md) | Story title hygiene: demos out of component groups, naming rule, duplicate entry | P2 | S | RM-003 | planned |
| [RM-006](RM-006-composer-gains-mode-effort-slash-modelpicker.md) | Composer gains mode / effort / slash / modelPicker slots | P1 | M | – | planned |
| [RM-007](RM-007-registry-and-stories-use-composer.md) | Registry block and stories use Composer; audit warns on direct PromptInput | P1 | S | RM-006 | planned |
| [RM-008](RM-008-nest-promptinput-under-composer.md) | Nest the PromptInput family under `AI/Composer` | P2 | S | RM-003, RM-006 | planned |
| [RM-009](RM-009-choosing-between-similar-components-doc.md) | Docs page "Choosing between similar components" + cross-links | P1 | S | – | planned |
| [RM-010](RM-010-model-picker-consolidation.md) | ModelPicker / ModelSelector share internals and a sidebar home | P2 | M | RM-006 | planned |
| [RM-011](RM-011-changereview-renders-through-diffview.md) | ChangeReview renders its hunks through DiffView | P2 | M | – | planned |
| [RM-012](RM-012-one-markdown-renderer.md) | One markdown renderer: MarkdownPreview = MarkdownView + directives | P2 | M | – | planned |
| [RM-013](RM-013-splitpanel-vs-resizable.md) | SplitPanel and Resizable: unify or document | P3 | S | – | planned |
| [RM-014](RM-014-revisiontimeline-on-timeline.md) | RevisionTimeline rides the Timeline rail | P3 | S | – | planned |
| [RM-015](RM-015-rename-ai-context.md) | Rename `AI/Context` to `TokenUsage` | P3 | S | – | planned |
| [RM-016](RM-016-missing-story-descriptions.md) | Every ambiguous-pair story names its sibling in its description | P2 | S | RM-009 | planned |

## Suggested sequence

Three independent tracks; items inside a track are ordered by `depends_on`.

1. **Sidebar** (all S, about two days total): RM-002 → RM-003 → RM-004, RM-005, then RM-008 once RM-006 lands.
2. **Composer** (the only track with real component work): RM-006 → RM-007, RM-010.
3. **Disambiguation** (docs first, code second): RM-009 → RM-016; then RM-011, RM-012, RM-013, RM-014, RM-015 in any order.

Finish RM-002, RM-003, RM-006, RM-009 first: they are the remaining P1s, they are independent of each other, and together they remove everything a reader hits on first open of the sidebar.

## Review coverage

Every finding in the source review maps to an item:

| Review section | Item |
|---|---|
| 1.1 orphan groups | RM-002 (RM-001 done 2026-09-03) |
| 1.2 Providers / ThemeProvider | RM-004 |
| 1.3 import-order sorting | RM-003 |
| 1.4 ordering fixes (Viewer/Terminal in list, AI/Chat, naming, test sub-groups, Charts/MetricCard) | RM-002, RM-003, RM-005 |
| 2.1 Composer lacks mode/effort/slash | RM-006 |
| 2.2 registry hand-rolls PromptInput | RM-007 |
| 2.3 dead model pill / three model pickers | RM-006, RM-010 |
| 2.4 nine composer entries in the sidebar | RM-008 |
| 3.1 Terminal duplicates AI | RM-009, RM-016 |
| 3.2 three model pickers | RM-010 |
| 3.3 four toolbars | RM-009, RM-016 |
| 3.4 five diff surfaces | RM-009, RM-011 |
| 3.5 markdown renderers | RM-009, RM-012 |
| 3.6 three slash menus | RM-005, RM-008, RM-009 |
| 3.7 naming collisions, unshared implementations | RM-013, RM-014, RM-015, RM-016 |
| 3.8 look-alike pairs | RM-016 |
