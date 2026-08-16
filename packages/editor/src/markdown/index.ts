/**
 * @elabs-ai/components-editor/markdown — the opt-in markdown suite.
 *
 * Kept on its own subpath so Monaco-only consumers of `@elabs-ai/components-editor` never pull
 * the markdown/WYSIWYG dependency tree (Milkdown, Streamdown, remark). Everything
 * markdown-shaped — the WYSIWYG editor, the branded preview renderer, the prose /
 * timeline / metric primitives the preview composes, and the shared remark
 * pipeline — lives here.
 */
export {
  MarkdownEditor,
  type MarkdownEditorProps,
  type MarkdownEditorHandle,
  type EmbedAssetFn,
} from "../markdown-editor";

// Engine-agnostic content-access API — re-exported here for convenience so
// markdown-subpath consumers get the full picture from one import.
// `monacoContentAccess` is also on the `.` barrel; types are re-exported here
// for symmetry. The prose adapter is ONLY here (never on the `.` barrel — keeps
// @milkdown off the Monaco-only graph, #271-inverse).
export {
  monacoContentAccess,
  type EditorContentAccess,
  type EditorSelection,
} from "../lib/editor-content-access";
export {
  proseMirrorContentAccess,
  selectionWatchPlugin,
  type ProseMirrorContentAccessDeps,
  type ProseMirrorContentAccessOptions,
} from "../lib/editor-content-access-prose";

// Declarative completion-provider API (#283) — e.g. `[[wikilink]]` autocomplete
// wired via the `completions` prop on `MarkdownWorkspace` / `MarkdownEditor`,
// with ZERO `monaco-editor` imports needed in consumer code. The library owns
// the Monaco registration lifecycle (registered once, refcounted across
// mounted workspaces, disposed with the last one) and mirrors providers into a
// deliberately minimal WYSIWYG popup — see `lib/editor-completions-monaco.ts`
// and `markdown-editor/completions/completions-prose.ts` for the exact
// Monaco-vs-WYSIWYG parity boundary. `attachCompletionsMonaco` is exported for
// advanced consumers composing their own Monaco surfaces (the `attachCalcMonaco`
// precedent).
export {
  triggerQueryStart,
  resolveReplaceRange,
  collectCompletions,
  type EditorCompletionItem,
  type EditorCompletionProvider,
  type EditorCompletionContext,
  type CompletionReplaceRange,
  type CompletionMatch,
} from "../lib/editor-completions";
export { attachCompletionsMonaco } from "../lib/editor-completions-monaco";

// Slash (`/`) command menu for the WYSIWYG editor — the branded at-caret block
// inserter (card/callout/metric/timeline + basic blocks). Opt in via the
// `slashMenu` prop on MarkdownEditor / MarkdownWorkspace; these exports let
// consumers extend the command list or build their own surface.
export {
  BRAND_SLASH_COMMANDS,
  brandSlashViewPlugins,
  filterSlashCommands,
  groupSlashCommands,
  insertBrandDirective,
  insertBasicBlock,
  insertCalcFence,
  resolveCalcInsert,
  CALC_FENCE_SEED,
  SlashMenu,
  type SlashCommand,
  type SlashInsertContext,
  type SourceSlashContext,
  type SlashMenuProps,
  type BasicBlockId,
  type InsertableDirective,
  type SlashRange,
  type BrandSlashViewOptions,
} from "../markdown-editor/slash";
// The Monaco source-pane slash popup (#271) — imported from the file directly
// (NOT the slash barrel) because it pulls the Monaco runtime; the slash barrel
// must stay Monaco-free for the Milkdown editor. This subpath already pulls
// Monaco via MarkdownWorkspace, so it is the right home for the parity export.
export {
  MonacoSlashMenu,
  type MonacoSlashMenuProps,
} from "../markdown-editor/slash/monaco-slash-menu";

// The hybrid authoring surface (source | wysiwyg | split) + its formatting toolbar.
export {
  MarkdownWorkspace,
  type MarkdownWorkspaceHandle,
  type MarkdownWorkspaceProps,
  type MarkdownWorkspaceMode,
} from "../markdown-workspace";
export {
  MarkdownToolbar,
  type MarkdownToolbarProps,
  wrapSelection,
  toggleLinePrefix,
  insertLink,
  insertHorizontalRule,
  insertDirective,
} from "../markdown-toolbar";

