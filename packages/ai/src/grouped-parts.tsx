"use client";

/**
 * GroupedParts — renders an ordered part list, folding adjacent reasoning/tool
 * parts into collapsible traces (see `part-groups.ts` for the pure engine).
 *
 * A render-prop switches on `part.type`. Group nodes arrive as synthetic
 * `{ type: "group-…", status, indices }` with their rendered `children`; real
 * parts arrive as leaves. When no render-prop is given, sensible defaults
 * integrate the existing `Reasoning` / `Tool` components (and a collapsible
 * trace for groups). It is presentational only — the grouping is a client-side
 * view transform, never a model output format.
 *
 * NOTE: this is a generic function component (not `forwardRef`) because the
 * render-prop is generic over the part type `T`; `forwardRef` erases generics.
 */

import { Fragment, useMemo, type ComponentProps, type HTMLAttributes, type ReactNode } from "react";
import { BrainIcon, ChevronDownIcon } from "lucide-react";
import { Badge, Collapsible, CollapsibleContent, CollapsibleTrigger } from "@elabs/components-ui";
import { cn } from "@elabs/components-ui/lib/cn";

import { Reasoning, ReasoningContent, ReasoningTrigger } from "./reasoning";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
  statusFromToolState,
  type ToolPart,
} from "./tool";
import {
  buildPartGroups,
  defaultPartStatus,
  groupPartByType,
  partsFingerprint,
  type GetPartStatus,
  type GroupablePart,
  type GroupBy,
  type GroupedNode,
  type GroupStatus,
  type PartGroupNode,
} from "./part-groups";

// ─── Render-prop args ─────────────────────────────────────────────────────────

export interface GroupedPartRenderArgs<T extends GroupablePart> {
  /** The real part (leaf) or the synthetic group node. */
  part: T | PartGroupNode;
  /** True when `part` is a synthetic group node. */
  isGroup: boolean;
  /** The rendered subtree — group nodes only. */
  children?: ReactNode;
  /** Rolled-up status (groups) or the part's status (leaves). */
  status: GroupStatus;
  /** Original part indices under this group (groups only). */
  indices?: number[];
  /** Original part index (leaves only). */
  index?: number;
}

export type GroupedPartRenderer<T extends GroupablePart> = (
  args: GroupedPartRenderArgs<T>,
) => ReactNode;

// ─── Default renderers ────────────────────────────────────────────────────────

function DefaultGroup({
  status,
  count,
  children,
}: {
  status: GroupStatus;
  count: number;
  children: ReactNode;
}) {
  const running = status === "running";
  return (
    <Collapsible defaultOpen={running} className="not-prose w-full rounded-md border border-border">
      <CollapsibleTrigger
        className={cn(
          "group flex w-full items-center gap-2 p-3 text-body text-muted-foreground",
          "transition-colors duration-fast ease-standard hover:text-foreground motion-reduce:transition-none",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
        )}
      >
        <BrainIcon aria-hidden="true" className="size-4 shrink-0" />
        <span className="flex-1 text-start">{running ? "Working…" : "Thought process"}</span>
        {count > 0 && (
          <Badge variant="secondary" className="shrink-0">
            {count}
          </Badge>
        )}
        <ChevronDownIcon
          aria-hidden="true"
          className="size-4 shrink-0 transition-transform group-data-[state=open]:rotate-180 motion-reduce:transition-none"
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-3 p-3 pt-0">{children}</CollapsibleContent>
    </Collapsible>
  );
}

