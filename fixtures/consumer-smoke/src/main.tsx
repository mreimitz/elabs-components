/**
 * The consumer surface, exercised the way a real app would.
 *
 * This is the ONLY place in the repo that consumes the built `dist/` artifact.
 * Everything else resolves `@elabs-ai/components-*` to TypeScript source via the `exports`
 * map, which is why dist-only defects (stripped "use client" directives, fonts
 * copied to the wrong depth, extracted-then-orphaned CSS, a subpath pointing at
 * raw .ts) survived every other gate in the repo.
 *
 * It is never executed — `vite build` bundling it is the assertion. That proves
 * every barrel and subpath resolves, and that the CSS pipeline wires up.
 */
import { createRoot } from "react-dom/client";

// Foundation
import { ThemeProvider } from "@elabs-ai/components-tokens";
import { Button } from "@elabs-ai/components-ui";
import { BrandLogo } from "@elabs-ai/components-icons";

// The server-safe leaves. These deliberately carry NO "use client" directive,
// so importing them must not drag in a client boundary.
import { cn } from "@elabs-ai/components-ui/lib/cn";
import { parseMarkdown } from "@elabs-ai/components-editor/markdown/parse";

// The @elabs-ai/components-charts jsdom-safe test double (#364) — a second subpath, proving
// `dist/test/index.js`/`dist/test/index.d.ts` resolve AND bundle from a real
// consumer app, not just that the tarball's `exports` map points at a file that
// exists (`checkExportsResolve` already covers that structurally; this covers
// Vite actually being able to import + tree-shake it).
import { LineChart as LineChartDouble } from "@elabs-ai/components-charts/test";

// One representative surface per package — proves each barrel resolves and
// bundles, including the heavy engines (Monaco, MapLibre, React Flow, visx).
import { DataTable } from "@elabs-ai/components-data";
import { ChatShell } from "@elabs-ai/components-ai";
// `mermaid` / `@rive-app/react-webgl2` / `@xterm/xterm` + `@xterm/addon-fit` /
// `media-chrome` are OPTIONAL peers of `@elabs-ai/components-ai` (issue #33) —
// deliberately NOT installed here — this import must still resolve and
// bundle, which is the proof that a consumer who skips them gets the actual
// AudioPlayer/Persona/InteractiveTerminal/MarkdownView surfaces to build at
// all (the runtime "capability gap" panel each renders when its engine
// import rejects is locked separately, in each package's own test suite).
import { AudioPlayer, MarkdownView, Persona, InteractiveTerminal } from "@elabs-ai/components-ai";
import { CanvasShell } from "@elabs-ai/components-flow";
import { MapCanvas } from "@elabs-ai/components-maps";
import { MetricCard } from "@elabs-ai/components-charts";
import { Hero } from "@elabs-ai/components-marketing";
import { CodeEditor } from "@elabs-ai/components-editor";
// The viewer's parser engines are OPTIONAL peers and are deliberately NOT
// installed here — this import must still resolve and bundle, which is the
// proof that a consumer who skips them gets the graceful "format unavailable"
// panel instead of a build error (ADR 0024 §2).
import { FileViewer } from "@elabs-ai/components-viewer";

import "./index.css";

// Reference every import so nothing is tree-shaken away before it is resolved.
const surfaces = [
  ThemeProvider,
  Button,
  BrandLogo,
  DataTable,
  ChatShell,
  AudioPlayer,
  MarkdownView,
  Persona,
  InteractiveTerminal,
  CanvasShell,
  MapCanvas,
  MetricCard,
  Hero,
  CodeEditor,
  FileViewer,
  LineChartDouble,
];

function App() {
  const classes = cn("p-4", "text-body");
  const ast = parseMarkdown("# consumer smoke\n\nverifies the Monaco-free leaf.");

  return (
    <ThemeProvider>
      <main className={classes}>
        <h1>brand-ui consumer smoke</h1>
        <p>
          {surfaces.length} surfaces resolved; markdown root is {ast.type}.
        </p>
        <Button>Ship it</Button>
      </main>
    </ThemeProvider>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
