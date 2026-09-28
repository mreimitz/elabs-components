import { useCompositePreview } from "../interaction/composite-state";
import { COMPOSITE_UI } from "../interaction/composite-actions";
import { ReadonlyNodeDetails } from "../interaction/readonly-node-details";
import { openDoc } from "../shell/mode-store";
import { useRoute } from "../routes/use-hash";
import { useMemo, useRef, useState, useSyncExternalStore, type KeyboardEvent } from "react";
import { InspectorPanel } from "@elabs-ai/components-flow";
import {
  Button,
  SchemaFormFields,
  SchemaFormProvider,
  SchemaFormRoot,
  Text,
  type FieldSpec,
  type FormValues,
} from "@elabs-ai/components-ui";
import { FileCode } from "lucide-react";
import { catalogVersion, currentCatalog, onCatalogChange } from "../catalog/catalog-bundle"; // DG-26
import { suppliedBy, type Supplied } from "../spec/dialect/catalog-refs"; // DG-26
import { FLOW_DEF, NODE_DEF, ZONE_DEF } from "../spec/dialect/definitions";
import { SUPPLIED_KEYS } from "../spec/dialect/types"; // DG-26
import {
  entryFormPatch,
  entryFormSpec,
  entryFormValues,
  seedFormSpec,
  UNSET,
  type EntryFormOptions,
} from "../spec/dialect/form-spec";
import { refForm } from "../spec/dialect/ids"; // DG-26
import { parseArchYaml } from "../spec/dialect/parse";
import { valueAt } from "../spec/dialect/write-back";
import { diagramStore, editActions, useDiagram } from "../state/diagram-store";
import { entryOf, type DiagramEntry } from "../state/entries";
import { focusCanvasElement } from "./focus-canvas";
import { useLens } from "../shell/lens-store"; // maintainer 2026-09-27 (lens switch)

/** The inspector's strings, in one place (`conventions/i18n-strings`). */
const INSPECTOR_LABELS = {
  title: "Inspector",
  empty: "Select a zone, node or flow on the canvas or in the YAML.",
  note: "Notes are edited in the YAML.",
  showInYaml: "Show in YAML",
  advanced: "Advanced",
  unset: "Not set",
  // A workspace ref points to another diagram.
  kind: { zone: "Zone", node: "Node", flow: "Flow", note: "Note", component: "Diagram reference" },
  // DG-26 — help text on a field a catalog reference supplies (1b.6).
  fromReference: "From the reference: ",
  // A field written blank on purpose (entryFormPatch) says what the reference would show instead.
  clearedFromReference: "Cleared; the reference would show: ",
  restoreSubtitle: "Use reference subtitle",
  clearSubtitle: "Clear subtitle",
  openDiagram: "Open diagram",
  readOnly: (id: string) => `Read-only · ${id}`,
} as const;

/** A supplied value as help text (`badges`: joined; everything else is already a string). */
function describeSupplied(value: Supplied[keyof Supplied]): string | undefined {
  if (value === undefined) return undefined;
  return Array.isArray(value) ? value.join(", ") : String(value);
}

/** Reference defaults remain visible and restorable while the uncontrolled form stays mounted. */
function withReferenceHelp(
  spec: ReturnType<typeof entryFormSpec>,
  supplied: Supplied | undefined,
  inherited: ReadonlySet<string>,
  values: FormValues,
): ReturnType<typeof entryFormSpec> {
  if (!supplied) return spec;
  return {
    ...spec,
    fields: spec.fields.map((field): FieldSpec => {
      const value = describeSupplied(supplied[field.name as keyof Supplied]);
      if (value === undefined) return field;
      if (field.type !== "enum") {
        if (inherited.has(field.name)) {
          return { ...field, description: `${INSPECTOR_LABELS.fromReference}${value}` };
        }
        if (values[field.name] === "") {
          return { ...field, description: `${INSPECTOR_LABELS.clearedFromReference}${value}` };
        }
        return field;
      }
      const hasUnset = field.options.some((o) => (typeof o === "string" ? o : o.const) === UNSET);
      if (hasUnset) return { ...field, description: `${INSPECTOR_LABELS.fromReference}${value}` };
      return {
        ...field,
        options: [
          { const: UNSET, title: `${INSPECTOR_LABELS.fromReference}${value}` },
          ...field.options,
        ],
      };
    }),
  };
}

