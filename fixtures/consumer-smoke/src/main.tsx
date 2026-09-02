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
// `@rive-app/react-webgl2` / `media-chrome` are OPTIONAL peers of
// `@elabs-ai/components-ai` (issue #33) — deliberately NOT installed here —
// this import must still resolve and bundle, which is the proof that a
// consumer who skips them gets the actual AudioPlayer/Persona surfaces to
// build at all (the runtime "capability gap" panel each renders when its
// engine import rejects is locked separately, in each package's own test
// suite). `mermaid` is ALSO declared as an optional peer, but it is NOT
// "deliberately not installed here" the way the other two are — it is
// always installed regardless: two of `@elabs-ai/components-ai`'s own plain
// dependencies, `streamdown` and `@streamdown/mermaid`, each declare
// `mermaid` as their own plain, non-optional dependency, so this fixture
// cannot prove mermaid's absence the way it proves the other two (issue #94,
// `pnpm optional-peers:check`).
import { AudioPlayer, MarkdownView, Persona } from "@elabs-ai/components-ai";
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
// `@xterm/xterm` + `@xterm/addon-fit` are OPTIONAL peers of
// `@elabs-ai/components-terminal` (issue #116 move). `Terminal` itself never
// touches them (only `InteractiveTerminal` does) — this import only proves
// the new package's barrel resolves and bundles; it does NOT re-prove the
// xterm-optional-peer-absent contract InteractiveTerminal used to cover here.
import { Terminal } from "@elabs-ai/components-terminal";

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
  CanvasShell,
  MapCanvas,
  MetricCard,
  Hero,
  CodeEditor,
  FileViewer,
  LineChartDouble,
  Terminal,
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