// Shared visual scale — the single source of truth for heading sizes / weight /
// tracking / measure consumed by BOTH the preview (prose) and the WYSIWYG editor CSS.
export {
  MARKDOWN_HEADING_REM,
  MARKDOWN_HEADING_WEIGHT,
  MARKDOWN_HEADING_TRACKING,
  MARKDOWN_MEASURE,
  markdownScaleVars,
  type MarkdownHeadingLevel,
} from "../lib/markdown/markdown-scale";

// Rendering primitives (token-driven; composed by the preview + directive views).
export * from "../prose";
export { Timeline, type TimelineProps, type TimelineItem } from "../timeline";
export { MetricBlock, type MetricBlockProps } from "../metric-block";

// Branded preview + shared remark pipeline.
export {
  MarkdownPreview,
  type MarkdownPreviewProps,
  type MarkdownHeadingInfo,
} from "../markdown-preview";
export {
  buildMarkdownPlugins,
  remarkBrandDirectives,
  BRAND_DIRECTIVES,
  type BrandDirectiveName,
  type BuildMarkdownPluginsOptions,
  type MarkdownDirectiveKind,
  type MarkdownDirectiveContext,
  type MarkdownDirectiveRenderer,
  type MarkdownFenceContext,
  type MarkdownFenceRenderer,
  type MarkdownExtensions,
} from "../lib/markdown/directives";
// Monaco-free markdown parser (gfm + directives + frontmatter). The canonical
// dependency-light import is `@elabs-ai/components-editor/markdown/parse`; re-exported here for
// convenience when you're already pulling the full markdown suite.
export { parseMarkdown } from "./parse";
// Re-export the frontmatter utils from the `./frontmatter` subpath barrel (NOT
// directly from `../lib/markdown/frontmatter`) so there is a single canonical
// module — `lib/markdown/frontmatter` (impl) → `./frontmatter` (public barrel) →
// here. Importing `ParsedDocument` from either subpath resolves to one emitted
// module, so its type identity is assignable across import sites (see #39).
export { parseFrontmatter, serializeFrontmatter, type ParsedDocument } from "./frontmatter";

// Mermaid (#L1): branded diagram renderer + the source⇄diagram workspace (#L2).
export { MermaidDiagram, type MermaidDiagramProps } from "../mermaid-diagram";
export { MermaidWorkspace, type MermaidWorkspaceProps } from "../mermaid-workspace";

// Calc: a ```calc fence → a branded answer-column sheet, and `:calc[expr]` inline
// → a result chip — both evaluated by a consumer `evaluate` hook (the math engine
// stays in the app, like `resolveUrl`).
export { CalcBlock, type CalcBlockProps } from "../calc-block";
export { CalcInline, type CalcInlineProps } from "../calc-block";
export type {
  CalcContext,
  CalcLineResult,
  CalcRule,
  CalcSheet,
  CalcTint,
  CalcToken,
  CalcTokenKind,
  CalcValue,
  CalcValueKind,
  EvaluateCalc,
} from "../calc-block";

// Calc AUTHORING (#220): opt-in live highlighting + autocomplete + result inlays
// inside ```calc fences, wired via the `calc` prop on MarkdownEditor /
// MarkdownWorkspace. The hook TYPES let consumers type their engine; the wiring
// functions (`attachCalcMonaco`, `calcProsePlugins`) + `findCalcFences` are for
// advanced consumers composing their own Monaco / Milkdown surfaces. The library
// DECORATES, the consumer COMPUTES — no calc engine is bundled.
export type {
  CalcComplete,
  CalcCompletion,
  CalcCompletionContext,
  CalcCompletionKind,
  CalcEditorHooks,
  CalcTokenize,
} from "../calc-block";
export { findCalcFences, calcTokenClassName, type CalcFence } from "../calc-block/calc-editor";
export { attachCalcMonaco } from "../calc-block/calc-editor-monaco";
export { calcProsePlugins } from "../calc-block/calc-editor-prose";

// Ghost-diff annotations (#L18): line-level markdown diff → preview washes.
export {
  computeMarkdownAnnotations,
  summarizeAnnotations,
  shiftAnnotations,
  annotationForRange,
  removedMarkerAt,
  type MarkdownAnnotation,
  type MarkdownAnnotationKind,
} from "../lib/markdown/diff";
// Normalization-aware WYSIWYG merge (WI-1) — for consumers composing their
// own editing surfaces on MarkdownEditor.
export { mergeNormalizedEdit } from "../lib/markdown/merge";
export type { MarkdownUrlKind } from "../markdown-preview";

