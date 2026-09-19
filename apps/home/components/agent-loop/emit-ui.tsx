"use client";

/**
 * "Let the agent emit the UI" (RM-101, concept §2 and §4.3 second half) — two live editors
 * inside the agents movement: an A2UI surface (D2: validated against the catalog, rendered by
 * `A2uiSurface`) and a DashboardSpec sheet (`validateDashboardSpec` + `autoLayout` →
 * `DashboardSheet`). Every error shown is the library validator's own; the site never
 * re-implements validation.
 *
 * Loading: the A2UI renderer ships with the page (ai is a hero package); the dashboard sheet is
 * a `next/dynamic` chunk that loads when its tab opens. Monaco (`CodeEditor`) is fetched only
 * after the section enters the viewport, and only replaces `SpecPlayground`'s built-in textarea
 * once its chunks have arrived — until then, and for good if the import fails, the textarea is
 * the live editor.
 *
 * Test hooks (RM-101 acceptance): `window.__emitUiDashboardSpec` mirrors the spec the sheet
 * renders (quote its `layout` values after `autoLayout`); `data-editor` on the section says
 * which editor is live (`textarea` / `monaco`).
 */
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  A2UI_CATALOG_SCHEMA,
  A2uiSurface,
  validateA2uiSurface,
  type A2uiActionHandler,
  type A2uiSurfaceSpec,
} from "@elabs-ai/components-ai";
import type { MonacoCodeEditor } from "@elabs-ai/components-editor";
import type { DashboardSpec } from "@elabs-ai/components-charts/dashboard";
import {
  CommandChip,
  Heading,
  RevealOnEnter,
  SpecPlayground,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Text,
  Toaster,
  toast,
  type SpecPlaygroundError,
  type SpecPlaygroundExample,
  type SpecPlaygroundLabels,
  type SpecPlaygroundValidation,
} from "@elabs-ai/components-ui";
import { cli } from "../../lib/content";
import { emitUiCopy as copy } from "../../content/copy";
import { KPI_HEADLINES, ARR_SERIES, SUPPORT_BACKLOG_SERIES } from "../../content/fixtures/kpis";
import examplesJson from "../../content/generated/emit-ui-examples.json";

declare global {
  interface Window {
    /** The spec the DashboardSpec tab's sheet renders, after `autoLayout` + normalisation. */
    __emitUiDashboardSpec?: DashboardSpec;
  }
}

type Format = "a2ui" | "dashboardSpec";
const EDITOR_HEIGHT = 320;
const SHEET_BREAKPOINTS = { md: 1024, sm: 480 };
const pretty = (value: unknown) => JSON.stringify(value, null, 2);

// ── Examples ────────────────────────────────────────────────────────────────────
// A2UI + the golden DashboardSpec come from gen-home (the CLI's own output, validated there);
// the six-tile sheet is built here from the site fixtures so its numbers are the hero's.

const LOCALE = "en-US";
const usd = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 1,
  notation: "compact",
});
const oneDecimal = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 1 });
const whole = new Intl.NumberFormat(LOCALE);

function formatKpi(unit: string, value: number, signed = false): string {
  const sign = signed && value >= 0 ? "+" : "";
  if (unit === "usd") return `${sign}${usd.format(value)}`;
  if (unit === "percent") return `${sign}${oneDecimal.format(value)}${signed ? " pts" : "%"}`;
  return `${sign}${whole.format(value)}`;
}

function buildKpiSheet(): DashboardSpec {
  const metric = (id: string, x: number) => {
    const kpi = KPI_HEADLINES.find((headline) => headline.id === id)!;
    return {
      id: `metric-${id}`,
      kind: "metric",
      title: kpi.label,
      layout: { x, y: 0, w: 6, h: 4 },
      content: {
        label: kpi.label,
        value: formatKpi(kpi.unit, kpi.value),
        delta: formatKpi(kpi.unit, kpi.delta, true),
        deltaDirection: kpi.delta >= 0 ? ("up" as const) : ("down" as const),
      },
    };
  };
  return {
    version: 1,
    id: "ashgrove-kpis",
    title: copy.kpiSheet.title,
    grid: { mode: "fit", columns: 24, rows: 11, gap: 8 },
    tiles: [
      metric("arr", 0),
      metric("nrr", 6),
      metric("churn", 12),
      metric("active-accounts", 18),
      {
        id: "chart-arr",
        kind: "chart",
        title: copy.kpiSheet.arrTrend,
        layout: { x: 0, y: 4, w: 12, h: 7 },
        content: { type: "line", x: "week", series: ["value"], data: ARR_SERIES.points },
      },
      {
        id: "chart-backlog",
        kind: "chart",
        title: copy.kpiSheet.backlogTrend,
        layout: { x: 12, y: 4, w: 12, h: 7 },
        content: { type: "bar", x: "week", series: ["value"], data: SUPPORT_BACKLOG_SERIES.points },
      },
    ],
  };
}

