"use client";

import { cn } from "@elabs-ai/components-ui/lib/cn";
import { useLocale } from "@elabs-ai/components-ui";
import type { RiveParameters } from "@rive-app/react-webgl2";
import type { FC, ReactNode } from "react";
import { lazy, memo, Suspense, useCallback, useState } from "react";

import { PERSONA_SOURCES, type PersonaState, type PersonaVariant } from "./persona-sources";

export { PERSONA_SOURCES };
export type { PersonaState, PersonaVariant };

/**
 * The Rive runtime lives behind a dynamic import — `@rive-app/react-webgl2`
 * declares no `sideEffects`, so a static import would put the whole WebGL2
 * runtime and its `.wasm` in every consumer's entry chunk, `Persona` rendered or
 * not. `RiveParameters` above is a TYPE import and erases. See ADR 0019.
 */
const PersonaRive = lazy(() => import("./_persona-rive"));

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
  onLoad?: RiveParameters["onLoad"];
  onLoadError?: RiveParameters["onLoadError"];
  onPause?: RiveParameters["onPause"];
  onPlay?: RiveParameters["onPlay"];
  onReady?: () => void;
  onStop?: RiveParameters["onStop"];
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

    const handleLoadError = useCallback<NonNullable<RiveParameters["onLoadError"]>>(
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
