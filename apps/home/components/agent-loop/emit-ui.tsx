"use client";

/**
 * "Let the agent emit the UI" (RM-101, concept §2 and §4.3 second half) — the live editor
 * inside the agents movement: an A2UI surface (D2: validated against the catalog, rendered by
 * `A2uiSurface`). Every error shown is the library validator's own; the site never
 * re-implements validation.
 *
 * It was a two-tab section (A2UI + a DashboardSpec sheet) until 2026-09-22, when the dashboard
 * pack was parked (`parked/README.md`). `Format` and the `format`-keyed copy/example maps are
 * kept as maps rather than flattened to A2UI, so the second tab can come back as a data entry.
 *
 * Loading (issue #597, decided 2026-09-23): the A2UI catalog schema, `A2uiSurface` and
 * `validateA2uiSurface` are fetched only after the section enters the viewport — the SAME gate
 * Monaco (`CodeEditor`) already used here, extended to cover them too — so neither ships in the
 * initial `/` chunk. Until the section is near and that fetch resolves, `FormatPlayground` is a
 * same-size skeleton; once it has, Monaco is a second, independent fetch behind the same gate
 * that only replaces `SpecPlayground`'s built-in textarea once its own chunks arrive — until
 * then, and for good if that import fails, the textarea is the live editor. (Superseded: this
 * file previously kept the A2UI renderer eager, reasoning "ai is a hero package" — the owner
 * decision for #597 was to gate it like Monaco instead.)
 *
 * Test hooks (RM-101 acceptance): `data-editor` on the section says which editor is live
 * (`textarea` / `monaco`); `data-a2ui` says whether the catalog/renderer have loaded yet
 * (`loading` / `ready`).
 */
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type * as AiModule from "@elabs-ai/components-ai";
import type { A2uiActionHandler, A2uiSurfaceSpec } from "@elabs-ai/components-ai";
import type { MonacoCodeEditor } from "@elabs-ai/components-editor";
import {
  CommandChip,
  Heading,
  RevealOnEnter,
  Skeleton,
  SpecPlayground,
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
import examplesJson from "../../content/generated/emit-ui-examples.json";

type Format = "a2ui";
const EDITOR_HEIGHT = 320;
const pretty = (value: unknown) => JSON.stringify(value, null, 2);

// ── Examples ────────────────────────────────────────────────────────────────────
// Every example comes from gen-home (the CLI's own output, validated there).

function examplesFor(format: Format): SpecPlaygroundExample[] {
  return examplesJson[format].map((entry) => ({
    id: entry.id,
    label: (copy.examples[format] as Record<string, string | undefined>)[entry.id] ?? entry.id,
    value: pretty(entry.value),
  }));
}

// ── The one enter-viewport gate: Monaco and the A2UI module both fetch behind it ────────────

/** Fires once `target` enters the viewport and stays true for good — no IntersectionObserver
 *  (SSR, or a browser without one) falls straight to "entered" instead of never firing. */
function useOnEnter(target: React.RefObject<HTMLElement | null>): boolean {
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    if (entered) return;
    const el = target.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setEntered(true);
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      setEntered(true);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [target, entered]);
  return entered;
}

// ── A2UI: the catalog schema, `A2uiSurface` and `validateA2uiSurface`, loaded on enter ──────

type A2uiModule = Pick<
  typeof AiModule,
  "A2UI_CATALOG_SCHEMA" | "A2uiSurface" | "validateA2uiSurface"
>;

/** Fetches `@elabs-ai/components-ai` once `entered` turns true, and keeps it (`entered` never
 *  goes back to false, so there is nothing to release). */
function useA2uiOnEnter(entered: boolean): A2uiModule | null {
  const [mod, setMod] = useState<A2uiModule | null>(null);
  useEffect(() => {
    if (!entered) return;
    let cancelled = false;
    import("@elabs-ai/components-ai").then((m) => {
      if (!cancelled) setMod(m);
    });
    return () => {
      cancelled = true;
    };
  }, [entered]);
  return mod;
}