function examplesFor(format: Format): SpecPlaygroundExample[] {
  const generated = examplesJson[format].map((entry) => ({
    id: entry.id,
    label: (copy.examples[format] as Record<string, string | undefined>)[entry.id] ?? entry.id,
    value: pretty(entry.value),
  }));
  if (format === "a2ui") return generated;
  // The six-tile sheet leads: it is the one that shows `autoLayout` and `overlap` at work.
  return [
    { id: "kpis", label: copy.examples.dashboardSpec.kpis, value: pretty(buildKpiSheet()) },
    ...generated,
  ];
}

// ── Validators: the library's own, adapted to SpecPlayground's `{ ok, spec | errors }` ──────

function validateSurface(json: unknown): SpecPlaygroundValidation<A2uiSurfaceSpec> {
  const result = validateA2uiSurface(json, A2UI_CATALOG_SCHEMA);
  return result.ok ? { ok: true, spec: result.spec } : { ok: false, errors: result.errors };
}

// ── Monaco, loaded when the section enters the viewport ─────────────────────────────────────

/** `CodeEditor` through `next/dynamic`; rendered only after `preloadMonaco` resolved, so it
 * mounts from the module cache instead of showing an empty box. */
const MonacoEditor = dynamic(
  () => import("@elabs-ai/components-editor").then((m) => m.CodeEditor),
  { ssr: false },
);

/** Fetch the editor chunk AND Monaco itself; rejects if either request fails. */
const preloadMonaco = () =>
  Promise.all([
    import("@elabs-ai/components-editor"),
    import("@elabs-ai/components-editor/monaco"),
  ]);

type EditorState = "textarea" | "loading" | "monaco";

function useMonacoOnEnter(target: React.RefObject<HTMLElement | null>): EditorState {
  const [state, setState] = useState<EditorState>("textarea");
  useEffect(() => {
    const el = target.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    let cancelled = false;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      setState("loading");
      preloadMonaco().then(
        () => !cancelled && setState("monaco"),
        // The textarea stays the editor (route-abort test, offline, blocked chunk).
        () => !cancelled && setState("textarea"),
      );
    });
    observer.observe(el);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [target]);
  return state;
}

// ── One tab: a SpecPlayground wired to an editor, a validator and a renderer ────────────────

const playgroundLabels = (format: Format): Partial<SpecPlaygroundLabels> => ({
  ...copy.playground,
  editor: copy.playground[format].editor,
  preview: copy.playground[format].preview,
});

interface FormatPlaygroundProps<TSpec> {
  format: Format;
  monaco: boolean;
  validate: (json: unknown) => SpecPlaygroundValidation<TSpec>;
  render: (spec: TSpec) => ReactNode;
}

function FormatPlayground<TSpec>({
  format,
  monaco,
  validate,
  render,
}: FormatPlaygroundProps<TSpec>) {
  const examples = useMemo(() => examplesFor(format), [format]);
  const [value, setValue] = useState(examples[0]!.value);
  const editorRef = useRef<MonacoCodeEditor | null>(null);

  const revealLine = (_error: SpecPlaygroundError, line: number | undefined) => {
    const editor = editorRef.current;
    if (!editor) return;
    const lineNumber = line ?? 1;
    editor.revealLineInCenter(lineNumber);
    editor.setPosition({ lineNumber, column: 1 });
    editor.focus();
  };

  return (
    <SpecPlayground
      id={`emit-ui-${format}`}
      value={value}
      defaultValue={examples[0]!.value}
      onChange={setValue}
      validate={validate}
      render={render}
      examples={examples}
      labels={playgroundLabels(format)}
      onErrorSelect={monaco ? revealLine : undefined}
      editor={
        monaco ? (
          <MonacoEditor
            data-slot="code-editor"
            language="json"
            path={`emit-ui-${format}.json`}
            value={value}
            onChange={setValue}
            height={EDITOR_HEIGHT}
            ariaLabel={copy.monacoLabel(copy.tabs[format].label)}
            contextMenu="none"
            // Tab leaves the editor (keyboard path editor → errors → surface). No line-number
            // gutter: the editor theme's gutter ink measures 2.33:1 (axe color-contrast); the
            // error list names the line and moves the caret there instead.
            options={{ tabFocusMode: true, lineNumbers: "off" }}
            onMount={(editor) => {
              editorRef.current = editor;
            }}
            className="rounded-md border border-input"
          />
        ) : undefined
      }
    />
  );
}

// ── A2UI tab ─────────────────────────────────────────────────────────────────────────────

/** The host action map: a click shows which action the surface sent, so the wiring is visible. */
const onA2uiAction: A2uiActionHandler = (action, context) => {
  if (context.event === "click") toast(copy.action(action.name));
};

const renderSurface = (spec: A2uiSurfaceSpec) => (
  <A2uiSurface surface={spec} onAction={onA2uiAction} />
);

// ── DashboardSpec tab (its own chunk: the sheet engine loads when this tab opens) ────────────

