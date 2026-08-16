/**
 * The brand slash-command registry — pure, typed, tree-shakeable data.
 *
 * Each command is a label + group + match keywords + an icon + a `run` that
 * inserts the corresponding block at the caret. `run` is given a
 * {@link SlashInsertContext} (the Milkdown `Ctx` + the active `/query` range);
 * brand directives delegate to `resolveBrandInsert`, basic blocks to
 * `resolveBasicInsert` — so the SAME registry drives the menu and any
 * programmatic insert, and the load-bearing insertion logic stays in
 * `insert-directive.ts` (unit-tested there).
 *
 * Defaults: card · callout · metric · timeline ("Brand blocks") +
 * heading · bullet-list · ordered-list · quote · code · divider ("Basic").
 * Consumers can extend or replace the list via the `slashMenu` prop.
 *
 * `runInSource` (#299) is an OPTIONAL, ADDITIVE second handler for the Monaco
 * source pane — `run` (Milkdown) stays untouched, so the 12 default commands
 * need zero migration. `MonacoCodeEditor` / `IRange` / `EditorContentAccess`
 * below are TYPE-ONLY imports (erased at build) — this file stays free of any
 * `monaco-editor` RUNTIME import, so the Milkdown-facing `slash/index.ts`
 * barrel this file feeds still pulls zero Monaco code.
 */
import type { Ctx } from "@milkdown/kit/ctx";
import {
  Calculator,
  Grid3x3,
  Heading2,
  List,
  ListOrdered,
  Minus,
  Quote,
  Repeat2,
  SquareCode,
  type LucideIcon,
} from "lucide-react";
import type { IRange } from "monaco-editor";
import { createElement, type ReactNode } from "react";

import type { MonacoCodeEditor } from "../../code-editor";
import type { EditorContentAccess } from "../../lib/editor-content-access";
import type { IterationEditHandler } from "../../markdown-iteration/edit-context";
import {
  CALC_FENCE_SEED,
  resolveBasicInsert,
  resolveBrandInsert,
  resolveCalcInsert,
  resolveGuidedIterationInsert,
  type InsertableDirective,
  type SlashRange,
} from "./insert-directive";

/** The native (non-directive) blocks the slash menu can insert. */
export type BasicBlockId =
  | "heading"
  | "bullet-list"
  | "ordered-list"
  | "quote"
  | "code"
  | "divider";

/**
 * Context handed to a {@link SlashCommand.run}. `ctx` is the live Milkdown editor
 * context; `range` is the `[from, to)` document range of the typed trigger +
 * query (so the command replaces it), or `null` to insert at the caret.
 */
export interface SlashInsertContext {
  ctx: Ctx;
  range: SlashRange | null;
}

/**
 * Context handed to a {@link SlashCommand.runInSource} (#299) — the Monaco
 * SOURCE-pane counterpart to {@link SlashInsertContext}. By the time this runs,
 * the typed `/query` trigger has already been stripped from the document (the
 * same edit `cancel` uses), so the handler starts from a clean doc.
 */
export interface SourceSlashContext {
  /** The raw Monaco editor instance — full imperative access when needed. */
  editor: MonacoCodeEditor;
  /**
   * Model range the typed `/query` trigger occupied (already removed by the
   * time this fires) — `null` on the hotkey path, where no `/` was ever typed.
   */
  range: IRange | null;
  /** Engine-agnostic content access (get/replace-selection/insert-at-cursor). */
  content: EditorContentAccess;
}

