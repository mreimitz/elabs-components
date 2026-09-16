"use client";

/**
 * HappyPathEditor — draw the reference sequence conformance is checked against (RM-062).
 *
 * An editable `CanvasShell` (`@elabs-ai/components-flow`): each step is a
 * {@link HappyPathStepNode} (a `FlowNode` with the step's controls), consecutive steps are
 * chained by `FlowButtonEdge`s whose "+" inserts a step between them, and a
 * `FlowPlaceholderNode` at the tail appends one. Removing a step reconnects the chain,
 * because the chain is re-derived from the step list.
 *
 * ## Controlled, and stateless on purpose
 *
 * `value` in, a complete `HappyPath` out through `onChange` on every edit — insert,
 * remove, rename (per keystroke), toggle. The editor keeps no state `HappyPath` does not
 * already model, so a host can run `liftHappyPath` + `tokenReplay` on every change and
 * the canvas can never disagree with the model it drew.
 */
import { forwardRef, useCallback, useMemo, type HTMLAttributes } from "react";
import type { Edge } from "@xyflow/react";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import {
  CanvasShell,
  FlowButtonEdge,
  FlowEdge,
  FlowPlaceholderNode,
  type BrandFlowButtonEdge,
  type BrandFlowPlaceholderNode,
} from "@elabs-ai/components-flow";
import type { HappyPath, HappyPathStep } from "../core/reference-model";
import { fillLabel } from "../variant-explorer/variant-explorer-model";
import {
  HAPPY_PATH_EDITOR_DEFAULT_LABELS,
  HappyPathEditorContext,
  type HappyPathEditorContextValue,
  type HappyPathEditorLabels,
} from "./happy-path-editor-context";
import { HappyPathStepNode, type HappyPathStepFlowNode } from "./happy-path-step-node";

const NODE_TYPES = { "happy-path-step": HappyPathStepNode, placeholder: FlowPlaceholderNode };
const EDGE_TYPES = { button: FlowButtonEdge, tail: FlowEdge };

/** Vertical distance between consecutive steps, in flow units. */
const STEP_SPACING = 260;
/** Id of the tail placeholder node. */
const TAIL_ID = "happy-path-tail";

/** Id of the node for the step at `index`. */
export function happyPathStepNodeId(index: number): string {
  return `happy-path-step-${index}`;
}

/**
 * The activity a newly inserted step starts with: the first available activity the path
 * does not use yet, else the first available one, else empty (typed in afterwards).
 */
export function nextHappyPathActivity(
  path: HappyPath,
  availableActivities: readonly string[] | undefined,
): string {
  if (!availableActivities || availableActivities.length === 0) return "";
  const used = new Set(path.steps.map((step) => step.activity));
  return availableActivities.find((activity) => !used.has(activity)) ?? availableActivities[0]!;
}

/** `path` with a new step inserted at `index`. */
export function insertHappyPathStep(
  path: HappyPath,
  index: number,
  step: HappyPathStep,
): HappyPath {
  const steps = [...path.steps];
  steps.splice(index, 0, step);
  return { ...path, steps };
}

/** `path` without the step at `index`. The neighbours become consecutive. */
export function removeHappyPathStep(path: HappyPath, index: number): HappyPath {
  return { ...path, steps: path.steps.filter((_, i) => i !== index) };
}

/** `path` with the step at `index` patched. `false` flags are dropped, not stored. */
export function updateHappyPathStep(
  path: HappyPath,
  index: number,
  patch: Partial<HappyPathStep>,
): HappyPath {
  return {
    ...path,
    steps: path.steps.map((step, i) => {
      if (i !== index) return step;
      const next: HappyPathStep = { ...step, ...patch };
      if (!next.optional) delete next.optional;
      if (!next.repeatable) delete next.repeatable;
      return next;
    }),
  };
}

/** Props for {@link HappyPathEditor}. `onChange` carries a path, so the DOM one is omitted. */
export interface HappyPathEditorProps extends Omit<HTMLAttributes<HTMLDivElement>, "onChange"> {
  value: HappyPath;
  /** Fires with the complete path after every edit. */
  onChange: (path: HappyPath) => void;
  /** Activities a step may pick from (e.g. the log's). Omit for free-text activities. */
  availableActivities?: string[];
  /** Override any user-visible string. */
  labels?: Partial<HappyPathEditorLabels>;
}

