import { useState } from "react";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@elabs-ai/components-ui";
import { DiagramShell } from "./shell/diagram-shell";
import { EditorPane } from "./panes/editor-pane";
import { CanvasPane } from "./panes/canvas-pane";

const SAMPLE_YAML = `diagram: "0"
title: Sample architecture
direction: LR
zones:
  - id: app
    title: Customer app
    children:
      - id: web
        title: Web
      - id: api
        title: API
`;

/**
 * The dashboard app shell (DG-02) — sidebar + top bar around the editor/canvas
 * split. `text` is a plain `useState` for now; DG-12 replaces it with the
 * shared parse/validate/compile pipeline's store.
 */
export function App() {
  const [text, setText] = useState(SAMPLE_YAML);

  return (
    <DiagramShell text={text}>
      <ResizablePanelGroup direction="horizontal">
        <ResizablePanel defaultSize={40} minSize={25}>
          <EditorPane value={text} onChange={setText} />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel minSize={25}>
          <CanvasPane />
        </ResizablePanel>
      </ResizablePanelGroup>
    </DiagramShell>
  );
}
