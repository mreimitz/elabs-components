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
 * Loading: the A2UI renderer ships with the page (ai is a hero package). Monaco (`CodeEditor`)
 * is fetched only after the section enters the viewport, and only replaces `SpecPlayground`'s
 * built-in textarea once its chunks have arrived — until then, and for good if the import
 * fails, the textarea is the live editor.
 *
 * Test hook (RM-101 acceptance): `data-editor` on the section says which editor is live
 * (`textarea` / `monaco`).
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
import {
  CommandChip,
  Heading,
  RevealOnEnter,
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
      {/* One format since 2026-09-22 (the dashboard pack is parked), so no tablist: a
          single-tab `Tabs` is a control a visitor cannot do anything with. */}
      <div className="flex min-w-0 flex-col gap-4">
        <FormatHeader format="a2ui" group="a2ui" />
        <FormatPlayground
          format="a2ui"
          monaco={monaco}
          validate={validateSurface}
          render={renderSurface}
        />
      </div>
      <Toaster />
    </RevealOnEnter>
  );
}