const DashboardSpecPlayground = dynamic(
  () =>
    import("@elabs-ai/components-charts/dashboard").then((m) => {
      const tiles = Object.values(m.builtInTiles);
      const isRecord = (v: unknown): v is Record<string, unknown> =>
        typeof v === "object" && v !== null && !Array.isArray(v);

      /** Tiles without a `layout` are placed first by `autoLayout` — the function behind
       * `brand-ui dashboard-spec layout` — then the spec goes to `validateDashboardSpec`. */
      function validateSheet(json: unknown): SpecPlaygroundValidation<DashboardSpec> {
        let input = json;
        if (
          isRecord(json) &&
          Array.isArray(json.tiles) &&
          json.tiles.every((tile) => isRecord(tile) && typeof tile.kind === "string") &&
          json.tiles.some((tile) => isRecord(tile) && tile.layout === undefined)
        ) {
          const grid = isRecord(json.grid) ? json.grid : {};
          const placed = m.autoLayout(
            json.tiles as Parameters<typeof m.autoLayout>[0],
            grid as unknown as Parameters<typeof m.autoLayout>[1],
            m.BUILT_IN_TILE_KIND_DEFAULTS,
          );
          input = {
            ...json,
            tiles: placed.tiles,
            ...(isRecord(json.grid) ? { grid: placed.grid } : {}),
          };
        }
        const result = m.validateDashboardSpec(input);
        if (!result.ok) return { ok: false, errors: result.errors };
        return { ok: true, spec: m.normalizeDashboardSpec(result.spec).spec };
      }

      function Sheet({ spec }: { spec: DashboardSpec }) {
        useEffect(() => {
          window.__emitUiDashboardSpec = spec;
        }, [spec]);
        return (
          // `key` remounts the provider: its store reads `spec` once, on creation.
          <m.DashboardProvider key={JSON.stringify(spec)} spec={spec} tiles={tiles} mode="view">
            <div className="h-128 min-w-0">
              {/* The preview pane is ~600 px at 1440: keep the authored layout down to 480 px and
                  stack only on phones (the default `sm` threshold, 640, stacks the pane). */}
              <m.DashboardSheet renderAll breakpoints={SHEET_BREAKPOINTS} />
            </div>
          </m.DashboardProvider>
        );
      }
      const renderSheet = (spec: DashboardSpec) => <Sheet spec={spec} />;

      return function DashboardSpecTab({ monaco }: { monaco: boolean }) {
        return (
          <FormatPlayground
            format="dashboardSpec"
            monaco={monaco}
            validate={validateSheet}
            render={renderSheet}
          />
        );
      };
    }),
  { ssr: false },
);

// ── The section ──────────────────────────────────────────────────────────────────────────

function schemaHosts(group: "a2ui" | "dashboard-spec") {
  const usage = cli.verbGroups[group]?.find((verb) => verb.verb === "schema")?.usage ?? "";
  const npx = cli.localMcpCommand.replace(/ mcp$/, "");
  return [
    { id: "cli", label: copy.schemaHosts.cli, command: usage },
    { id: "npx", label: copy.schemaHosts.npx, command: usage.replace(/^brand-ui/, npx) },
  ];
}

function FormatHeader({ format, group }: { format: Format; group: "a2ui" | "dashboard-spec" }) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <Text className="text-muted-foreground">{copy.tabs[format].what}</Text>
      <CommandChip
        hosts={schemaHosts(group)}
        labels={copy.schemaChip}
        aria-label={copy.schemaLabel}
      />
    </div>
  );
}

export function EmitUiSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const editor = useMonacoOnEnter(sectionRef);
  const monaco = editor === "monaco";

  return (
    <RevealOnEnter
      ref={sectionRef}
      as="section"
      id="emit-ui"
      aria-labelledby="emit-ui-heading"
      data-editor={editor}
      className="mx-auto flex w-full max-w-7xl scroll-mt-24 flex-col gap-8 px-4 pb-24 sm:px-6"
    >
      <header className="flex max-w-3xl flex-col gap-3">
        <p className="text-eyebrow text-muted-foreground">{copy.eyebrow}</p>
        <Heading level={3} id="emit-ui-heading">
          {copy.heading}
        </Heading>
        <Text className="text-muted-foreground">{copy.lede}</Text>
      </header>
      <Tabs defaultValue="a2ui" className="flex min-w-0 flex-col gap-6">
        <TabsList aria-label={copy.tabsLabel} className="self-start">
          <TabsTrigger value="a2ui">{copy.tabs.a2ui.label}</TabsTrigger>
          <TabsTrigger value="dashboardSpec">{copy.tabs.dashboardSpec.label}</TabsTrigger>
        </TabsList>
        <TabsContent value="a2ui" className="flex min-w-0 flex-col gap-4">
          <FormatHeader format="a2ui" group="a2ui" />
          <FormatPlayground
            format="a2ui"
            monaco={monaco}
            validate={validateSurface}
            render={renderSurface}
          />
        </TabsContent>
        <TabsContent value="dashboardSpec" className="flex min-w-0 flex-col gap-4">
          <FormatHeader format="dashboardSpec" group="dashboard-spec" />
          <DashboardSpecPlayground monaco={monaco} />
        </TabsContent>
      </Tabs>
      <Toaster />
    </RevealOnEnter>
  );
}
