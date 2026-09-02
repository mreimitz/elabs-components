/**
 * The xterm.js half of `InteractiveTerminal`, split out so it can be reached
 * through a dynamic `import()`.
 *
 * `@xterm/xterm` declares no `sideEffects`, so a static import from
 * `interactive-terminal.tsx` put the whole emulator — plus its stylesheet — into
 * the entry chunk of every `@elabs-ai/components-terminal` consumer, including
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

export interface XTermEngine {
  FitAddon: typeof import("@xterm/addon-fit").FitAddon;
  XTerm: typeof import("@xterm/xterm").Terminal;
}

let enginePromise: Promise<XTermEngine> | undefined;

/**
 * Load the xterm.js engine, once per app.
 *
 * A NAMED static import/re-export here (`export { Terminal as XTerm } from
 * "@xterm/xterm"`) — and even a namespace import destructured at module scope
 * (`import * as X from "@xterm/xterm"; export const XTerm = X.Terminal`) — is
 * an ESM binding Rollup resolves and re-derives ("resolveNamespaceVariables")
 * at BUILD time. Now that `@xterm/xterm`/`@xterm/addon-fit` are genuinely
 * optional peers (issue #33), a consumer who has not installed them hits that
 * resolution at the worst possible time: Vite's own optional-peer-dependency
 * handling substitutes a build-time stub with no exports, Rollup traces the
 * namespace destructure straight back to that missing named export anyway,
 * and the WHOLE APP BUILD fails — not a runtime rejection
 * `interactive-terminal.tsx`'s `.catch()` could ever see (confirmed against
 * `fixtures/consumer-smoke`'s real Vite build, both before and after trying
 * the namespace-import workaround).
 *
 * A genuinely DYNAMIC `import()` called from inside a function — mirroring
 * `_lazy-mermaid.ts`'s `loadEngine`, the one lazy boundary that never hit this
 * bug — is opaque to that optimization: its resolved shape isn't knowable
 * ahead of time, so Rollup cannot re-derive a named binding through it. A
 * missing peer then surfaces the way it always should have: a promise that
 * rejects (or, since the stub resolves rather than rejects, an explicit guard
 * that throws a message `isModuleNotFoundMessage` recognizes) — landing on
 * this file's own `.catch()`/`.then()` chain in `interactive-terminal.tsx`
 * exactly as intended.
 *
 * **A REJECTED attempt is evicted from the cache; a SUCCESSFUL one is not**
 * (issue #99). `InteractiveTerminal`'s "Try again" button re-calls this
 * function after bumping `reloadKey` — if a first, failed attempt stayed
 * cached forever (the old `enginePromise ??= …` shape did exactly that, since
 * a rejected promise is neither `null` nor `undefined`), the retry would just
 * be handed back the same settled rejection with no new `import()` ever
 * attempted. The `.catch()` below is part of the SAME returned chain and
 * rethrows — it must never be a detached `pending.catch(...)` side-effect,
 * which would leave the caller's rejection unhandled on one branch while
 * creating a second, truly unhandled rejection on the other. The identity
 * guard (`enginePromise === pending`) makes the eviction safe if a newer
 * attempt (from a second, concurrent Retry) is already in flight.
 *
 * **Out of scope: a module-EVALUATION throw.** If this module itself fails to
 * evaluate (its top-level `import "@xterm/xterm/css/xterm.css"`, or an xterm
 * side-effect during evaluation), the dynamic `import("./_interactive-terminal-xterm")`
 * in `interactive-terminal.tsx` rejects before `loadXTermEngine` is ever
 * called — `enginePromise` stays `undefined`, and the permanence comes from
 * the ESM spec's own module-record evaluation-error cache, which userland
 * cannot clear. No eviction here can fix that variant; only a full page
 * reload can.
 */
export const loadXTermEngine = (): Promise<XTermEngine> => {
  if (!enginePromise) {
    const pending: Promise<XTermEngine> = Promise.all([
      import("@xterm/xterm"),
      import("@xterm/addon-fit"),
    ])
      .then(([core, addon]) => {
        const XTerm = core.Terminal;
        const FitAddon = addon.FitAddon;
        if (!XTerm || !FitAddon) {
          throw new Error("Cannot find module '@xterm/xterm'");
        }
        return { FitAddon, XTerm };
      })
      .catch((error: unknown) => {
        if (enginePromise === pending) enginePromise = undefined;
        throw error;
      });
    enginePromise = pending;
  }
  return enginePromise;
};
