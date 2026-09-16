"use client";

/**
 * HappyPathStepNode — one prescribed step on the happy-path canvas (RM-062).
 *
 * Composes `@elabs-ai/components-flow`'s `FlowNode` (frame, handles, focus treatment) and
 * puts the step's controls in its `footer` slot: the activity (a `Select` over
 * `availableActivities`, or free text), the `optional`/`repeatable` `Switch`es that map
 * one-to-one onto `HappyPathStep`, and a remove button. It holds no state — every control
 * writes straight back through the editor context.
 *
 * A repeatable step shows a repeat glyph and an optional one a skip glyph beside its
 * title, and both words join the node's accessible name, so neither flag is carried by a
 * switch position alone.
 */
import { useId, useMemo } from "react";
import { Redo2, Repeat, Trash2 } from "lucide-react";
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from "@elabs-ai/components-ui";
import { FlowNode, type FlowNodeData } from "@elabs-ai/components-flow";
import type { Node, NodeProps } from "@xyflow/react";
import type { HappyPathStep } from "../core/reference-model";
import { fillLabel } from "../variant-explorer/variant-explorer-model";
import { useHappyPathEditor } from "./happy-path-editor-context";

/** `data` carried by a {@link HappyPathStepFlowNode}. */
export interface HappyPathStepNodeData extends Record<string, unknown> {
  /** Zero-based position in the path. */
  index: number;
  step: HappyPathStep;
}

/** A happy-path step node. Register as `nodeTypes={{ "happy-path-step": … }}`. */
export type HappyPathStepFlowNode = Node<HappyPathStepNodeData, "happy-path-step">;

/** One step of the happy-path editor. */
export function HappyPathStepNode(props: NodeProps<HappyPathStepFlowNode>) {
  const { index, step } = props.data;
  const { labels, availableActivities, updateStep, removeStep } = useHappyPathEditor();
  const optionalId = useId();
  const repeatableId = useId();
  const n = index + 1;
  const activityName = step.activity || labels.untitled;

  const options = useMemo(() => {
    if (!availableActivities) return undefined;
    return step.activity && !availableActivities.includes(step.activity)
      ? [step.activity, ...availableActivities]
      : [...availableActivities];
  }, [availableActivities, step.activity]);

  const flowData = useMemo<FlowNodeData>(
    () => ({
      title: activityName,
      kind: fillLabel(labels.step, { n }),
      icon:
        step.repeatable || step.optional ? (
          <span className="flex items-center gap-0.5">
            {step.optional ? <Redo2 aria-hidden="true" /> : null}
            {step.repeatable ? <Repeat aria-hidden="true" /> : null}
          </span>
        ) : undefined,
      footer: (
        <div
          data-slot="happy-path-step-node-controls"
          // `nodrag nopan`: typing, toggling and clicking here must never pan the canvas
          // or start a node drag.
          className="nodrag nopan flex flex-col gap-2"
        >
          {options ? (
            <Select
              value={step.activity || undefined}
              onValueChange={(activity) => updateStep(index, { activity })}
            >
              <SelectTrigger
                size="sm"
                aria-label={fillLabel(labels.activity, { n })}
                data-slot="happy-path-step-node-activity"
                className="w-full"
              >
                <SelectValue placeholder={labels.activityPlaceholder} />
              </SelectTrigger>
              <SelectContent>
                {options.map((activity) => (
                  <SelectItem key={activity} value={activity}>
                    {activity}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              value={step.activity}
              onChange={(event) => updateStep(index, { activity: event.target.value })}
              aria-label={fillLabel(labels.activity, { n })}
              placeholder={labels.activityPlaceholder}
              data-slot="happy-path-step-node-activity"
              className="h-control-sm"
            />
          )}
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor={optionalId} className="text-caption">
              {labels.optional}
            </Label>
            <Switch
              id={optionalId}
              data-slot="happy-path-step-node-optional"
              aria-label={fillLabel(labels.optionalFor, { activity: activityName })}
              checked={step.optional === true}
              onCheckedChange={(optional) => updateStep(index, { optional })}
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor={repeatableId} className="text-caption">
              {labels.repeatable}
            </Label>
            <Switch
              id={repeatableId}
              data-slot="happy-path-step-node-repeatable"
              aria-label={fillLabel(labels.repeatableFor, { activity: activityName })}
              checked={step.repeatable === true}
              onCheckedChange={(repeatable) => updateStep(index, { repeatable })}
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            data-slot="happy-path-step-node-remove"
            aria-label={fillLabel(labels.removeFor, { activity: activityName })}
            className="self-end gap-1.5"
            onClick={() => removeStep(index)}
          >
            <Trash2 aria-hidden="true" className="size-3.5" />
            {labels.remove}
          </Button>
        </div>
      ),
    }),
    [
      activityName,
      labels,
      n,
      index,
      step.activity,
      step.optional,
      step.repeatable,
      options,
      optionalId,
      repeatableId,
      updateStep,
      removeStep,
    ],
  );

  return (
    <div
      data-slot="happy-path-step-node"
      data-optional={step.optional ? "true" : undefined}
      data-repeatable={step.repeatable ? "true" : undefined}
      className="w-56"
    >
      <FlowNode {...props} type="brand" data={flowData} />
    </div>
  );
}
