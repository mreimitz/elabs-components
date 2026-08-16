"use client";

/**
 * IterationBuilderDialog (A5) — GUIDED `:::iterate` / `:::pivot` authoring.
 *
 * Where `IterationTemplateDialog` edits only the per-cell template, the builder
 * also collects the DATA — the value list (iterate) or the two value lists
 * (pivot), the bind name, and the layout — and shows a LIVE preview of the
 * populated block as you type. On save it writes a fully-bound directive
 * (`serializeIterationDirective`) whose value lists live in its attributes, so the
 * block renders populated via the built-in `evaluateEmbedded` and the `⋯` re-edit
 * can reopen it losslessly (`parseIterationDirective` / `builderValueFromParts`).
 *
 * Controlled (`open` / `onOpenChange`); seed via `value` (re-edit) or `kind` +
 * `initialValues` (fresh insert, e.g. a selection split to one value per line).
 */
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  TagInput,
  ToggleGroup,
  ToggleGroupItem,
} from "@elabs/components-ui";
import { useEffect, useId, useMemo, useState, type ReactNode } from "react";

import { type EvaluateCalc } from "../calc-block";
import { MarkdownPreview } from "../markdown-preview";
import { MarkdownWorkspace } from "../markdown-workspace";
import { IterationEditContext, type IterationEditRequest } from "./edit-context";
import { type InterpolateTemplate, type IterationLayout } from "./iteration";
import {
  builderValueFromParts,
  directivePartsFromValue,
  emptyBuilderValue,
  evaluateEmbedded,
  ITERATION_LAYOUTS,
  parseIterationDirective,
  serializeIterationDirective,
  type IterationBuilderValue,
} from "./iteration-builder";

export interface IterationBuilderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Which block to author. Default `"iterate"`. Ignored when `value` is set. */
  kind?: "iterate" | "pivot";
  /** Seed the whole builder (the `⋯` re-edit path). */
  value?: IterationBuilderValue;
  /** Seed the value list of a fresh block (e.g. a selection split to lines). */
  initialValues?: string[];
  /** Receives the fully-bound directive markdown when the user saves. */
  onSave: (directiveMarkdown: string) => void;
  /**
   * Resolve a ```calc fence to a `CalcSheet` so calc cells COMPUTE in the live
   * preview (the same hook `MarkdownPreview` takes — the library renders, the app
   * computes). Without it a calc cell still renders as a code block; with it, the
   * preview matches production. Pass your app's calc engine.
   */
  evaluate?: EvaluateCalc;
  /** Fill a cell template with its context. Defaults to `{{path}}` substitution. */
  interpolate?: InterpolateTemplate;
}

