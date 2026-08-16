/**
 * The consumer surface, exercised the way a real app would.
 *
 * This is the ONLY place in the repo that consumes the built `dist/` artifact.
 * Everything else resolves `@elabs/components-*` to TypeScript source via the `exports`
 * map, which is why dist-only defects (stripped "use client" directives, fonts
 * copied to the wrong depth, extracted-then-orphaned CSS, a subpath pointing at
 * raw .ts) survived every other gate in the repo.
 *
 * It is never executed — `vite build` bundling it is the assertion. That proves
 * every barrel and subpath resolves, and that the CSS pipeline wires up.
 */
import { createRoot } from "react-dom/client";

// Foundation
import { ThemeProvider } from "@elabs/components-tokens";
import { Button } from "@elabs/components-ui";
import { BrandLogo } from "@elabs/components-icons";

// The server-safe leaves. These deliberately carry NO "use client" directive,
// so importing them must not drag in a client boundary.
import { cn } from "@elabs/components-ui/lib/cn";
import { parseMarkdown } from "@elabs/components-editor/markdown/parse";

// The @elabs/components-charts jsdom-safe test double (#364) — a second subpath, proving
// `dist/test/index.js`/`dist/test/index.d.ts` resolve AND bundle from a real
// consumer app, not just that the tarball's `exports` map points at a file that
// exists (`checkExportsResolve` already covers that structurally; this covers
// Vite actually being able to import + tree-shake it).
import { LineChart as LineChartDouble } from "@elabs/components-charts/test";

// One representative surface per package — proves each barrel resolves and
// bundles, including the heavy engines (Monaco, MapLibre, React Flow, visx).
import { DataTable } from "@elabs/components-data";
import { ChatShell } from "@elabs/components-ai";
import { CanvasShell } from "@elabs/components-flow";
import { MapCanvas } from "@elabs/components-maps";
import { MetricCard } from "@elabs/components-charts";
import { Hero } from "@elabs/components-marketing";
import { CodeEditor } from "@elabs/components-editor";
// The viewer's parser engines are OPTIONAL peers and are deliberately NOT
// installed here — this import must still resolve and bundle, which is the
// proof that a consumer who skips them gets the graceful "format unavailable"
// panel instead of a build error (ADR 0024 §2).
import { FileViewer } from "@elabs/components-viewer";

import "./index.css";

// Reference every import so nothing is tree-shaken away before it is resolved.
const surfaces = [
  ThemeProvider,
  Button,
  BrandLogo,
  DataTable,
  ChatShell,
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
