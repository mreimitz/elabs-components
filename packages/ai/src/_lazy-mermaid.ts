/**
 * A drop-in replacement for `@streamdown/mermaid`'s `mermaid` plugin that loads
 * the Mermaid engine **on first diagram render** instead of at import time.
 *
 * Why this exists
 * ---------------
 * `@streamdown/mermaid`'s dist opens with a static `import n from "mermaid"`, and
 * neither it nor `mermaid`/`dompurify`/`d3` declares `sideEffects`, so a bundler
 * must keep the whole edge. `@elabs-ai/components-ai` imported that plugin from three modules
 * (`message`, `reasoning`, `markdown-view`), which put Mermaid + d3 + DOMPurify —
 * several MB — in the **entry chunk** of every consumer, including the vast
 * majority that never render a diagram.
 *
 * How it avoids a render flash
 * ----------------------------
 * `DiagramPlugin` is not the engine; it is a lazy accessor. Streamdown calls
 * `getMermaid()` only from inside its async diagram-render path (immediately
 * before `await instance.render(...)`), never at module or component init. So the
 * plugin object can be present from the very first frame — Streamdown always
 * treats a ```mermaid fence as a diagram — while the engine itself arrives with a
 * dynamic import inside `render()`. No content-sniffing, no plugin swap, no
 * suspense seam at the call sites, and no "raw source flashes then becomes a
 * diagram" transition.
 *
 * The upstream plugin is ~10 lines; its defaults and initialize-once semantics
 * are mirrored exactly below. The `DiagramPlugin` type is still imported (as a
 * type, so it erases) from `@streamdown/mermaid`, which keeps this honest against
 * the real contract at typecheck time.
 */
import type { DiagramPlugin, MermaidConfig, MermaidInstance } from "@streamdown/mermaid";

/** Mirrors `@streamdown/mermaid`'s defaults — notably `securityLevel: "strict"`. */
const DEFAULT_CONFIG: MermaidConfig = {
  fontFamily: "monospace",
  securityLevel: "strict",
  startOnLoad: false,
  suppressErrorRendering: true,
  theme: "default",
};

type MermaidModule = {
  initialize: (config: MermaidConfig) => void;
  render: (id: string, source: string) => Promise<{ svg: string }>;
};

/**
 * Module-level singleton: the engine is fetched at most once per app, however
 * many diagrams or Streamdown instances render.
 */
let enginePromise: Promise<MermaidModule> | undefined;

const loadEngine = (): Promise<MermaidModule> => {
  enginePromise ??= import("mermaid").then((m) => {
    const engine = m.default as unknown as MermaidModule;
    // `mermaid` is an optional peer (issue #33). `@streamdown/mermaid` — a
    // dependency of THIS package, not of the consumer — currently declares
    // `mermaid` as its own plain, non-optional dependency, so a hoisting
    // package manager (pnpm's default `node-linker=isolated` included, via
    // phantom resolution through the virtual store) may still make the real
    // bytes resolve even when a consumer never installed `mermaid`
    // themselves — this guard does not cover that case, only a bundler
    // whose optional-peer handling substitutes an EMPTY module (Vite's
    // production stub is `export default {}`) once the peer is genuinely
    // absent from the resolved tree. Without this guard that empty object
    // resolves successfully and the crash lands one call later, on
    // `engine.initialize is not a function` — a message
    // `isModuleNotFoundMessage` does not recognize, so it reaches the user
    // as "Diagram couldn't be drawn" with a Retry button that can never
    // succeed, instead of the actionable capability-gap panel.
    if (typeof engine?.initialize !== "function" || typeof engine?.render !== "function") {
      throw new Error("Cannot find module 'mermaid'");
    }
    return engine;
  });
  return enginePromise;
};

/**
 * Start fetching the Mermaid engine ahead of time.
 *
 * Optional. Call it when you already know the surface will render diagrams (on
 * route entry, or when a conversation is known to contain them) so the first
 * diagram doesn't pay the import latency. Safe to call repeatedly; safe to
 * ignore — rendering a diagram loads the engine either way.
 */
export const preloadMermaid = (): void => {
  void loadEngine();
};

/**
 * Create a lazy Mermaid diagram plugin for Streamdown.
 *
 * @param options.config Mermaid config merged over the brand defaults.
 */
export const createLazyMermaidPlugin = (
  options: { config?: MermaidConfig } = {},
): DiagramPlugin => {
  let initialized = false;
  let config: MermaidConfig = { ...DEFAULT_CONFIG, ...options.config };

  const instance: MermaidInstance = {
    // Upstream calls `mermaid.initialize` synchronously here. We can't (the
    // engine may not have loaded yet), so record the config and apply it inside
    // `render`, which is the only place it can matter — Streamdown always calls
    // `getMermaid()` immediately before awaiting `render()`.
    initialize(next: MermaidConfig) {
      config = { ...DEFAULT_CONFIG, ...options.config, ...next };
      initialized = false;
    },
    async render(id: string, source: string) {
      const engine = await loadEngine();
      if (!initialized) {
        engine.initialize(config);
        initialized = true;
      }
      return engine.render(id, source);
    },
  };

  return {
    getMermaid(next?: MermaidConfig) {
      if (next) {
        instance.initialize(next);
      }
      return instance;
    },
    language: "mermaid",
    name: "mermaid",
    type: "diagram",
  };
};

/**
 * The shared lazy Mermaid plugin — the `@elabs-ai/components-ai` replacement for
 * `@streamdown/mermaid`'s eager `mermaid` export. One instance for the whole
 * app, so the engine and its initialize-once state are shared.
 */
export const lazyMermaid: DiagramPlugin = createLazyMermaidPlugin();
