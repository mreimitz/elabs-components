"use client";

/**
 * The Rive half of `Persona`, split out so it can be `lazy()`-loaded.
 *
 * `@rive-app/react-webgl2` declares no `sideEffects`, so a static import from
 * `persona.tsx` put the whole WebGL2 runtime (and its `rive.wasm`) into the entry
 * chunk of every `@elabs-ai/components-ai` consumer — including the vast majority that never
 * render a `Persona`. Keeping every Rive *value* import in this module, reached
 * only through `lazy(() => import("./_persona-rive"))`, confines it to its own
 * chunk. `persona.tsx` may still `import type` from Rive (types erase).
 *
 * See ADR 0019 and `pnpm heavy-deps:check`.
 *
 * @lazy-boundary This module must only ever be reached via `import()`. The gate
 * fails if anything imports it statically, which would put Rive back in the
 * entry chunk and make the `lazy()` pointless.
 */
import { cn } from "@elabs-ai/components-ui/lib/cn";
import { useReducedMotion } from "@elabs-ai/components-tokens";
import type { RiveParameters } from "@rive-app/react-webgl2";
// A NAMED import (`import { useRive } from "@rive-app/react-webgl2"`) is a
// static ESM binding a bundler must resolve at build time. Now that
// `@rive-app/react-webgl2` is a genuinely optional peer (issue #33), a
// consumer who has not installed it hits that resolution at the worst
// possible time: Vite's own optional-peer-dependency handling swaps in a
// build-time stub with no exports, and Rollup's static named-export check
// then fails the WHOLE APP BUILD — not a runtime error `LazyEngineBoundary`
// could ever see (confirmed against `fixtures/consumer-smoke`'s real Vite
// build). A namespace import defers every one of these to a plain property
// lookup, which Rollup does not statically validate, so the build always
// succeeds; a genuinely missing peer instead resolves the destructured hooks
// below to `undefined`, and the guard turns that into the render-phase throw
// `LazyEngineBoundary` (see `persona.tsx`) already catches.
import * as RiveModule from "@rive-app/react-webgl2";
import type { ReactNode } from "react";
import { memo, useEffect, useMemo, useRef, useState } from "react";

import type { PersonaSource, PersonaState } from "./persona-sources";

const {
  useRive,
  useStateMachineInput,
  useViewModel,
  useViewModelInstance,
  useViewModelInstanceColor,
} = RiveModule;

if (!useRive) {
  throw new Error("Cannot find module '@rive-app/react-webgl2'");
}

// Delays Rive initialization by one frame so that React Strict Mode's
// immediate unmount cycle never creates a WebGL2 context. Only the
// second (real) mount will initialise, avoiding context exhaustion.
const useStrictModeSafeInit = () => {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => {
      cancelAnimationFrame(id);
      setReady(false);
    };
  }, []);

  return ready;
};

// The state machine name is always 'default' for Elements AI visuals
const stateMachine = "default";

const getCurrentTheme = (): "light" | "dark" => {
  if (typeof window !== "undefined") {
    if (document.documentElement.classList.contains("dark")) {
      return "dark";
    }
    if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
      return "dark";
    }
  }
  return "light";
};

const useTheme = (enabled: boolean) => {
  const [theme, setTheme] = useState<"light" | "dark">(getCurrentTheme);

  useEffect(() => {
    // Skip if not enabled (avoids unnecessary observers for non-dynamic-color variants)
    if (!enabled) {
      return;
    }

    // Watch for classList changes
    const observer = new MutationObserver(() => {
      setTheme(getCurrentTheme());
    });

    observer.observe(document.documentElement, {
      attributeFilter: ["class"],
      attributes: true,
    });

    // Watch for OS-level theme changes
    let mql: MediaQueryList | null = null;
    const handleMediaChange = () => {
      setTheme(getCurrentTheme());
    };

    if (window.matchMedia) {
      mql = window.matchMedia("(prefers-color-scheme: dark)");
      mql.addEventListener("change", handleMediaChange);
    }

    return () => {
      observer.disconnect();
      if (mql) {
        mql.removeEventListener("change", handleMediaChange);
      }
    };
  }, [enabled]);

  return theme;
};

interface PersonaWithModelProps {
  rive: ReturnType<typeof useRive>["rive"];
  source: PersonaSource;
  children: ReactNode;
}

const PersonaWithModel = memo(({ rive, source, children }: PersonaWithModelProps) => {
  const theme = useTheme(source.dynamicColor);
  const viewModel = useViewModel(rive, { useDefault: true });
  const viewModelInstance = useViewModelInstance(viewModel, {
    rive,
    useDefault: true,
  });
  const viewModelInstanceColor = useViewModelInstanceColor("color", viewModelInstance);

  useEffect(() => {
    if (!(viewModelInstanceColor && source.dynamicColor)) {
      return;
    }

    const [r, g, b] = theme === "dark" ? [255, 255, 255] : [0, 0, 0];
    viewModelInstanceColor.setRgb(r, g, b);
  }, [viewModelInstanceColor, theme, source.dynamicColor]);

  return children;
});