function defaultRenderPart<T extends GroupablePart>(args: GroupedPartRenderArgs<T>): ReactNode {
  if (args.isGroup) {
    return (
      <DefaultGroup status={args.status} count={args.indices?.length ?? 0}>
        {args.children}
      </DefaultGroup>
    );
  }

  const part = args.part as GroupablePart;
  const streaming = args.status === "running";

  // Reasoning → the branded Reasoning disclosure.
  if (part.type === "reasoning" || part.type.startsWith("reasoning")) {
    const text = typeof part.text === "string" ? part.text : "";
    return (
      <Reasoning isStreaming={streaming} defaultOpen={streaming}>
        <ReasoningTrigger />
        <ReasoningContent>{text}</ReasoningContent>
      </Reasoning>
    );
  }

  // Tool call → the branded Tool disclosure (defensive: parts are plain objects).
  if (part.type.startsWith("tool-") || part.type === "dynamic-tool") {
    const p = part as Record<string, unknown>;
    const headerProps = {
      type: p.type,
      state: p.state ?? "input-available",
      toolName: p.type === "dynamic-tool" ? p.toolName : undefined,
    } as ComponentProps<typeof ToolHeader>;
    // The output area must reflect an in-flight call, not just a settled one
    // (loading-states.md / #269): a `tool-*` part in `input-streaming` (or
    // `input-available`, before output/error land) is "pending", so
    // `ToolOutput` renders its skeleton instead of nothing.
    const toolStreaming =
      statusFromToolState((p.state as ToolPart["state"]) ?? "input-available") === "pending";
    return (
      <Tool>
        <ToolHeader {...headerProps} />
        <ToolContent>
          {p.input !== undefined && <ToolInput input={p.input} />}
          {(toolStreaming || p.output !== undefined || Boolean(p.errorText)) && (
            <ToolOutput
              output={p.output}
              errorText={(p.errorText as string) ?? undefined}
              isStreaming={toolStreaming}
            />
          )}
        </ToolContent>
      </Tool>
    );
  }

  // Text → plain prose (consumers usually override with a markdown renderer).
  if (part.type === "text") {
    const text = typeof part.text === "string" ? part.text : "";
    return <div className="whitespace-pre-wrap text-body text-foreground">{text}</div>;
  }

  // Unknown leaf types: nothing by default (supply a render-prop for coverage).
  return null;
}

// ─── GroupedParts ─────────────────────────────────────────────────────────────

export interface GroupedPartsProps<T extends GroupablePart> extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "children"
> {
  /** The ordered message parts to render. */
  parts: readonly T[];
  /** How to group parts. @default `groupPartByType()` */
  groupBy?: GroupBy<T>;
  /** Extract a part's status (drives group rollup + streaming affordances). */
  getStatus?: GetPartStatus<T>;
  /** Render-prop switching on `part.type`. Omit to use the default renderers. */
  children?: GroupedPartRenderer<T>;
}

/**
 * Renders `parts`, coalescing adjacent grouped parts into collapsible traces.
 * The tree only rebuilds when the parts' identity/type/status fingerprint
 * changes, so streaming token updates don't remount rows.
 */
export function GroupedParts<T extends GroupablePart>({
  parts,
  groupBy = groupPartByType<T>(),
  getStatus,
  children,
  className,
  ...props
}: GroupedPartsProps<T>) {
  const fingerprint = partsFingerprint(parts, getStatus);
  const tree = useMemo<GroupedNode<T>[]>(
    () => buildPartGroups(parts, groupBy, getStatus),
    // Rebuild only on a structural change; `parts`/`groupBy`/`getStatus` identity
    // may churn per render, but the fingerprint is the real dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fingerprint, groupBy, getStatus],
  );

  const renderPart = children ?? defaultRenderPart<T>;
  const statusOf = (part: T): GroupStatus => getStatus?.(part) ?? defaultPartStatus(part);

  const renderNode = (node: GroupedNode<T>): ReactNode => {
    if (node.kind === "leaf") {
      return (
        <Fragment key={node.key}>
          {renderPart({
            part: node.part,
            isGroup: false,
            status: statusOf(node.part),
            index: node.index,
          })}
        </Fragment>
      );
    }
    const kids = node.children.map(renderNode);
    return (
      <Fragment key={node.key}>
        {renderPart({
          part: node.group,
          isGroup: true,
          status: node.group.status,
          indices: node.group.indices,
          children: <>{kids}</>,
        })}
      </Fragment>
    );
  };

  return (
    <div className={cn("flex w-full flex-col gap-3", className)} {...props}>
      {tree.map(renderNode)}
    </div>
  );
}
