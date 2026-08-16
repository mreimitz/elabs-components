// a2ui.exposed: yes
"use client";

import { forwardRef, useId, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { ChevronsUpDown } from "lucide-react";
import { cn } from "../../lib/cn";
import { Badge } from "../badge";
import { Button } from "../button";
import { Popover, PopoverContent, PopoverTrigger } from "../popover";
import { Tree, type TreeNode } from "../tree";

export interface TreeSelectProps<T = unknown> extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "value" | "onChange"
> {
  nodes: TreeNode<T>[];
  /** Controlled value — `string` in single mode, `string[]` in multiple mode. */
  value?: string | string[];
  /** Uncontrolled initial value. */
  defaultValue?: string | string[];
  onValueChange?: (value: string | string[]) => void;
  /** Allow selecting multiple nodes (checkbox tree). Default false. */
  multiple?: boolean;
  placeholder?: string;
  className?: string;
}

function toArray(v: string | string[] | undefined): string[] {
  if (v === undefined) return [];
  if (Array.isArray(v)) return v;
  return v === "" ? [] : [v];
}

function findLabel<T>(nodes: TreeNode<T>[], id: string): ReactNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node.label;
    if (node.children?.length) {
      const found = findLabel(node.children, id);
      if (found !== undefined) return found;
    }
  }
  return undefined;
}

/**
 * A select whose options are a hierarchical {@link Tree}. Single or multiple
 * selection; composes `Tree` for all keyboard/SR behaviour.
 */
export const TreeSelect = forwardRef<HTMLButtonElement, TreeSelectProps>(function TreeSelect(
  {
    nodes,
    value,
    defaultValue,
    onValueChange,
    multiple = false,
    placeholder = "Select…",
    className,
    ...props
  },
  ref,
) {
  const [open, setOpen] = useState(false);
  const treeId = useId();
  const isControlled = value !== undefined;
  const [internal, setInternal] = useState<string[]>(() => toArray(defaultValue));
  const selected = isControlled ? toArray(value) : internal;

  const emit = (next: string[]) => {
    if (!isControlled) setInternal(next);
    onValueChange?.(multiple ? next : (next[0] ?? ""));
  };

  const handleSelectionChange = (ids: string[]) => {
    emit(ids);
    if (!multiple) setOpen(false);
  };

  const labels = selected.map((id) => ({ id, label: findLabel(nodes, id) ?? id }));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          ref={ref}
          type="button"
          variant="outline"
          role="combobox"
          aria-haspopup="tree"
          aria-expanded={open}
          aria-controls={treeId}
          className={cn("h-auto min-h-9 w-64 justify-between font-normal", className)}
          {...props}
        >
          <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1 text-start">
            {labels.length === 0 ? (
              <span className="text-muted-foreground">{placeholder}</span>
            ) : multiple ? (
              <>
                {labels.slice(0, 2).map((l) => (
                  <Badge
                    key={l.id}
                    variant="secondary"
                    className="max-w-[10rem] truncate border-border"
                  >
                    {l.label}
                  </Badge>
                ))}
                {labels.length > 2 ? (
                  <Badge variant="secondary" aria-label={`and ${labels.length - 2} more selected`}>
                    +{labels.length - 2}
                  </Badge>
                ) : null}
              </>
            ) : (
              <span className="truncate">{labels[0]?.label}</span>
            )}
          </span>
          <ChevronsUpDown className="ms-2 size-4 shrink-0 opacity-50" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-1" align="start">
        <Tree
          id={treeId}
          nodes={nodes}
          selectionMode={multiple ? "multiple" : "single"}
          checkboxes={multiple}
          selectedIds={selected}
          onSelectionChange={handleSelectionChange}
          defaultExpandedIds={nodes.map((n) => n.id)}
          className="max-h-72 overflow-auto"
        />
      </PopoverContent>
    </Popover>
  );
}) as <T = unknown>(
  props: TreeSelectProps<T> & { ref?: React.Ref<HTMLButtonElement> },
) => React.ReactElement | null;
