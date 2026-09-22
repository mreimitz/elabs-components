/**
 * `markdown` dashboard tile (copy-owned block) — a `DashboardTileKind` that renders a
 * markdown body with `@elabs-ai/components-ai`'s `MarkdownView` (sanitised GFM: headings,
 * lists, task lists, tables, code, blockquotes, images) and edits it with
 * `@elabs-ai/components-editor`'s `MarkdownEditor` (WYSIWYG, slash menu) in a full-size
 * editor dialog. `dashboard/` itself may only import `charts`/`ui`/`tokens`/`icons`
 * (.claude/rules/dashboard.md), so this cross-package tile is host-registered through the
 * tile-kind registry (D4) — this block IS that registration. Register it under the built-in
 * `text` kind (`createMarkdownTileKind("text")`) to upgrade every existing text tile in place:
 * the content shape (`{ body, align }`) is a superset of the built-in `text` kind's.
 *
 * **Dynamic content.** The body may carry `${{ … }}` placeholders, resolved at render time
 * and re-resolved on every selection or variable change:
 *
 * - `${{variables.name}}` — a sheet variable's value.
 * - `${{selection.Field}}` — the selected values of a field, comma-separated (`All` when
 *   nothing is selected); `${{selection.count('Field')}}` — how many.
 * - `${{=expression}}`, `${{dim:ID:Title}}`, `${{msr:ID:Title}}` — handed to the host's
 *   `evaluate(expr)` (`DashboardProvider`'s `host.markdown.evaluate`, sync or async): a BI
 *   host evaluates the expression or resolves the master item against its engine (D5: the
 *   library never owns the engine call). Without a host evaluator the placeholder renders
 *   as its title.
 *
 * **Editor dialog.** Double-click the tile in edit mode, or use its header's “Edit content”
 * button. Left: an insert rail of the sheet's variables and selection fields plus the
 * host's own items (`host.markdown.items` — master dimensions/measures in a BI host), a
 * click inserts the placeholder at the caret. Middle: the WYSIWYG editor. Right: a live
 * preview with the placeholders resolved. Ctrl/⌘+S saves, Escape cancels.
 *
 * Depends on installed @elabs-ai/components-ai, @elabs-ai/components-editor,
 * @elabs-ai/components-charts (its /dashboard subpath) and @elabs-ai/components-ui.
 */
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type ComponentType,
} from "react";
import { MarkdownView } from "@elabs-ai/components-ai";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  ScrollArea,
  cn,
} from "@elabs-ai/components-ui";
import { MarkdownEditor, type MarkdownEditorHandle } from "@elabs-ai/components-editor";
import {
  useDashboard,
  useDashboardActions,
  useDashboardContext,
  type DashboardTileKind,
  type DashboardTileProps,
  type SelectionSnapshot,
  type VariableValue,
} from "@elabs-ai/components-charts/dashboard";
import { Braces, Eye, FileText, Hash, ListFilter, PenLine, Variable } from "lucide-react";

/** Content of a `markdown` tile. A superset of the built-in `text` kind's `{ body, align }`. */
export interface DashboardTileMarkdownContent {
  /** GitHub-flavoured markdown, with `${{ … }}` placeholders (see the module doc). */
  body: string;
  /** Text alignment. Default `start`. */
  align?: "start" | "center" | "end";
  /** Inner padding in spacing steps (0–8). Default `0` — the tile frame already pads. */
  padding?: number;
  /** The prose scale a `#` maps to. Default `2` (tile headings stay below the sheet title). */
  baseHeadingLevel?: 1 | 2 | 3;
}

/** An insertable the host adds to the editor's rail (a BI host's master dimensions/measures). */
export interface MarkdownTileHostItem {
  id: string;
  label: string;
  /** Rail group: `dimension` or `measure` (or any other word — it becomes a heading). */
  group: string;
  /** The placeholder inserted; defaults to `${{msr:ID:Label}}` / `${{dim:ID:Label}}` by group. */
  placeholder?: string;
}

