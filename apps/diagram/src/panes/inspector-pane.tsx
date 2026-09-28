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
  // "Diagram reference" (review round 0 F5/F7): "another diagram" (Ruling 9), never "Component".
  kind: { zone: "Zone", node: "Node", flow: "Flow", note: "Note", component: "Diagram reference" },
  // DG-26 — help text on a field a catalog reference supplies (1b.6).
  fromReference: "From the reference: ",
} as const;

/** A supplied value as help text (`badges`: joined; everything else is already a string). */
function describeSupplied(value: Supplied[keyof Supplied]): string | undefined {
  if (value === undefined) return undefined;
  return Array.isArray(value) ? value.join(", ") : String(value);
}

/**
 * DG-26 — each field in `inherited` gets the reference's value as its help text, replacing
 * the field's own description (the schema form renders `description` as help text,
 * schema-form.tsx). An inherited enum (e.g. `type`, which has its own default) also needs a
 * way back to "inherited" once the user has picked a value — the enum only gets a "Not set"
 * option on its own when it has no default (form-spec.ts toFieldSpec), so one is added here,
 * labelled with the reference's value (review round 1 F1). Fields not inherited are untouched.
 */
function withReferenceHelp(
  spec: ReturnType<typeof entryFormSpec>,
  supplied: Supplied | undefined,
  inherited: ReadonlySet<string>,
): ReturnType<typeof entryFormSpec> {
  if (!supplied || inherited.size === 0) return spec;
  return {
    ...spec,
    fields: spec.fields.map((field): FieldSpec => {
      const value = describeSupplied(supplied[field.name as keyof Supplied]);
      if (!inherited.has(field.name) || value === undefined) return field;
      const withHelp = { ...field, description: `${INSPECTOR_LABELS.fromReference}${value}` };
      if (withHelp.type !== "enum") return withHelp;
      const hasUnset = withHelp.options.some(
        (o) => (typeof o === "string" ? o : o.const) === UNSET,
      );
      if (hasUnset) return withHelp;
      return {
        ...withHelp,
        options: [
          { const: UNSET, title: `${INSPECTOR_LABELS.fromReference}${value}` },
          ...withHelp.options,
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
      omit: ["parent", "position"],
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
  const [seeded] = useState(() => {
    const values = entryFormValues(spec, def, written, inherited);
    return { values, spec: seedFormSpec(withReferenceHelp(spec, supplied, inherited), values) };
  });
  const last = useRef<FormValues>(seeded.values);

  const onChange = (next: FormValues) => {
    // A guard beside `disabled` below — the same shape as `document-controls.tsx`'s
    // `canUseHistory()` re-check in its own onClick — in case anything ever calls this handler
    // directly instead of through the disabled controls.
    if (disabled) return;
    const patch = entryFormPatch(def, last.current, next);
    last.current = next;
    if (Object.keys(patch).length === 0) return;
    if (editActions.editEntry(entry.id, patch)) onWrote(diagramStore.get().compiledText);
    else onRejected();
  };

  return (
    <SchemaFormProvider spec={seeded.spec} onChange={onChange} disabled={disabled}>
      {/* A native `<fieldset disabled>` on top of the form's own per-field `disabled` prop: it
          disables every descendant control at the DOM level regardless of the field type, so a
          gap in the schema form's own disabled wiring for one control kind can never leave a
          single field editable while the rest of the form is locked. */}
      <fieldset disabled={disabled} className="contents">
        <SchemaFormRoot aria-label={kindLabel(entry)}>
          <SchemaFormFields />
        </SchemaFormRoot>
      </fieldset>
    </SchemaFormProvider>
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
  const selectedId = useDiagram((s) => s.selectedId);
  const compiled = useDiagram((s) => s.compiled);
  const compiledText = useDiagram((s) => s.compiledText);
  // The inspector edits the TECHNICAL selection, hidden while the visual lens shows or the
  // switch to/from it is mid-flight — read the same `position !== 0` boundary
  // `canvas-pane.tsx`'s `technicalLensLocked` uses for every other technical write path, not
  // `target` (which flips the instant a switch starts, one whole tween ahead of the pane
  // actually becoming hidden), so the inspector's form goes read-only for exactly the same
  // window as the rest of the technical pane's writes, no earlier and no later.
  const lensLocked = useLens((s) => s.position !== 0 || s.target !== "technical");
  const raw = useMemo(() => parseArchYaml(compiledText).raw, [compiledText]);
  const entry = selectedId === null ? null : entryOf(compiled, selectedId);
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
      open={open}
      onOpenChange={editActions.setInspectorOpen}
      onClose={() => editActions.setInspectorOpen(false)}
      title={entry ? `${kindLabel(entry)} · ${entry.id}` : INSPECTOR_LABELS.title}
      hasSelection={entry !== null}
      selectionKey={selectedId ?? undefined}
      // P4: library gap — the empty message renders inside a <p>, so it takes text, not a
      // StatePanel. docs/findings/DG-14-inspector-write-back.md.
      emptyMessage={INSPECTOR_LABELS.empty}
      width={overlay ? "100%" : undefined}
      className={overlay ? OVERLAY_CLASS : undefined}
    >
      <div className="flex flex-col gap-4" onKeyDown={onKeyDown}>
        <Button
          variant="outline"
          size="sm"
          className="self-start"
          onClick={editActions.revealInEditor}
        >
          <FileCode aria-hidden="true" />
          {INSPECTOR_LABELS.showInYaml}
        </Button>
        {entry && entry.kind !== "note" ? (
          // `lensLocked` in the key: flipping the lock remounts the form fresh from `written`
          // (the file's own values), so a keystroke typed right at the lock boundary can never
          // leave the uncontrolled form's own DOM value out of step with what the file holds.
          <EntryForm
            key={`${entry.id}:${seed.n}:${catalogGen}:${lensLocked}`}
            entry={entry}
            written={writtenKeys(entry, raw)}
            onWrote={(text) => setSeed((s) => ({ n: s.n, text }))}
            onRejected={() => setSeed((s) => ({ n: s.n + 1, text: s.text }))}
            disabled={lensLocked}
          />
        ) : (
          <Text tone="muted">{INSPECTOR_LABELS.note}</Text>
        )}
      </div>
    </InspectorPanel>
  );
}
