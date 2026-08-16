"use client";

/**
 * MermaidWorkspace (#L2) — the source ⇄ diagram editing surface.
 *
 * Same compound pattern as `MarkdownWorkspace`: one mermaid source string,
 * Monaco on the left, the live branded `MermaidDiagram` on the right
 * (debounced so keystrokes don't thrash the engine). Controlled
 * (`value`/`onChange`) or uncontrolled (`defaultValue`).
 */
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@elabs/components-ui";
import { cn } from "@elabs/components-ui/lib/cn";
import { forwardRef, useEffect, useState, type HTMLAttributes } from "react";

import { CodeEditor } from "../code-editor";
import { MermaidDiagram } from "../mermaid-diagram";

export interface MermaidWorkspaceProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "onChange" | "defaultValue"
> {
  value?: string;
  defaultValue?: string;
  onChange?: (source: string) => void;
  /** Debounce (ms) before the diagram re-renders while typing. Default 350. */
  debounceMs?: number;
}

export const MermaidWorkspace = forwardRef<HTMLDivElement, MermaidWorkspaceProps>(
  function MermaidWorkspace(
    { value, defaultValue, onChange, debounceMs = 350, className, ...props },
    ref,
  ) {
    const isControlled = value !== undefined;
    const [internal, setInternal] = useState(value ?? defaultValue ?? "");
    const source = isControlled ? value : internal;

    const [debounced, setDebounced] = useState(source);
    useEffect(() => {
      const t = setTimeout(() => setDebounced(source), debounceMs);
      return () => clearTimeout(t);
    }, [source, debounceMs]);

    const setSource = (next: string) => {
      if (!isControlled) setInternal(next);
      onChange?.(next);
    };

    return (
      <div
        ref={ref}
        data-testid="mermaid-workspace"
        className={cn("h-full min-h-0 overflow-hidden", className)}
        {...props}
      >
        <ResizablePanelGroup direction="horizontal">
          <ResizablePanel defaultSize={45} minSize={25}>
            {/* Monaco has no mermaid grammar — plaintext keeps it honest (no wrong colors). */}
            <CodeEditor language="plaintext" value={source} onChange={setSource} />
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={55} minSize={25}>
            <div className="h-full overflow-auto p-4">
              <MermaidDiagram chart={debounced} label="Diagram preview" />
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    );
  },
);