// DG-26 — a node whose ref names a diagram is labelled "Diagram reference"; its form is the
// node form (Ref under the essential fields, Expand, Docs and Status under Advanced).
function kindLabel(entry: DiagramEntry): string {
  return INSPECTOR_LABELS.kind[
    entry.kind === "node" && entry.node.ref !== undefined && refForm(entry.node.ref) === "diagram"
      ? "component"
      : entry.kind
  ];
}
// end DG-26

const COMMON: Pick<EntryFormOptions, "advancedLabel" | "unsetLabel"> = {
  advancedLabel: INSPECTOR_LABELS.advanced,
  unsetLabel: INSPECTOR_LABELS.unset,
};

/**
 * One form per entity, from the dialect definitions (the validator's and the JSON Schema's
 * source). Structure the canvas owns — `children`, `parent`, `position` (DG-15) and a flow's
 * `direction` (its arrow) — is not a form field.
 */
const FORMS = {
  zone: {
    def: ZONE_DEF,
    spec: entryFormSpec(ZONE_DEF, {
      ...COMMON,
      omit: ["children", "parent", "position"],
      readOnly: ["id"],
      multiline: ["description"],
    }),
  },
  node: {
    def: NODE_DEF,
    spec: entryFormSpec(NODE_DEF, {
      ...COMMON,
      omit: ["parent", "position", "expand"],
      readOnly: ["id"],
      multiline: ["description", "text"],
    }),
  },
  flow: {
    def: FLOW_DEF,
    spec: entryFormSpec(FLOW_DEF, { ...COMMON, omit: ["direction"], readOnly: ["from", "to"] }),
  },
} as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

/** The keys written in the text for an entry (a flow's shorthand forms included). */
function writtenKeys(entry: DiagramEntry, raw: unknown): Record<string, unknown> {
  const value = valueAt(raw, entry.path);
  if (entry.kind !== "flow") return isRecord(value) ? value : {};
  const ends = { from: entry.flow.from, to: entry.flow.to };
  if (entry.flow.form === "object") return { ...(isRecord(value) ? value : {}), ...ends };
  const inner = isRecord(value) ? Object.values(value)[0] : undefined;
  if (isRecord(inner)) return { ...inner, ...ends };
  return typeof inner === "string" ? { label: inner, ...ends } : ends;
}

interface EntryFormProps {
  entry: DiagramEntry & { kind: "zone" | "node" | "flow" };
  written: Record<string, unknown>;
  /** The inspector wrote this compiled text (so it is not a change to re-seed from). */
  onWrote: (text: string) => void;
  /** The edit could not be written exactly: re-seed from the text. */
  onRejected: () => void;
  /** The visual lens is showing or mid-transition — the technical selection this form edits is
   * hidden, so it is a durable, natively disabled read-only surface (every control disabled,
   * not just visually dimmed) for exactly the window `canvas-pane.tsx`'s `technicalLensLocked`
   * closes every other technical write path for (`position !== 0`). */
  disabled: boolean;
}

/**
 * One entry's form, seeded from the text when it mounts. Uncontrolled on purpose.
 * P4: library gap — SchemaFormProvider in controlled mode drops every other keystroke under
 * React 19 StrictMode (measured): it detects new `values` by comparing props inside render,
 * the second StrictMode render sees no change, and the memoized field keeps the old value.
 * docs/findings/DG-14-inspector-write-back.md. The inspector re-mounts this form (a new
 * `key`) whenever the text changes from anywhere else.
 */