PersonaWithModel.displayName = "PersonaWithModel";

const PersonaWithoutModel = memo(({ children }: { children: ReactNode }) => children);

PersonaWithoutModel.displayName = "PersonaWithoutModel";

export interface PersonaRiveProps {
  className?: string;
  onLoad?: RiveParameters["onLoad"];
  onLoadError?: RiveParameters["onLoadError"];
  onPause?: RiveParameters["onPause"];
  onPlay?: RiveParameters["onPlay"];
  onReady?: () => void;
  onStop?: RiveParameters["onStop"];
  source: PersonaSource;
  /** Resolved `.riv` URL — `Persona`'s `src` override, or the variant default. */
  src: string;
  state: PersonaState;
}

const PersonaRive = ({
  className,
  onLoad,
  onLoadError,
  onPause,
  onPlay,
  onReady,
  onStop,
  source,
  src,
  state,
}: PersonaRiveProps) => {
  // Stabilize callbacks to prevent useRive from reinitializing
  const callbacksRef = useRef({ onLoad, onLoadError, onPause, onPlay, onReady, onStop });

  useEffect(() => {
    callbacksRef.current = { onLoad, onLoadError, onPause, onPlay, onReady, onStop };
  }, [onLoad, onLoadError, onPause, onPlay, onReady, onStop]);

  const stableCallbacks = useMemo(
    () => ({
      onLoad: ((loadedRive) =>
        callbacksRef.current.onLoad?.(loadedRive)) as RiveParameters["onLoad"],
      onLoadError: ((err) =>
        callbacksRef.current.onLoadError?.(err)) as RiveParameters["onLoadError"],
      onPause: ((event) => callbacksRef.current.onPause?.(event)) as RiveParameters["onPause"],
      onPlay: ((event) => callbacksRef.current.onPlay?.(event)) as RiveParameters["onPlay"],
      onReady: () => callbacksRef.current.onReady?.(),
      onStop: ((event) => callbacksRef.current.onStop?.(event)) as RiveParameters["onStop"],
    }),
    [],
  );

  // Delay initialisation by one frame to avoid creating (and leaking)
  // a WebGL2 context during React Strict Mode's first throw-away mount.
  const ready = useStrictModeSafeInit();
  const prefersReducedMotion = useReducedMotion();

  const { rive, RiveComponent } = useRive(
    ready
      ? {
          autoplay: !prefersReducedMotion,
          onLoad: stableCallbacks.onLoad,
          onLoadError: stableCallbacks.onLoadError,
          onPause: stableCallbacks.onPause,
          onPlay: stableCallbacks.onPlay,
          onRiveReady: stableCallbacks.onReady,
          onStop: stableCallbacks.onStop,
          src,
          stateMachines: stateMachine,
        }
      : null,
  );

  // `autoplay` only governs the INITIAL mount — honor a mid-session
  // reduced-motion preference change by pausing/resuming the running
  // instance. The state-machine inputs below keep updating either way, so
  // the artwork still shows the correct resting pose while paused.
  useEffect(() => {
    if (!rive) return;
    if (prefersReducedMotion) {
      rive.pause();
    } else {
      rive.play();
    }
  }, [rive, prefersReducedMotion]);

  const listeningInput = useStateMachineInput(rive, stateMachine, "listening");
  const thinkingInput = useStateMachineInput(rive, stateMachine, "thinking");
  const speakingInput = useStateMachineInput(rive, stateMachine, "speaking");
  const asleepInput = useStateMachineInput(rive, stateMachine, "asleep");

  // Rive state machine inputs are mutable objects that must be set via direct
  // property assignment — this is the intended Rive API, not a React anti-pattern.
  useEffect(() => {
    if (listeningInput) {
      listeningInput.value = state === "listening";
    }
    if (thinkingInput) {
      thinkingInput.value = state === "thinking";
    }
    if (speakingInput) {
      speakingInput.value = state === "speaking";
    }
    if (asleepInput) {
      asleepInput.value = state === "asleep";
    }
  }, [state, listeningInput, thinkingInput, speakingInput, asleepInput]);

  const Wrapper = source.hasModel ? PersonaWithModel : PersonaWithoutModel;

  return (
    <Wrapper rive={rive} source={source}>
      <RiveComponent className={cn("size-16 shrink-0", className)} />
    </Wrapper>
  );
};

export default PersonaRive;