/** One entry in the slash menu. Pure data + an insertion `run`. */
export interface SlashCommand {
  /** Stable id (used as the React key + `aria-activedescendant` target). */
  id: string;
  /** Visible label, e.g. "Card". */
  label: string;
  /** Grouping header, e.g. "Brand blocks" | "Basic". */
  group?: string;
  /** A short description shown under the label. */
  description?: string;
  /** Extra fuzzy-match aids beyond the label (matched case-insensitively). */
  keywords?: string[];
  /** Leading icon (a Lucide glyph or any node). */
  icon?: ReactNode;
  /**
   * Markdown SNIPPET the source / split toolbar's Insert menu inserts (text mode).
   * Optional: commands without one — the basic blocks, which already have their
   * own toolbar buttons — don't appear in that menu. Brand blocks set this so the
   * source toolbar inserts the SAME directive / fence the WYSIWYG `run` builds, so
   * the two surfaces stay at parity. (A4)
   */
  snippet?: string;
  /** Insert the block at the caret. WYSIWYG (Milkdown) — UNCHANGED (#299). */
  run: (ctx: SlashInsertContext) => void;
  /**
   * OPTIONAL source-pane (Monaco) handler (#299) — for a RUN-ONLY command (no
   * `snippet`, e.g. an "Ask AI" entry) that can't express itself as a markdown
   * insert. When present, selecting the command in the Monaco source-pane menu
   * (`MonacoSlashMenu`) strips the typed `/query` first, then calls this with
   * the live editor + the (now-stripped) trigger range + engine-agnostic
   * content access — instead of the `snippet`-only `commitSnippet` fallback. A
   * command needs only ONE of `snippet` / `runInSource` to appear in source (both
   * is fine too — `runInSource` wins there since it's the more capable handler).
   */
  runInSource?: (ctx: SourceSlashContext) => void;
  /**
   * OPTIONAL guided variant (#223, WYSIWYG only). When present AND the
   * consumer has wired an `IterationEditContext` handler (an
   * `IterationBuilderProvider` / `IterationTemplateProvider` above the
   * editor), this REPLACES `run` — it opens the guided modal seeded blank
   * instead of inserting a bare directive. Falls back to `run` when no
   * handler is available, so the 12 non-guided default commands need zero
   * changes. Set on the `iterate` / `pivot` commands only.
   */
  guided?: (insert: SlashInsertContext, handler: IterationEditHandler) => void;
}

/** Build a Lucide icon element at the menu's standard size. */
function glyph(icon: LucideIcon): ReactNode {
  return createElement(icon, { className: "size-4", "aria-hidden": "true" });
}

/**
 * Source-mode markdown snippet per brand directive — the text the Insert menu
 * drops into the Monaco pane. Mirrors the WYSIWYG insert (the `DIRECTIVE_DEFAULTS`
 * attrs + body seeds in `insert-directive.ts`) so both surfaces produce the same
 * `:::` markdown.
 */
const DIRECTIVE_SNIPPET: Record<InsertableDirective, string> = {
  card: `:::card{title="Title"}\nContent\n:::`,
  callout: `:::callout{type="info" title="Note"}\nMessage\n:::`,
  metric: `::metric{label="Label" value="0" description="detail"}`,
  timeline: `:::timeline\n- (done) Step one\n- (active) Step two\n- (pending) Step three\n:::`,
  iterate: `:::iterate{as="item" layout="stacked"}\n{{item.name}}\n:::`,
  pivot: `:::pivot{layout="matrix"}\n{{cell}}\n:::`,
};

/** Directives with a guided authoring modal (#223) — see {@link SlashCommand.guided}. */
const GUIDED_DIRECTIVES = new Set<InsertableDirective>(["iterate", "pivot"]);

/** A brand-directive command (card/callout/metric/timeline/iterate/pivot). */
function brandCommand(
  name: InsertableDirective,
  label: string,
  description: string,
  keywords: string[],
  icon: ReactNode,
): SlashCommand {
  const command: SlashCommand = {
    id: `brand-${name}`,
    label,
    group: "Brand blocks",
    description,
    keywords,
    icon,
    snippet: DIRECTIVE_SNIPPET[name],
    run: ({ ctx, range }) => resolveBrandInsert(ctx, name, range),
  };
  if (GUIDED_DIRECTIVES.has(name)) {
    command.guided = ({ ctx, range }, handler) =>
      resolveGuidedIterationInsert(ctx, name as "iterate" | "pivot", range, handler);
  }
  return command;
}

/** A basic native-block command. */
function basicCommand(
  id: BasicBlockId,
  label: string,
  description: string,
  keywords: string[],
  icon: LucideIcon,
): SlashCommand {
  return {
    id: `basic-${id}`,
    label,
    group: "Basic",
    description,
    keywords,
    icon: glyph(icon),
    run: ({ ctx, range }) => resolveBasicInsert(ctx, id, range),
  };
}