function EntryForm({ entry, written, onWrote, onRejected, disabled }: EntryFormProps) {
  const { def, spec } = FORMS[entry.kind];
  // DG-26 — what the node's catalog reference supplies; nothing while the entry is unknown, a
  // custom node, or a diagram reference (Part 2 fills those).
  const catalog = currentCatalog();
  const found =
    entry.kind === "node" && entry.node.catalogEntry !== undefined
      ? catalog.get(entry.node.catalogEntry)
      : undefined;
  const supplied = found ? suppliedBy(found, catalog) : undefined;
  const inherited = new Set(
    (entry.kind === "node" ? (entry.node.unwritten ?? []) : []).filter(
      (key) => supplied?.[key] !== undefined,
    ),
  );
  // The SUPPLIED_KEYS the reference currently supplies a value for, written or not — the set
  // `entryFormPatch` writes an explicit blank to instead of removing the key, so the reference's
  // value cannot come back by surprise.
  const referenceSupplied = new Set(SUPPLIED_KEYS.filter((key) => supplied?.[key] !== undefined));
  const [seeded] = useState(() => {
    const values = entryFormValues(spec, def, written, inherited);
    return { values };
  });
  const last = useRef<FormValues>(seeded.values);
  // Update metadata from the current compiled entry without replacing controls or their
  // uncontrolled values. In particular, Radix's portaled menus must retain focus while open.
  const liveSpec = seedFormSpec(
    withReferenceHelp(spec, supplied, inherited, last.current),
    seeded.values,
  );

  const onChange = (next: FormValues) => {
    if (disabled) return;
    const patch = entryFormPatch(def, last.current, next, referenceSupplied);
    last.current = next;
    if (Object.keys(patch).length === 0) return;
    if (editActions.editEntry(entry.id, patch)) onWrote(diagramStore.get().compiledText);
    else onRejected();
  };

  return (
    <SchemaFormProvider spec={liveSpec} onChange={onChange} disabled={disabled}>
      <fieldset disabled={disabled} className="contents">
        <SchemaFormRoot aria-label={kindLabel(entry)}>
          <SchemaFormFields />
        </SchemaFormRoot>
      </fieldset>
    </SchemaFormProvider>
  );
}

/** Keep this action outside the keyed form: re-seeding fields must not remove keyboard
 * focus and hand the next Backspace to the canvas's document-level delete listener. */
function ReferenceSubtitleAction({ entry, disabled }: { entry: DiagramEntry; disabled: boolean }) {
  const catalog = currentCatalog();
  const found =
    entry.kind === "node" && entry.node.catalogEntry !== undefined
      ? catalog.get(entry.node.catalogEntry)
      : undefined;
  if (!found || suppliedBy(found, catalog).subtitle === undefined || entry.kind !== "node")
    return null;
  const inherited = entry.node.unwritten?.includes("subtitle") ?? false;
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={disabled}
      onClick={() => {
        if (disabled) return;
        // This is external to EntryForm: the inspector's compiled-text comparison re-seeds
        // its uncontrolled inputs while this button stays mounted and focused.
        editActions.editEntry(entry.id, { subtitle: inherited ? "" : undefined });
      }}
    >
      {inherited ? INSPECTOR_LABELS.clearSubtitle : INSPECTOR_LABELS.restoreSubtitle}
    </Button>
  );
}

export interface InspectorPaneProps {
  /**
   * Phones: the open inspector covers the canvas (at 390 px, 18rem beside it left the canvas
   * 102 px wide), and Esc in the form closes it as it hands focus back.
   */
  overlay: boolean;
}

/** Over the canvas while open; closed, the canvas under it takes the pointer again. */
const OVERLAY_CLASS = "absolute inset-0 z-10 data-[state=collapsed]:pointer-events-none";

/**
 * DG-14 — the inspector beside the canvas: the selection's fields as a ui SchemaForm.
 * Every change is a text edit (write-back.ts), so the YAML stays the source of truth and
 * the editor shows the change at once. Esc inside the form returns focus to the canvas.
 */
