import type { ReactNode } from "react";
import { Heading, Text, cn } from "@elabs-ai/components-ui";
import { Panel } from "@elabs-ai/components-flow";
import { useMemo } from "react"; // DG-22
import { useDiagram } from "../state/diagram-store"; // DG-22
import { folderOf, useWorkspace } from "../workspace/workspace-store"; // DG-22

export interface TitleBlockProps {
  /** The diagram's `title:`. Without one only `children` render. */
  title?: string;
  /** Prose under the title, capped to a readable measure. */
  description?: string;
  /**
   * The `text-meta` source line — DG-20: "Atlas · N nodes · M flows" on the canvas (the
   * folder and date join it when the workspace service lands), or an example/environment
   * note on a gallery route.
   */
  meta?: string;
  /**
   * Semantic heading level for the title (m10). Default `2`: the app shell's top bar
   * already owns the page `<h1>` (plan §6). A standalone route with no shell (e.g.
   * `#legend`) passes `1` so the page still has exactly one `<h1>`. The visual rung stays
   * pinned to `size="title"` either way, so this never changes how the title looks. (DG-68:
   * dropped from `display` — the breadcrumb's file name is the page's own `h1`; this block is
   * the only place the full title reads, but it no longer needs the display rung to do it.)
   */
  headingLevel?: 1 | 2;
  /**
   * Stacked under the title block, in the same panel — the canvas's status line (wave-2 review
   * m4). Its box is part of the panel, so the chrome-aware fit keeps nodes out from under it.
   */
  children?: ReactNode;
}

/**
 * DG-08 — the diagram's title, as a `Panel` over the canvas (D9: it must be in the exported
 * picture). `Heading level={2}` by default: the app shell's top bar already owns the page
 * `<h1>` (plan §6); `headingLevel={1}` opts a standalone route in instead (m10).
 *
 * DG-20 (defect 1) — an editorial title block, not a floating label card: a heading rung,
 * the description at a prose measure, a `text-meta` source line, and a hairline rule beneath.
 * It sits on a translucent patch of the canvas itself (`bg-canvas/80` + `backdrop-blur-sm`, so
 * lines passing behind it recede) with no shadow or border of its own — it is part of the
 * drawing, not a surface floating over it.
 *
 * DG-68 — the block was oversized for a working canvas (the title showed three times on
 * screen: breadcrumb, tab, here). It stays (D9: exported with the picture) but drops to the
 * `title` rung — the picture's only full-size title is now the picture's own, not a rival to
 * the shell's `h1`.
 */
export function TitleBlock({
  title,
  description,
  meta: sourceMeta,
  headingLevel = 2,
  children,
}: TitleBlockProps) {
  const meta = useSourceLine(sourceMeta); // DG-22: folder and last-saved date join the line
  if (!title && !children) return null;
  return (
    <Panel
      data-slot="diagram-title"
      position="top-left"
      className={cn(
        // m2: `max-w-sm` (384px, a FIXED rem cap) let the panel's shrink-to-fit width win
        // over the pane at 390px — the `truncate` (nowrap) children made their min-content
        // width the full text, so the box never actually shrunk to the cap. `Panel` is
        // `position: absolute` inside `.react-flow` (which fills the pane, `width: 100%`,
        // `position: relative`), so a `%`-based max-width caps it to the PANE, not a fixed
        // rem — 2rem leaves room for the `top-left` panel's own 15px outer margin on both
        // sides. Wave-2 review m1: from `@3xl` the canvas shows the minimap top-right, so the
        // cap also leaves its 200px plus its 15px margin and a gap (16rem in all). P4: library
        // gap — the floating-surface shell should cap itself to its pane so no consumer
        // writes this calc(); see docs/findings/DG-08-legend.md.
        // The column's empty corner (beside a short status line) must not catch the canvas's
        // pointer, so only the block takes it.
        "pointer-events-none flex min-w-0 max-w-[calc(100%-2rem)] flex-col items-start gap-2 @3xl:max-w-[calc(100%-16rem)]",
      )}
    >
      {title ? (
        <div
          data-slot="diagram-title-card"
          className="pointer-events-auto flex min-w-0 max-w-full flex-col gap-1 rounded-t-md border-b border-border bg-canvas/80 px-3 pt-2 pb-2.5 backdrop-blur-sm"
        >
          {/* Wave-2 review m1: wraps to two lines before it clips — `truncate` kept one line
              at the full title's width, which ran under the minimap at 1440. DG-68: `title`
              rung, not `display` — see the file doc comment. */}
          <Heading level={headingLevel} size="title" className="line-clamp-2 min-w-0 break-words">
            {title}
          </Heading>
          {description ? (
            // DG-68 (review F-sizing): `text-pretty` keeps the wrap from stranding one word
            // on its own last line (the review flagged lakehouse-aws.yaml's old "lakehouse.").
            <Text variant="body" tone="muted" className="min-w-0 max-w-prose text-pretty">
              {description}
            </Text>
          ) : null}
          {meta ? (
            <Text variant="meta" tone="muted" className="min-w-0 truncate tabular-nums">
              {meta}
            </Text>
          ) : null}
        </div>
      ) : null}
      {children}
    </Panel>
  );
}

// ── DG-22: the workspace joins the source line ──────────────────────────────────────────
// DG-20's canvas line reads "Atlas · 14 nodes · 14 flows"; with the workspace (DG-21) the open
// file's folder and last-saved date follow the brand: "Atlas · examples · 27 Sep 2026 · 14
// nodes · 14 flows". A root file has no folder; a share link (no file) keeps DG-20's line.

const SOURCE_BRAND = "Atlas · ";
// `27 Sep 2026`: built from parts, because en-GB's short month is "Sept" in current ICU data.
const MONTH = new Intl.DateTimeFormat("en-US", { month: "short" });
function savedOn(mtime: number): string {
  const date = new Date(mtime);
  return `${date.getDate()} ${MONTH.format(date)} ${date.getFullYear()}`;
}

export interface WorkspaceMeta {
  /** The file's folder (`examples`), `""` at the workspace root. */
  folder: string;
  /** The file's last write (its mtime), as `27 Sep 2026`. */
  savedOn: string;
}

/** The shown document's folder and last-saved date; `null` when it is no workspace file. */
export function useWorkspaceMeta(): WorkspaceMeta | null {
  const shown = useDiagram((s) => s.path);
  const path = useWorkspace((s) => s.current?.path);
  const mtime = useWorkspace((s) => s.current?.mtime ?? null);
  return useMemo(
    () =>
      path === undefined || path !== shown || mtime === null
        ? null
        : { folder: folderOf(path), savedOn: savedOn(mtime) },
    [path, shown, mtime],
  );
}

/** DG-20's source line with the folder and date after the brand; any other line as it is. */
function useSourceLine(meta: string | undefined): string | undefined {
  const workspace = useWorkspaceMeta();
  if (!workspace || !meta?.startsWith(SOURCE_BRAND)) return meta;
  const place = [workspace.folder, workspace.savedOn].filter(Boolean).join(" · ");
  return `${SOURCE_BRAND}${place} · ${meta.slice(SOURCE_BRAND.length)}`;
}