export function IterationBuilderDialog({
  open,
  onOpenChange,
  kind: kindProp = "iterate",
  value,
  initialValues,
  onSave,
  evaluate,
  interpolate,
}: IterationBuilderDialogProps) {
  const kind = value?.kind ?? kindProp;
  const isPivot = kind === "pivot";
  const ids = useId();

  // Working draft. Value lists are arrays (chip entry via TagInput); the per-cell
  // template stays raw text.
  const [asName, setAsName] = useState("item");
  const [layout, setLayout] = useState<IterationLayout>(ITERATION_LAYOUTS[kind][0] ?? "stacked");
  const [values, setValues] = useState<string[]>([]);
  const [cols, setCols] = useState<string[]>([]);
  const [template, setTemplate] = useState("");

  // (Re)seed whenever the dialog opens against a new value / kind.
  useEffect(() => {
    if (!open) return;
    const seed = value ?? {
      ...emptyBuilderValue(kind),
      values: initialValues ?? [],
    };
    setAsName(seed.as);
    setLayout(seed.layout);
    setValues(seed.values);
    setCols(seed.cols ?? []);
    setTemplate(seed.template);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const draft: IterationBuilderValue = useMemo(
    () => ({
      kind,
      as: asName.trim() || "item",
      layout,
      values,
      cols: isPivot ? cols : undefined,
      template,
    }),
    [kind, asName, layout, values, cols, template, isPivot],
  );

  // Live preview — render the SERIALIZED directive through MarkdownPreview, the
  // exact path the saved block renders through. That resolves the iteration via
  // the built-in `evaluateEmbedded` AND each cell's objects (a ```calc fence,
  // nested directives, formatting) — in stacked, grid and matrix alike — instead
  // of dumping the raw cell text.
  const previewMarkdown = useMemo(() => serializeIterationDirective(draft), [draft]);

  const save = () => {
    onSave(serializeIterationDirective(draft));
    onOpenChange(false);
  };

  const noun = isPivot ? "pivot" : "iteration";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[88vh] w-[min(56rem,94vw)] max-w-none flex-col">
        <DialogHeader>
          <DialogTitle>
            {value ? "Edit" : "Insert"} {noun}
          </DialogTitle>
          <DialogDescription>
            {isPivot
              ? "Pick the row and column values, then write the per-cell template. The matrix below fills in live."
              : "Add the list values, then write the per-row template. The result below fills in live."}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="grid gap-4 md:grid-cols-2">
          {/* Left column — the DATA the block iterates over. */}
          <div className="flex min-w-0 flex-col gap-4">
            {!isPivot ? (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`${ids}-as`}>Bind name</Label>
                <Input
                  id={`${ids}-as`}
                  value={asName}
                  spellCheck={false}
                  autoComplete="off"
                  placeholder="item"
                  onChange={(e) => setAsName(e.target.value)}
                />
                <p className="text-meta text-muted-foreground">
                  Use <code>{`{{${asName.trim() || "item"}.name}}`}</code> in the template.
                </p>
              </div>
            ) : null}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${ids}-values`}>{isPivot ? "Row values" : "Values"}</Label>
              <TagInput
                id={`${ids}-values`}
                value={values}
                onValueChange={setValues}
                delimiter={[",", "\n"]}
                placeholder="Type a value, press Enter…"
              />
            </div>

            {isPivot ? (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`${ids}-cols`}>Column values</Label>
                <TagInput
                  id={`${ids}-cols`}
                  value={cols}
                  onValueChange={setCols}
                  delimiter={[",", "\n"]}
                  placeholder="Type a value, press Enter…"
                />
              </div>
            ) : null}

            <div className="flex flex-col gap-1.5">
              <Label id={`${ids}-layout`}>Layout</Label>
              <ToggleGroup
                type="single"
                variant="segmented"
                value={layout}
                onValueChange={(next) => {
                  // Single-select: ignore the empty value Radix emits when the active
                  // item is re-pressed, so a layout is always selected.
                  if (next) setLayout(next as IterationLayout);
                }}
                aria-labelledby={`${ids}-layout`}
                className="w-fit"
              >
                {ITERATION_LAYOUTS[kind].map((l) => (
                  <ToggleGroupItem key={l} value={l} className="capitalize">
                    {l}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
          </div>

          {/* Right column — the per-cell TEMPLATE + the live populated preview. */}
          <div className="flex min-h-0 min-w-0 flex-col gap-4">
            <div className="flex min-h-0 flex-col gap-1.5">
              <Label>Per-{isPivot ? "cell" : "row"} template</Label>
              <div className="h-44 min-h-0 overflow-hidden rounded-md border border-border">
                <MarkdownWorkspace
                  value={template}
                  onChange={setTemplate}
                  defaultMode="source"
                  className="h-full"
                  aria-label="Per-cell template"
                />
              </div>
            </div>

            <div className="flex min-h-0 flex-col gap-1.5">
              <Label>Live preview</Label>
              <div
                role="region"
                aria-label="Live preview"
                className="min-h-0 flex-1 overflow-auto rounded-md border border-border bg-card p-3"
              >
                <MarkdownPreview
                  evaluateIteration={evaluateEmbedded}
                  evaluate={evaluate}
                  interpolate={interpolate}
                >
                  {previewMarkdown}
                </MarkdownPreview>
              </div>
            </div>
          </div>
        </DialogBody>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save}>{value ? "Save" : "Insert"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * One-liner wiring for the node-view `⋯` re-edit using the GUIDED builder (A5).
 * Drop it above a `MarkdownEditor` / `MarkdownWorkspace` to make the `⋯` on a
 * `:::iterate` / `:::pivot` reopen the full builder seeded with the block's DATA
 * (value lists + bind name + layout) and template, writing both back losslessly.
 *
 * Prefer this over {@link IterationTemplateProvider} when the consumer authors
 * blocks with embedded value lists (the builder flow); the template-only provider
 * remains for the lighter "edit just the template" affordance.
 */
export function IterationBuilderProvider({
  children,
  evaluate,
  interpolate,
}: {
  children: ReactNode;
  /** Forwarded to the builder's live preview so calc cells COMPUTE on re-edit. */
  evaluate?: EvaluateCalc;
  /** Forwarded to the builder's live preview cell interpolation. */
  interpolate?: InterpolateTemplate;
}) {
  const [request, setRequest] = useState<IterationEditRequest | null>(null);

  const seed = request
    ? builderValueFromParts(request.kind, request.attributes ?? {}, request.template)
    : undefined;

  return (
    <IterationEditContext.Provider value={setRequest}>
      {children}
      <IterationBuilderDialog
        open={request != null}
        onOpenChange={(next) => {
          if (!next) setRequest(null);
        }}
        kind={request?.kind ?? "iterate"}
        value={seed}
        evaluate={evaluate}
        interpolate={interpolate}
        onSave={(directiveMarkdown) => {
          const parsed = parseIterationDirective(directiveMarkdown);
          if (!parsed) return;
          const { attributes, template } = directivePartsFromValue(parsed);
          // Prefer the data-aware writer (rewrites attributes + body); fall back to
          // the template-only writer for older node-views.
          if (request?.onSaveData) request.onSaveData({ attributes, template });
          else request?.onSave(template);
        }}
      />
    </IterationEditContext.Provider>
  );
}