/** What this kind reads off `DashboardProvider`'s opaque `host` prop, under `host.markdown`. */
export interface MarkdownTileHost {
  /** Resolve a `${{=…}}`, `${{dim:…}}` or `${{msr:…}}` placeholder to text. Sync or async. */
  evaluate?: (expression: string) => string | number | Promise<string | number>;
  /** Extra insertables for the editor rail. */
  items?: MarkdownTileHostItem[];
}

const PLACEHOLDER_RE = /\$\{\{\s*([\s\S]*?)\s*\}\}/g;

/** The placeholders in `body`, in order (deduplicated). */
export function findPlaceholders(body: string): string[] {
  const out = new Set<string>();
  for (const match of body.matchAll(PLACEHOLDER_RE)) if (match[1]) out.add(match[1]);
  return [...out];
}

function formatValues(values: readonly (string | number)[]): string {
  return values.map((v) => String(v)).join(", ");
}

/**
 * Resolve every placeholder the library can answer itself (variables, selections). Returns
 * `null` for the ones only a host can evaluate.
 */
export function resolveLocalPlaceholder(
  expression: string,
  ctx: { variables: Readonly<Record<string, VariableValue>>; selection: SelectionSnapshot },
): string | null {
  const variable = /^variables\.([\w-]+)$/.exec(expression);
  if (variable?.[1] !== undefined) {
    const value = ctx.variables[variable[1]];
    return value === undefined ? "" : String(value);
  }
  const count = /^selection\.count\(\s*['"]?([^'")]*)['"]?\s*\)$/.exec(expression);
  if (count) return String(ctx.selection.count(count[1] || undefined));
  const field = /^selection\.([\w-]+)$/.exec(expression);
  if (field?.[1] !== undefined) {
    const values = ctx.selection.fields[field[1]]?.values ?? [];
    return values.length === 0 ? "All" : formatValues(values);
  }
  return null;
}

/** The title a `dim:`/`msr:` reference carries, or the raw expression. */
function placeholderTitle(expression: string): string {
  const ref = /^(dim|msr):([^:]+):(.+)$/.exec(expression);
  if (ref?.[3]) return ref[3];
  return expression.startsWith("=") ? expression.slice(1) : expression;
}

/**
 * Resolve `body`'s placeholders: local ones synchronously, host ones through `evaluate` (an
 * async answer re-renders when it lands). Re-runs on every selection/variable change.
 */