/**
 * The default command list. Brand blocks first (the wedge), then the basics.
 * The brand-block icons reuse the `data-brand-directive` chrome look via Lucide
 * stand-ins (the editor renders the real component once inserted).
 */
export const BRAND_SLASH_COMMANDS: SlashCommand[] = [
  brandCommand(
    "card",
    "Card",
    "A titled content card",
    ["card", "panel", "box", "section"],
    glyph(SquareCode),
  ),
  brandCommand(
    "callout",
    "Callout",
    "A highlighted note / alert",
    ["callout", "alert", "note", "info", "warning", "tip"],
    glyph(Quote),
  ),
  brandCommand(
    "metric",
    "Metric",
    "A single KPI value",
    ["metric", "kpi", "stat", "number", "value"],
    glyph(Minus),
  ),
  brandCommand(
    "timeline",
    "Timeline",
    "A list of steps with status",
    ["timeline", "steps", "milestones", "roadmap", "progress"],
    glyph(List),
  ),
  brandCommand(
    "iterate",
    "Iterate",
    "Repeat a template per data row",
    ["iterate", "repeat", "loop", "for-each", "foreach", "map", "list", "template"],
    glyph(Repeat2),
  ),
  brandCommand(
    "pivot",
    "Pivot",
    "A row × column cross-tab",
    ["pivot", "matrix", "cross-tab", "crosstab", "table", "grid"],
    glyph(Grid3x3),
  ),
  {
    // Inserts a ```calc fence (not a `:::` directive), so it runs its own command
    // rather than `resolveBrandInsert`. Highlight + result inlays come from the
    // editor's calc hooks; the fence is harmless when none are wired.
    id: "brand-calc",
    label: "Calc",
    group: "Brand blocks",
    description: "A live calculation block",
    keywords: ["calc", "calculation", "math", "formula", "sum", "ledger", "budget"],
    icon: glyph(Calculator),
    snippet: ["```calc", CALC_FENCE_SEED, "```"].join("\n"),
    run: ({ ctx, range }) => resolveCalcInsert(ctx, range),
  },
  basicCommand("heading", "Heading", "Section heading", ["heading", "title", "h2"], Heading2),
  basicCommand(
    "bullet-list",
    "Bullet list",
    "An unordered list",
    ["bullet", "list", "unordered", "ul"],
    List,
  ),
  basicCommand(
    "ordered-list",
    "Numbered list",
    "An ordered list",
    ["numbered", "ordered", "list", "ol"],
    ListOrdered,
  ),
  basicCommand("quote", "Quote", "A block quotation", ["quote", "blockquote", "citation"], Quote),
  basicCommand(
    "code",
    "Code block",
    "A fenced code block",
    ["code", "snippet", "pre", "fence"],
    SquareCode,
  ),
  basicCommand(
    "divider",
    "Divider",
    "A horizontal rule",
    ["divider", "rule", "hr", "separator"],
    Minus,
  ),
];

/**
 * Filter a command list by a query (case-insensitive substring over label +
 * keywords). An empty query returns the full list (in registry order).
 */
export function filterSlashCommands(commands: SlashCommand[], query: string): SlashCommand[] {
  const q = query.trim().toLowerCase();
  if (!q) return commands;
  return commands.filter((c) => {
    if (c.label.toLowerCase().includes(q)) return true;
    return (c.keywords ?? []).some((k) => k.toLowerCase().includes(q));
  });
}

/** Preserve registry order while grouping; used by the menu to render headers. */
export function groupSlashCommands(
  commands: SlashCommand[],
): { group: string; commands: SlashCommand[] }[] {
  const order: string[] = [];
  const byGroup = new Map<string, SlashCommand[]>();
  for (const c of commands) {
    const g = c.group ?? "Other";
    if (!byGroup.has(g)) {
      byGroup.set(g, []);
      order.push(g);
    }
    byGroup.get(g)!.push(c);
  }
  return order.map((group) => ({ group, commands: byGroup.get(group)! }));
}
