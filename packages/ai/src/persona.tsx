"use client";

import { cn } from "@elabs-ai/components-ui/lib/cn";
import { useLocale } from "@elabs-ai/components-ui";
import type { FC, ReactNode } from "react";
import { lazy, memo, Suspense, useCallback, useState } from "react";

import { LazyEngineBoundary } from "./_lazy-engine-boundary";
import { PERSONA_SOURCES, type PersonaState, type PersonaVariant } from "./persona-sources";

export { PERSONA_SOURCES };
export type { PersonaState, PersonaVariant };

/**
 * The Rive runtime lives behind a dynamic import — `@rive-app/react-webgl2`
 * declares no `sideEffects`, so a static import would put the whole WebGL2
 * runtime and its `.wasm` in every consumer's entry chunk, `Persona` rendered or
 * not. See ADR 0019.
 *
 * Issue #101: `@rive-app/react-webgl2` (and, transitively, `@rive-app/webgl2`,
 * which re-exports `RiveParameters`) is an OPTIONAL peer, so no PUBLIC export's
 * type may structurally reference it — doing so would name the peer's module
 * specifier in this package's generated root `.d.ts` and hand a
 * `skipLibCheck: false` consumer who has not installed the peer a `TS2307` just
 * for importing the barrel. `PersonaRiveEvent`/`PersonaRiveEventCallback` below
 * are an OWNED mirror of the peer's `Event`/`EventCallback` (from
 * `@rive-app/webgl2`'s `rive.d.ts`) — every one of `RiveParameters`'s
 * `onLoad`/`onLoadError`/`onPause`/`onPlay`/`onStop` callbacks share that exact
 * same `EventCallback` shape, so one owned type covers all five. The
 * conformance assertion in `_persona-rive.tsx` (which still imports the real
 * peer types — that module is reached only through `lazy()` and never sits in
 * the barrel's declaration graph) proves this mirror stays assignable to the
 * real peer type; a future Rive release that changes `Event`'s shape fails
 * `pnpm --filter @elabs-ai/components-ai typecheck` locally instead of
 * reaching a consumer as silent drift. Mirrors the identical pattern
 * `packages/terminal/src/interactive-terminal.tsx` already established for
 * `@xterm/xterm`'s `ITheme` (also issue #101).
 */
const PersonaRive = lazy(() => import("./_persona-rive"));

/**
 * Owned mirror of `@rive-app/webgl2`'s `Event` (the parameter type every
 * `RiveParameters` callback receives) — see the module doc comment above.
 * `data` is deliberately widened to `unknown` rather than replicating Rive's
 * `RiveEventPayload`/`LoopEvent`/`RiveFile` union: no callback in this package
 * (or, realistically, a consumer's) narrows it, and `unknown` remains a safe,
 * structurally-compatible supertype of the real union for the conformance
 * assertion in `_persona-rive.tsx`.
 */
export interface PersonaRiveEvent {
  type: string;
  data?: unknown;
}

/** Owned mirror of `@rive-app/webgl2`'s `EventCallback`. */
export type PersonaRiveEventCallback = (event: PersonaRiveEvent) => void;

/**
 * Localized status announced when `state` changes, one key per `PersonaState`.
 * Typed as a `Record` (not a bare template string) so a `PersonaState` value
 * added later without a matching key here fails to typecheck.
 */
const PERSONA_STATE_KEYS: Record<PersonaState, string> = {
  idle: "ai.persona.idle",
  listening: "ai.persona.listening",
  thinking: "ai.persona.thinking",
  speaking: "ai.persona.speaking",
  asleep: "ai.persona.asleep",
};

export interface PersonaProps {
  className?: string;
  /**
   * Rendered while the artwork loads, and permanently if it fails (blocked by a
   * `connect-src` CSP, offline, or a bad `src`). Defaults to a token-driven orb,
   * so a blocked fetch never leaves an empty box.
   */
  fallback?: ReactNode;
  onLoad?: PersonaRiveEventCallback;
  onLoadError?: PersonaRiveEventCallback;
  onPause?: PersonaRiveEventCallback;
  onPlay?: PersonaRiveEventCallback;
  onReady?: () => void;
  onStop?: PersonaRiveEventCallback;
  /**
   * Override the `.riv` artwork URL — point at a self-hosted copy when a CSP
   * blocks the default origin. Defaults to `PERSONA_SOURCES[variant].source`.
   * Mirrors the `mapStyle` override on `MapCanvas`.
   */
  src?: string;
  state: PersonaState;
  /**
   * Visually-hidden text announced when `state` changes. Defaults to a
   * localized label for the current `state`; pass `null` when the consuming
   * surface already renders its own `role="status"` line, so AT is not told
   * twice.
   */
  statusLabel?: ReactNode | null;
  variant?: PersonaVariant;
}

/**
 * The offline/blocked stand-in: a token-driven orb.
 *
 * Opacity-only pulse (no transform), neutralised under reduced motion.
 */
const PersonaFallback = ({ className }: { className?: string }) => (
  <div
    aria-hidden="true"
    className={cn("grid size-16 shrink-0 place-items-center rounded-full bg-primary/10", className)}
  >
    <span className="size-6 animate-pulse rounded-full bg-primary/40 motion-reduce:animate-none" />
  </div>
);

export const Persona: FC<PersonaProps> = memo(
  ({
    className,
    fallback,
    onLoad,
    onLoadError,
    onPause,
    onPlay,
    onReady,
    onStop,
    src,
    state = "idle",
    statusLabel,
    variant = "obsidian",
  }) => {
    const source = PERSONA_SOURCES[variant];

    if (!source) {
      throw new Error(`Invalid variant: ${variant}`);
    }

    const { t } = useLocale();
    const [failed, setFailed] = useState(false);

    const handleLoadError = useCallback<PersonaRiveEventCallback>(
      (event) => {
        setFailed(true);
        onLoadError?.(event);
      },
      [onLoadError],
    );

    const placeholder = fallback ?? <PersonaFallback className={className} />;

    const label = statusLabel === null ? null : (statusLabel ?? t(PERSONA_STATE_KEYS[state]));

    const visual = failed ? (
      placeholder
    ) : (
      // The Rive runtime is an optional peer (`@rive-app/react-webgl2`, issue
      // #33) reached via `lazy()` — a REJECTED import throws during render,
      // which `Suspense` alone cannot catch (it only covers the pending
      // state). `LazyEngineBoundary` catches that throw and falls back to the
      // same placeholder a load-time `onLoadError` already renders.
      // `renderMissing` stays pure — `LazyEngineBoundary.componentDidCatch`
      // already logs the error once, correctly; logging it again here would
      // double-report on every render this fallback re-mounts under.
      <LazyEngineBoundary renderMissing={() => placeholder}>
        <Suspense fallback={placeholder}>
          <PersonaRive
            className={className}
            onLoad={onLoad}
            onLoadError={handleLoadError}
            onPause={onPause}
            onPlay={onPlay}
            onReady={onReady}
            onStop={onStop}
            source={source}
            src={src ?? source.source}
            state={state}
          />
        </Suspense>
      </LazyEngineBoundary>
    );

    return (
      <>
        {visual}
        {label !== null && (
          <span className="sr-only" role="status" aria-live="polite">
            {label}
          </span>
        )}
      </>
    );
  },
);

Persona.displayName = "Persona";