export function InspectorPane({ overlay }: InspectorPaneProps) {
  const open = useDiagram((s) => s.inspectorOpen);
  const route = useRoute();
  const preview = useCompositePreview();
  const selectedId = useDiagram((s) => s.selectedId);
  const compiled = useDiagram((s) => s.compiled);
  const compiledText = useDiagram((s) => s.compiledText);
  // Lock immediately on a visual target and through the final frame of a return transition.
  const lensLocked = useLens((s) => s.position !== 0 || s.target !== "technical");
  const raw = useMemo(() => parseArchYaml(compiledText).raw, [compiledText]);
  const entry = selectedId === null ? null : entryOf(compiled, selectedId);
  const matching = preview.path === diagramStore.get().path;
  const shownNode = matching
    ? preview.graph?.nodes.find((node) => node.id === selectedId)
    : undefined;
  const inner = matching && selectedId ? preview.view?.inner?.[selectedId] : undefined;
  const component = typeof shownNode?.data.component === "string";
  const componentReason =
    compiled.spec?.layout.engine === "none"
      ? COMPOSITE_UI.manual
      : shownNode?.data.broken || shownNode?.data.pending
        ? COMPOSITE_UI.unavailable
        : undefined;
  const disabled = lensLocked || (route.kind === "doc" && Boolean(route.into?.length));
  // DG-26 — a catalog change that lands after the form seeded (recompile() keeps the text, so
  // `compiledText` alone would miss it) also re-mounts the form, so inherited help text follows.
  const catalogGen = useSyncExternalStore(onCatalogChange, catalogVersion);

  // The form re-seeds when the text changes from anywhere but the form itself (the editor,
  // a canvas delete, undo): `seed.text` follows the form's own writes, so any other text
  // bumps `seed.n` and re-mounts the form. Derived state, set during render (React docs).
  const [seed, setSeed] = useState({ n: 0, text: compiledText });
  if (compiledText !== seed.text) setSeed({ n: seed.n + 1, text: compiledText });

  // Esc from a field → the canvas element. Radix Select/Popover content is portaled outside
  // this subtree and closes itself on Esc; only an Esc that starts in the form counts.
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Escape" || event.defaultPrevented) return;
    if (!(event.target instanceof Node) || !event.currentTarget.contains(event.target)) return;
    event.preventDefault();
    if (overlay) editActions.setInspectorOpen(false);
    focusCanvasElement(selectedId);
  };

  return (
    <InspectorPanel
      open={open && (!overlay || selectedId !== null)}
      onOpenChange={editActions.setInspectorOpen}
      onClose={() => editActions.setInspectorOpen(false)}
      title={
        inner
          ? INSPECTOR_LABELS.readOnly(inner.id)
          : entry
            ? `${kindLabel(entry)} · ${entry.id}`
            : INSPECTOR_LABELS.title
      }
      hasSelection={entry !== null || Boolean(inner)}
      selectionKey={selectedId ?? undefined}
      // P4: library gap — the empty message renders inside a <p>, so it takes text, not a
      // StatePanel. docs/findings/DG-14-inspector-write-back.md.
      emptyMessage={INSPECTOR_LABELS.empty}
      width={overlay ? "100%" : undefined}
      className={overlay ? OVERLAY_CLASS : undefined}
    >
      <div className="flex flex-col gap-4" onKeyDown={onKeyDown}>
        {inner ? (
          <>
            {shownNode ? <ReadonlyNodeDetails node={shownNode} /> : <Text>{inner.id}</Text>}
            <Button
              variant="outline"
              size="sm"
              onClick={() => openDoc(inner.component, { mode: "edit" })}
            >
              {INSPECTOR_LABELS.openDiagram}
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="outline"
              size="sm"
              className="self-start"
              onClick={editActions.revealInEditor}
            >
              <FileCode aria-hidden="true" />
              {INSPECTOR_LABELS.showInYaml}
            </Button>
            {component && shownNode ? (
              <div className="flex flex-col gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={disabled || Boolean(componentReason)}
                  onClick={() => preview.toggle?.(shownNode.id)}
                  aria-expanded={shownNode.type === "arch/zone"}
                >
                  {shownNode.type === "arch/zone"
                    ? COMPOSITE_UI.collapse(String(shownNode.data.title))
                    : COMPOSITE_UI.expand(String(shownNode.data.title))}
                </Button>
                {componentReason ? (
                  <Text variant="meta" tone="muted">
                    {componentReason}
                  </Text>
                ) : null}
              </div>
            ) : null}
            {entry && entry.kind !== "note" ? (
              <>
                <EntryForm
                  key={`${entry.id}:${seed.n}:${catalogGen}:${lensLocked}`}
                  disabled={disabled}
                  entry={entry}
                  written={writtenKeys(entry, raw)}
                  onWrote={(text) => setSeed((s) => ({ n: s.n, text }))}
                  onRejected={() => setSeed((s) => ({ n: s.n + 1, text: s.text }))}
                />
                <ReferenceSubtitleAction entry={entry} disabled={disabled} />
              </>
            ) : (
              <Text tone="muted">{INSPECTOR_LABELS.note}</Text>
            )}
          </>
        )}
      </div>
    </InspectorPanel>
  );
}