function useResolvedMarkdown(
  body: string,
  ctx: { variables: Readonly<Record<string, VariableValue>>; selection: SelectionSnapshot },
  host: MarkdownTileHost | undefined,
): string {
  const placeholders = useMemo(() => findPlaceholders(body), [body]);
  const [hostValues, setHostValues] = useState<Record<string, string>>({});
  const evaluate = host?.evaluate;

  useEffect(() => {
    if (!evaluate) return;
    let cancelled = false;
    const pending = placeholders.filter((p) => resolveLocalPlaceholder(p, ctx) === null);
    for (const expression of pending) {
      Promise.resolve()
        .then(() => evaluate(expression))
        .then((value) => {
          if (cancelled) return;
          setHostValues((prev) =>
            prev[expression] === String(value) ? prev : { ...prev, [expression]: String(value) },
          );
        })
        .catch(() => {
          if (!cancelled) setHostValues((prev) => ({ ...prev, [expression]: "⚠" }));
        });
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-evaluate on selection/variable change
  }, [placeholders, evaluate, ctx.selection, ctx.variables]);

  return useMemo(() => {
    const out = body.replace(PLACEHOLDER_RE, (_whole, expression: string) => {
      const key = expression.trim();
      const local = resolveLocalPlaceholder(key, ctx);
      if (local !== null) return local;
      return hostValues[key] ?? placeholderTitle(key);
    });
    return out;
  }, [body, ctx, hostValues]);
}

const ALIGN_CLASS = { start: "text-start", center: "text-center", end: "text-end" } as const;

/**
 * A GFM table on a tile is plain rows, not the chat view's framed, toolbar-bearing card
 * (`MarkdownView`'s default wraps every table in a raised `bg-sidebar` box — right for a
 * transcript, heavy inside a dashboard).
 */
function PlainTable({ children, className, ...props }: ComponentProps<"table">) {
  return (
    <div className="my-2 w-full overflow-x-auto">
      <table
        className={cn("w-full border-collapse text-body [&_td]:align-top", className)}
        {...props}
      >
        {children}
      </table>
    </div>
  );
}
const MARKDOWN_COMPONENTS = { table: PlainTable } as const;
const PADDING_CLASS = ["p-0", "p-1", "p-2", "p-3", "p-4", "p-5", "p-6", "p-7", "p-8"] as const;

// ---------------------------------------------------------------------------
// The editor dialog
// ---------------------------------------------------------------------------

interface InsertItem {
  id: string;
  label: string;
  placeholder: string;
}

function MarkdownEditorDialog({
  open,
  onOpenChange,
  title,
  value,
  onSave,
  ctx,
  host,
  items,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  value: string;
  onSave: (body: string) => void;
  ctx: { variables: Readonly<Record<string, VariableValue>>; selection: SelectionSnapshot };
  host: MarkdownTileHost | undefined;
  items: { group: string; icon: ComponentType<{ className?: string }>; items: InsertItem[] }[];
}) {
  const [draft, setDraft] = useState(value);
  const [query, setQuery] = useState("");
  const [pane, setPane] = useState<"edit" | "preview">("edit");
  const editorRef = useRef<MarkdownEditorHandle>(null);
  useEffect(() => {
    if (open) setDraft(value);
  }, [open, value]);
  const preview = useResolvedMarkdown(draft, ctx, host);

  const insert = useCallback((placeholder: string) => {
    const handle = editorRef.current;
    if (handle) {
      handle.insertAtCursor(placeholder);
      handle.focus();
    } else setDraft((d) => `${d}${d.endsWith("\n") || d === "" ? "" : " "}${placeholder}`);
  }, []);

  const save = () => {
    onSave(editorRef.current?.getMarkdown() ?? draft);
    onOpenChange(false);
  };
  const needle = query.trim().toLowerCase();
  const groups = items
    .map((group) => ({
      ...group,
      items: needle
        ? group.items.filter((item) => item.label.toLowerCase().includes(needle))
        : group.items,
    }))
    .filter((group) => group.items.length > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="full"
        className="flex h-[88vh] max-w-6xl flex-col gap-0 p-0"
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
            event.preventDefault();
            save();
          }
        }}
      >
        <DialogHeader className="border-b border-border px-5 py-3">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Markdown with live placeholders — insert a variable, a selection or a host item from the
            rail; the preview resolves them as readers will see them.
          </DialogDescription>
        </DialogHeader>
        <div className="grid min-h-0 flex-1 grid-cols-[13rem_minmax(0,1fr)] lg:grid-cols-[13rem_minmax(0,1fr)_minmax(0,1fr)]">
          {/* Insert rail */}
          <aside
            aria-label="Insert"
            className="flex min-h-0 flex-col gap-2 border-e border-border bg-surface-muted p-3"
          >
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search…"
              aria-label="Search insertables"
              className="h-8"
            />
            <ScrollArea className="min-h-0 flex-1">
              <div className="flex flex-col gap-3 pe-2">
                {groups.length === 0 ? (
                  <p className="text-meta text-muted-foreground">Nothing to insert.</p>
                ) : null}
                {groups.map((group) => (
                  <section key={group.group} className="flex flex-col gap-0.5">
                    <h3 className="inline-flex items-center gap-1.5 px-1 text-meta font-medium text-muted-foreground">
                      <group.icon aria-hidden="true" className="size-3.5" />
                      {group.group}
                    </h3>
                    {group.items.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => insert(item.placeholder)}
                        title={item.placeholder}
                        className="flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-start text-body text-foreground hover:bg-accent hover:text-accent-foreground focus-ring"
                      >
                        <span className="min-w-0 flex-1 truncate">{item.label}</span>
                        <Braces
                          aria-hidden="true"
                          className="size-3.5 shrink-0 text-muted-foreground"
                        />
                      </button>
                    ))}
                  </section>
                ))}
              </div>
            </ScrollArea>
          </aside>
          {/* Editor and preview side by side; below `lg` one of them at a time (footer toggle). */}
          <div
            className={cn(
              "min-h-0 flex-col overflow-auto border-e border-border",
              pane === "preview" ? "hidden lg:flex" : "flex",
            )}
          >
            <MarkdownEditor
              ref={editorRef}
              value={draft}
              onChange={setDraft}
              ariaLabel="Markdown body"
              className="min-h-full px-3 py-2"
            />
          </div>
          <div
            role="region"
            aria-label="Preview"
            className={cn(
              "min-h-0 flex-col overflow-auto bg-background p-5",
              pane === "edit" ? "hidden lg:flex" : "flex",
            )}
          >
            <span className="mb-2 inline-flex items-center gap-1.5 text-meta font-medium text-muted-foreground">
              <Eye aria-hidden="true" className="size-3.5" />
              Preview
            </span>
            <MarkdownView key={preview} mode="static" components={MARKDOWN_COMPONENTS}>
              {preview}
            </MarkdownView>
          </div>
        </div>
        <DialogFooter className="border-t border-border px-5 py-3 sm:justify-between">
          <Button
            variant="outline"
            className="lg:hidden"
            aria-pressed={pane === "preview"}
            onClick={() => setPane((p) => (p === "edit" ? "preview" : "edit"))}
          >
            <Eye aria-hidden="true" />
            {pane === "edit" ? "Preview" : "Edit"}
          </Button>
          <span className="hidden flex-1 lg:block" />
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// The tile
// ---------------------------------------------------------------------------