type EditorNode = HappyPathStepFlowNode | BrandFlowPlaceholderNode;
type EditorEdge = BrandFlowButtonEdge | Edge;

/**
 * The happy-path editor.
 *
 * @example
 * ```tsx
 * const [path, setPath] = useState<HappyPath>({ id: "p", label: "Order", steps: [] });
 * const conformance = useMemo(() => tokenReplay(log, liftHappyPath(path)), [log, path]);
 * <HappyPathEditor value={path} onChange={setPath} availableActivities={activities} />
 * ```
 */
export const HappyPathEditor = forwardRef<HTMLDivElement, HappyPathEditorProps>(
  function HappyPathEditor(
    { value, onChange, availableActivities, labels: labelOverrides, className, ...props },
    ref,
  ) {
    const labels = useMemo<HappyPathEditorLabels>(
      () => ({ ...HAPPY_PATH_EDITOR_DEFAULT_LABELS, ...labelOverrides }),
      [labelOverrides],
    );

    const insertAt = useCallback(
      (index: number) =>
        onChange(
          insertHappyPathStep(value, index, {
            activity: nextHappyPathActivity(value, availableActivities),
          }),
        ),
      [value, onChange, availableActivities],
    );

    const context = useMemo<HappyPathEditorContextValue>(
      () => ({
        labels,
        availableActivities,
        updateStep: (index, patch) => onChange(updateHappyPathStep(value, index, patch)),
        removeStep: (index) => onChange(removeHappyPathStep(value, index)),
      }),
      [labels, availableActivities, value, onChange],
    );

    const nodes = useMemo<EditorNode[]>(() => {
      const stepNodes: EditorNode[] = value.steps.map((step, index) => {
        const flags = [
          step.optional ? labels.optional.toLowerCase() : null,
          step.repeatable ? labels.repeatable.toLowerCase() : null,
        ].filter(Boolean);
        return {
          id: happyPathStepNodeId(index),
          type: "happy-path-step",
          position: { x: 0, y: index * STEP_SPACING },
          data: { index, step },
          draggable: false,
          ariaLabel: fillLabel(labels.stepName, {
            n: index + 1,
            activity: step.activity || labels.untitled,
            flags: flags.length > 0 ? `, ${flags.join(", ")}` : "",
          }),
        };
      });
      stepNodes.push({
        id: TAIL_ID,
        type: "placeholder",
        position: { x: 0, y: value.steps.length * STEP_SPACING },
        data: { label: labels.addStep, onActivate: () => insertAt(value.steps.length) },
        draggable: false,
      });
      return stepNodes;
    }, [value.steps, labels, insertAt]);

    const edges = useMemo<EditorEdge[]>(() => {
      const chain: EditorEdge[] = [];
      value.steps.forEach((step, index) => {
        const next = value.steps[index + 1];
        if (next) {
          chain.push({
            id: `${happyPathStepNodeId(index)}->${happyPathStepNodeId(index + 1)}`,
            source: happyPathStepNodeId(index),
            target: happyPathStepNodeId(index + 1),
            type: "button",
            data: {
              label: fillLabel(labels.insertStep, {
                before: step.activity || labels.untitled,
                after: next.activity || labels.untitled,
              }),
              onInsert: () => insertAt(index + 1),
            },
          });
        } else {
          chain.push({
            id: `${happyPathStepNodeId(index)}->${TAIL_ID}`,
            source: happyPathStepNodeId(index),
            target: TAIL_ID,
            type: "tail",
          });
        }
      });
      return chain;
    }, [value.steps, labels, insertAt]);

    return (
      <div
        ref={ref}
        data-slot="happy-path-editor"
        data-steps={value.steps.length}
        className={cn("relative size-full min-h-80", className)}
        {...props}
      >
        <HappyPathEditorContext value={context}>
          <CanvasShell<EditorNode, EditorEdge>
            nodes={nodes}
            edges={edges}
            nodeTypes={NODE_TYPES}
            edgeTypes={EDGE_TYPES}
            nodesDraggable={false}
            nodesConnectable={false}
            edgesFocusable={false}
            deleteKeyCode={null}
            fitView
            fitViewKey={value.steps.length}
            aria-label={fillLabel(labels.canvas, { path: value.label })}
          />
        </HappyPathEditorContext>
      </div>
    );
  },
);