// Document outline (#L6): heading extraction + the quiet TOC rail.
export {
  DocumentOutline,
  useMarkdownOutline,
  parseMarkdownOutline,
  type DocumentOutlineProps,
  type MarkdownOutlineItem,
} from "../markdown-outline";

// AI-object directive trio: DecisionCard, EntityCard/Chip, KnowledgeCard +
// the renderer factories (decisionDirective, entityDirective, knowledgeDirective,
// aiObjectDirectives) for wiring into MarkdownPreview `extensions.directives`.
export {
  DecisionCard,
  decisionCardVariants,
  DECISION_STATUSES,
  type DecisionCardProps,
  type DecisionStatus,
  EntityCard,
  EntityChip,
  entityChipVariants,
  ENTITY_KINDS,
  type EntityCardProps,
  type EntityChipProps,
  type EntityKind,
  KnowledgeCard,
  type KnowledgeCardProps,
  type KnowledgeSourceResolved,
  type KnowledgeSourceResolver,
  decisionDirective,
  entityDirective,
  knowledgeDirective,
  aiObjectDirectives,
  type AiObjectDirectivesOptions,
} from "../ai-objects";

// Academic layer — opt-in via MarkdownPreview props (`footnotes` / `resolveCitation`
// / `math` / `toc`): branded footnotes, Pandoc/Better-BibTeX citations + a generated
// bibliography, `$…$`/`$$…$$` math (KaTeX), and a generated `::toc`. The standalone
// components + the public contract types are exported here.
export {
  Bibliography,
  collectCitations,
  FootnoteList,
  MathBlock,
  MathInline,
  TableOfContents,
  type BibliographyProps,
  type CitationData,
  type CitationStyle,
  type CiteItem,
  type CollectedCitations,
  type FootnoteListProps,
  type MathProps,
  type ResolveCitation,
  type ResolvedCitation,
  type TableOfContentsProps,
} from "../markdown-academic";

// Iteration — opt-in via MarkdownPreview's `evaluateIteration` (+ `interpolate`)
// props: a `:::iterate` / `:::pivot` repeater that renders a per-cell markdown
// template over consumer-resolved data (stacked / grid / matrix layouts). The
// standalone `IterationBlock` + the public contract types are exported here.
export {
  IterationBlock,
  defaultInterpolate,
  specFromDirective,
  type EvaluateIteration,
  type InterpolateTemplate,
  type IterationBlockProps,
  type IterationCell,
  type IterationData,
  type IterationLayout,
  type IterationSpec,
} from "../markdown-iteration";
// The #223 template modal (Dialog + MarkdownWorkspace) + its one-liner wiring —
// exported from the heavy (Monaco/Milkdown) side, not the render-light
// `markdown-iteration` barrel. The node-view `⋯` re-edit seam is `IterationEditContext`.
export {
  IterationTemplateDialog,
  IterationTemplateProvider,
  type IterationTemplateDialogProps,
} from "../markdown-iteration/template-dialog";
export {
  IterationEditContext,
  type IterationEditHandler,
  type IterationEditRequest,
} from "../markdown-iteration/edit-context";
// The #223 GUIDED builder (A5): collects the DATA (value lists + bind name +
// layout) as well as the template, writes a fully-bound directive, and renders a
// populated result with the built-in `evaluateEmbedded`. The `⋯` re-edit reopens
// it losslessly via `IterationBuilderProvider`.
export {
  IterationBuilderDialog,
  IterationBuilderProvider,
  type IterationBuilderDialogProps,
} from "../markdown-iteration/iteration-builder-dialog";
export {
  serializeIterationDirective,
  parseIterationDirective,
  builderValueFromParts,
  directivePartsFromValue,
  emptyBuilderValue,
  evaluateEmbedded,
  splitList,
  parseAttributes,
  DEFAULT_TEMPLATE,
  type IterationBuilderValue,
} from "../markdown-iteration/iteration-builder";
// The #223 node-menu model helpers: "Transpose" (swap a pivot's rows/cols) and
// "Convert to static" (render the resolved cells as plain markdown, no
// ProseMirror dependency) — the pure functions behind the iteration node-view's
// right-click / `⋯` menu actions (see `markdown-editor/directive-views.tsx`).
export {
  transposeIterationValue,
  staticMarkdownFromValue,
} from "../markdown-iteration/iteration-builder";