/** The library's own validator, adapted to SpecPlayground's `{ ok, spec | errors }`. */
function makeValidateSurface(
  a2ui: A2uiModule,
): (json: unknown) => SpecPlaygroundValidation<A2uiSurfaceSpec> {
  return (json) => {
    const result = a2ui.validateA2uiSurface(json, a2ui.A2UI_CATALOG_SCHEMA);
    return result.ok ? { ok: true, spec: result.spec } : { ok: false, errors: result.errors };
  };
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

function useMonacoOnEnter(entered: boolean): EditorState {
  const [state, setState] = useState<EditorState>("textarea");
  useEffect(() => {
    if (!entered) return;
    setState("loading");
    let cancelled = false;
    preloadMonaco().then(
      () => !cancelled && setState("monaco"),
      // The textarea stays the editor (route-abort test, offline, blocked chunk).
      () => !cancelled && setState("textarea"),
    );
    return () => {
      cancelled = true;
    };
  }, [entered]);
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

/** `SpecPlayground`'s `render`, closed over the A2UI module once it has loaded. */
function makeRenderSurface(a2ui: A2uiModule): (spec: A2uiSurfaceSpec) => ReactNode {
  return (spec) => <a2ui.A2uiSurface surface={spec} onAction={onA2uiAction} />;
}

/** Same-size stand-in for `FormatPlayground` while the A2UI module is not yet loaded — mirrors
 *  `SpecPlayground`'s own two-column grid (source: toolbar + `min-h-80` editor; preview:
 *  unconstrained, given the same floor) so nothing jumps once the real playground mounts. */
function EmitUiSkeleton() {
  return (
    <div className="grid min-w-0 gap-4 lg:grid-cols-2" aria-hidden="true">
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="ms-auto h-8 w-28" />
        </div>
        <Skeleton className="h-80 min-h-80 w-full" />
      </div>
      <Skeleton className="h-80 min-h-80 w-full" />
    </div>
  );
}

// ── The section ──────────────────────────────────────────────────────────────────────────

function schemaHosts(group: "a2ui") {
  const usage = cli.verbGroups[group]?.find((verb) => verb.verb === "schema")?.usage ?? "";
  const npx = cli.localMcpCommand.replace(/ mcp$/, "");
  return [
    { id: "cli", label: copy.schemaHosts.cli, command: usage },
    { id: "npx", label: copy.schemaHosts.npx, command: usage.replace(/^brand-ui/, npx) },
  ];
}

function FormatHeader({ format, group }: { format: Format; group: "a2ui" }) {
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
  const entered = useOnEnter(sectionRef);
  const editor = useMonacoOnEnter(entered);
  const monaco = editor === "monaco";
  const a2ui = useA2uiOnEnter(entered);
  const playground = useMemo(
    () => (a2ui ? { validate: makeValidateSurface(a2ui), render: makeRenderSurface(a2ui) } : null),
    [a2ui],
  );

  return (
    <RevealOnEnter
      ref={sectionRef}
      as="section"
      id="emit-ui"
      aria-labelledby="emit-ui-heading"
      data-editor={editor}
      data-a2ui={playground ? "ready" : "loading"}
      className="mx-auto flex w-full max-w-7xl scroll-mt-24 flex-col gap-8 px-4 pb-24 sm:px-6"
    >
      <header className="flex max-w-3xl flex-col gap-3">
        <p className="text-eyebrow text-muted-foreground">{copy.eyebrow}</p>
        <Heading level={3} id="emit-ui-heading">
          {copy.heading}
        </Heading>
        <Text className="text-muted-foreground">{copy.lede}</Text>
      </header>
      {/* One format since 2026-09-22 (the dashboard pack is parked), so no tablist: a
          single-tab `Tabs` is a control a visitor cannot do anything with. */}
      <div className="flex min-w-0 flex-col gap-4">
        <FormatHeader format="a2ui" group="a2ui" />
        {playground ? (
          <FormatPlayground
            format="a2ui"
            monaco={monaco}
            validate={playground.validate}
            render={playground.render}
          />
        ) : (
          <EmitUiSkeleton />
        )}
      </div>
      <Toaster />
    </RevealOnEnter>
  );
}