function MarkdownTile({
  tile,
  mode,
  selection,
  variables,
  density,
}: DashboardTileProps<DashboardTileMarkdownContent>) {
  const content = tile.content;
  const body = content?.body ?? "";
  const align = content?.align ?? "start";
  const padding = Math.max(0, Math.min(8, content?.padding ?? 0));
  const host = useDashboardContext().host?.markdown as MarkdownTileHost | undefined;
  const actions = useDashboardActions();
  const spec = useDashboard((s) => s.spec);
  const ctx = useMemo(() => ({ variables, selection }), [variables, selection]);
  const resolved = useResolvedMarkdown(body, ctx, host);
  const [editing, setEditing] = useState(false);
  const editable = mode === "edit";

  const items = useMemo(() => {
    const fields = new Set<string>([
      ...(spec.filters ?? []).map((f) => f.field),
      ...Object.keys(selection.fields),
      ...spec.tiles.flatMap((t) => {
        const c = t.content as { field?: unknown } | undefined;
        return typeof c?.field === "string" ? [c.field] : [];
      }),
    ]);
    const groups: {
      group: string;
      icon: ComponentType<{ className?: string }>;
      items: InsertItem[];
    }[] = [
      {
        group: "Variables",
        icon: Variable,
        items: (spec.variables ?? []).map((v) => ({
          id: `var:${v.name}`,
          label: v.label ?? v.name,
          placeholder: `\${{variables.${v.name}}}`,
        })),
      },
      {
        group: "Selections",
        icon: ListFilter,
        items: [...fields].flatMap((field) => [
          { id: `sel:${field}`, label: field, placeholder: `\${{selection.${field}}}` },
          {
            id: `cnt:${field}`,
            label: `${field} (count)`,
            placeholder: `\${{selection.count('${field}')}}`,
          },
        ]),
      },
    ];
    const byGroup = new Map<string, InsertItem[]>();
    for (const item of host?.items ?? []) {
      const kind = item.group.toLowerCase().startsWith("dim") ? "dim" : "msr";
      const list = byGroup.get(item.group) ?? [];
      list.push({
        id: `${kind}:${item.id}`,
        label: item.label,
        placeholder: item.placeholder ?? `\${{${kind}:${item.id}:${item.label}}}`,
      });
      byGroup.set(item.group, list);
    }
    for (const [group, list] of byGroup) groups.push({ group, icon: Hash, items: list });
    return groups.filter((g) => g.items.length > 0);
  }, [spec, selection.fields, host?.items]);

  const empty = body.trim() === "";

  return (
    <div
      data-slot="dashboard-tile-markdown"
      data-tile-kind={tile.kind}
      className={cn(
        "relative size-full min-h-0 overflow-auto",
        ALIGN_CLASS[align],
        PADDING_CLASS[padding],
      )}
      onDoubleClick={editable ? () => setEditing(true) : undefined}
    >
      {empty ? (
        <p className="text-caption text-muted-foreground">
          {editable ? "Double-click to write, or use Edit content." : ""}
        </p>
      ) : (
        <MarkdownView
          // Remount on every change: Streamdown's element memo compares hast POSITIONS,
          // not text, so a resolved value replacing a same-shaped placeholder inside a
          // table cell would otherwise keep showing the old text. The body is small.
          key={resolved}
          mode="static"
          components={MARKDOWN_COMPONENTS}
          baseHeadingLevel={content?.baseHeadingLevel ?? 2}
          className={cn(density === "xs" && "text-caption")}
        >
          {resolved}
        </MarkdownView>
      )}
      {editable ? (
        <Button
          variant="secondary"
          size="sm"
          data-slot="dashboard-tile-markdown-edit"
          className="absolute end-2 top-2 shadow-sm"
          onClick={() => setEditing(true)}
        >
          <PenLine aria-hidden="true" />
          Edit content
        </Button>
      ) : null}
      {editable ? (
        <MarkdownEditorDialog
          open={editing}
          onOpenChange={setEditing}
          title={tile.title ? `Edit “${tile.title}”` : "Edit content"}
          value={body}
          onSave={(next) => actions.patchTile(tile.id, { content: { ...content, body: next } })}
          ctx={ctx}
          host={host}
          items={items}
        />
      ) : null}
    </div>
  );
}

/** Build a `markdown` tile kind. Pass `"text"` to replace the built-in text kind in place. */
export function createMarkdownTileKind(
  kind = "markdown",
): DashboardTileKind<DashboardTileMarkdownContent> {
  return {
    kind,
    label: kind === "text" ? "Text" : "Markdown",
    icon: FileText,
    description: "Rich text with live values: headings, lists, tables, images, placeholders.",
    component: MarkdownTile,
    defaultSize: { w: 8, h: 4 },
    minSize: { w: 2, h: 1 },
    capabilities: { expand: true, consumesSelection: true },
    configForm: {
      formName: `${kind}-tile`,
      fields: [
        {
          type: "enum",
          name: "align",
          label: "Alignment",
          options: ["start", "center", "end"],
          default: "start",
        },
        { type: "integer", name: "padding", label: "Padding", min: 0, max: 8, default: 0 },
        {
          type: "integer",
          name: "baseHeadingLevel",
          label: "Heading scale",
          min: 1,
          max: 3,
          default: 2,
        },
      ],
    },
    defaultContent: { body: "" },
  };
}

/** `createMarkdownTileKind()` — the default `markdown` kind. */
export const markdownTileKind = createMarkdownTileKind();
