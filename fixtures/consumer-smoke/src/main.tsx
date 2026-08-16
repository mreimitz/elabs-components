/**
 * The consumer surface, exercised the way a real app would.
 *
 * This is the ONLY place in the repo that consumes the built `dist/` artifact.
 * Everything else resolves `@qlik-coe-emea/qlabs-components-*` to TypeScript source via the `exports`
 * map, which is why dist-only defects (stripped "use client" directives, fonts
 * copied to the wrong depth, extracted-then-orphaned CSS, a subpath pointing at
 * raw .ts) survived every other gate in the repo.
 *
 * It is never executed — `vite build` bundling it is the assertion. That proves
 * every barrel and subpath resolves, and that the CSS pipeline wires up.
 */
import { createRoot } from "react-dom/client";

// Foundation
import { ThemeProvider } from "@qlik-coe-emea/qlabs-components-tokens";
import { Button } from "@qlik-coe-emea/qlabs-components-ui";
import { BrandLogo } from "@qlik-coe-emea/qlabs-components-icons";

// The server-safe leaves. These deliberately carry NO "use client" directive,
// so importing them must not drag in a client boundary.
import { cn } from "@qlik-coe-emea/qlabs-components-ui/lib/cn";
import { parseMarkdown } from "@qlik-coe-emea/qlabs-components-editor/markdown/parse";

// The @qlik-coe-emea/qlabs-components-charts jsdom-safe test double (#364) — a second subpath, proving
// `dist/test/index.js`/`dist/test/index.d.ts` resolve AND bundle from a real
// consumer app, not just that the tarball's `exports` map points at a file that
// exists (`checkExportsResolve` already covers that structurally; this covers
// Vite actually being able to import + tree-shake it).
import { LineChart as LineChartDouble } from "@qlik-coe-emea/qlabs-components-charts/test";

// One representative surface per package — proves each barrel resolves and
// bundles, including the heavy engines (Monaco, MapLibre, React Flow, visx).
import { DataTable } from "@qlik-coe-emea/qlabs-components-data";
import { ChatShell } from "@qlik-coe-emea/qlabs-components-ai";
import { CanvasShell } from "@qlik-coe-emea/qlabs-components-flow";
import { MapCanvas } from "@qlik-coe-emea/qlabs-components-maps";
import { MetricCard } from "@qlik-coe-emea/qlabs-components-charts";
import { Hero } from "@qlik-coe-emea/qlabs-components-marketing";
import { CodeEditor } from "@qlik-coe-emea/qlabs-components-editor";
// The viewer's parser engines are OPTIONAL peers and are deliberately NOT
// installed here — this import must still resolve and bundle, which is the
// proof that a consumer who skips them gets the graceful "format unavailable"
// panel instead of a build error (ADR 0024 §2).
import { FileViewer } from "@qlik-coe-emea/qlabs-components-viewer";

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
