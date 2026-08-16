/**
 * The xterm.js half of `InteractiveTerminal`, split out so it can be reached
 * through a dynamic `import()`.
 *
 * `@xterm/xterm` declares no `sideEffects`, so a static import from
 * `interactive-terminal.tsx` put the whole emulator — plus its stylesheet — into
 * the entry chunk of every `@elabs-ai/components-ai` consumer, including
 * the vast majority that never render a terminal. The **stylesheet import has to
 * live here too**: a bare `import "@xterm/xterm/css/xterm.css"` in the public
 * module keeps the edge alive on its own.
 *
 * Unlike `_persona-rive.tsx` (a `lazy()` component boundary), this one follows
 * `_lazy-mermaid.ts`: the engine is reached through a **late-called interface**.
 * `InteractiveTerminal` only ever constructs xterm inside its mount effect —
 * never during render — so the public component keeps its `forwardRef`, its
 * imperative handle and its container `<div>` unchanged, and awaits this module
 * inside that effect. No `Suspense` seam, no skeleton swap, no change to the box
 * the terminal paints into (the container is sized by the consumer either way).
 *
 * `ITheme` and the two constructor types stay `import type` in the public module
 * (types erase), which is what keeps `buildInteractiveTerminalTheme` public.
 *
 * See ADR 0019 and `pnpm heavy-deps:check`.
 *
 * @lazy-boundary This module must only ever be reached via `import()`. The gate
 * fails if anything imports it statically, which would put xterm back in the
 * entry chunk and make the dynamic import pointless.
 */
import "@xterm/xterm/css/xterm.css";

export { FitAddon } from "@xterm/addon-fit";
export { Terminal as XTerm } from "@xterm/xterm";
