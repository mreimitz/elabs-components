import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, type RefObject } from "react";
import { Panel } from "@elabs-ai/components-flow";
import { Button, IconButton, Text, cn } from "@elabs-ai/components-ui";
import { ChevronLeft, ChevronRight, ListOrdered, X } from "lucide-react";
import { useHash } from "../routes/use-hash";
import { useDiagram } from "../state/diagram-store";
import { interactionActions, useInteraction } from "./interaction-store";
import { isPresenting } from "./presentation-mode";
import { walkSteps, type WalkStep } from "./steps";

/** The player's strings, in one place (`conventions/i18n-strings`). */
const STEP_LABELS = {
  region: "Step-through",
  start: (count: number) => `Walk through ${count} ${count === 1 ? "step" : "steps"}`,
  previous: "Previous step",
  next: "Next step",
  end: "End walk-through",
  position: (index: number, count: number) => `Step ${index} of ${count}`,
  to: "to",
  /** The caption as one line: the tooltip of a caption the player clamps. */
  caption: (step: WalkStep) =>
    step.flows
      .map((flow) => `${flow.label ? `${flow.label}: ` : ""}${flow.from} → ${flow.to}`)
      .join("; "),
} as const;

/** The floating-surface look of the canvas chrome (`TitleBlock`, `DiagramLegend`). */
const SURFACE = "rounded-lg bg-surface-elevated/90 text-meta shadow-ring-sm backdrop-blur";

/** Keys that step: arrows, and Page Up / Page Down (what a presentation clicker sends). */
function keyDelta(key: string): 1 | -1 | 0 {
  if (key === "ArrowRight" || key === "PageDown") return 1;
  if (key === "ArrowLeft" || key === "PageUp") return -1;
  return 0;
}

/** Keys typed into these stay theirs (a node moved by arrow keys, a field). */
const KEEP_KEYS =
  ".react-flow__node, .react-flow__edge, input, textarea, select, [contenteditable]";

/** The legend (bottom-left) and the zoom controls (bottom-right): the player sits between them. */
const SIDE_PANELS = ".react-flow__panel.bottom.left, .react-flow__panel.bottom.right";
/** Room (px) kept between the walking player and each side panel. */
const SIDE_GAP = 8;

/**
 * Review-wave3 (player): caps the walking player (`--step-player-room` on `surface`) at twice
 * the room between the pane's centre, where flow centres the panel, and the nearer side panel.
 * With the inspector open at 1440 the pane is 685 px and the open legend 174 px, so a
 * shrink-to-fit player ran 3 px into the legend. Measured while walking only; it changes when
 * the pane or a side panel does, never between steps.
 */
function useSideRoom(surface: RefObject<HTMLDivElement | null>, walking: boolean) {
  useLayoutEffect(() => {
    const el = surface.current;
    const pane = el?.closest<HTMLElement>(".react-flow");
    if (!el || !pane || !walking) return;
    const sides = [...pane.querySelectorAll<HTMLElement>(SIDE_PANELS)];
    const measure = () => {
      const box = pane.getBoundingClientRect();
      const centre = box.left + box.width / 2;
      let half = box.width / 2;
      for (const side of sides) {
        const r = side.getBoundingClientRect();
        if (!side.isConnected || r.width === 0 || r.height === 0) continue;
        half = Math.min(half, side.classList.contains("left") ? centre - r.right : r.left - centre);
      }
      el.style.setProperty("--step-player-room", `${Math.max(0, 2 * (half - SIDE_GAP))}px`);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(pane);
    for (const side of sides) observer.observe(side);
    return () => observer.disconnect();
  }, [surface, walking]);
}

function StepCaption({ step }: { step: WalkStep }) {
  return (
    <>
      {step.flows.map((flow, index) => (
        <Fragment key={flow.id}>
          {index > 0 ? "; " : null}
          {flow.label ? `${flow.label}: ` : null}
          {flow.from} <span aria-hidden="true">→</span>
          <span className="sr-only">{STEP_LABELS.to}</span> {flow.to}
        </Fragment>
      ))}
    </>
  );
}

/**
 * DG-18 — steps through the numbered flows (`step:`, plan D9). The current step's flows
 * are drawn wider, every other flow and node dimmed (`DataFlowEdge`, `useCanvasInteraction`),
 * and the caption names the step's flows in a polite live region. View-only: the step is
 * never written to the text. Arrow keys step while focus is in the player; in presentation
 * mode they (and Page Up / Page Down) step from anywhere but a node, an edge or a field.
 */
export function StepPlayer() {
  const graph = useDiagram((s) => s.drawn.graph);
  const steps = useMemo(() => (graph ? walkSteps(graph) : []), [graph]);
  const step = useInteraction((s) => s.step);
  const presenting = isPresenting(useHash());
  const index = step === null ? -1 : steps.findIndex((entry) => entry.step === step);
  const current = index === -1 ? undefined : steps[index];
  const surfaceRef = useRef<HTMLDivElement>(null);
  useSideRoom(surfaceRef, current !== undefined);
  const startRef = useRef<HTMLButtonElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  // The control that takes focus after the player swaps its controls (start ↔ walking).
  const focusNext = useRef<"start" | "next" | null>(null);

  // A step the text no longer has (an edit, another document) ends the walk.
  useEffect(() => {
    if (step !== null && index === -1) interactionActions.setStep(null);
  }, [step, index]);

  useEffect(() => {
    const target = focusNext.current === "start" ? startRef : nextRef;
    if (focusNext.current !== null) target.current?.focus();
    focusNext.current = null;
  }, [current]);

  const move = (delta: 1 | -1) => {
    const to = index === -1 ? (delta === 1 ? 0 : -1) : index + delta;
    const next = steps[to];
    if (next) interactionActions.setStep(next.step);
  };

  const end = () => {
    focusNext.current = "start";
    interactionActions.setStep(null);
  };

  // Presentation mode: step from anywhere. The player's own `onKeyDown` runs first (React's
  // root listener) and marks the event handled, so one key press never steps twice.
  const moveRef = useRef(move);
  moveRef.current = move;
  useEffect(() => {
    if (!presenting) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const delta = keyDelta(event.key);
      const target = event.target instanceof Element ? event.target : null;
      if (delta === 0 || event.defaultPrevented || target?.closest(KEEP_KEYS)) return;
      event.preventDefault();
      moveRef.current(delta);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [presenting]);

  if (steps.length === 0) return null;
  const first = index === 0;
  const last = index === steps.length - 1;

  return (
    <Panel
      position="bottom-center"
      role="group"
      aria-label={STEP_LABELS.region}
      data-slot="step-player"
      data-diagram-export="exclude"
      className="pointer-events-none"
      onKeyDown={(event) => {
        const delta = keyDelta(event.key);
        if (delta === 0) return;
        event.preventDefault();
        move(delta);
      }}
    >
      {/* While presenting, the way out (`InteractionOverlays`) sits bottom-centre too, so the
          player rises above it: 13 = its button's height plus a 2 gap, over the panel's own
          15 px margin. The margin is on the surface, not the panel: flow's unlayered
          `margin: 15px` wins over a utility there (docs/findings/DG-18-interactive-layer.md
          §7). The panel itself lets the pointer through, so its empty margin never covers the
          controls beside it.
          On a narrow pane (under `@2xl`, 672 px) the player also cannot sit between the legend
          (bottom-left) and the zoom controls (bottom-right); flow centres the panel with
          `left: 50%` and a translate, so a shrink-to-fit surface there got at most half of the
          pane (the counter wrapped, the caption was cut). Under `@2xl` the surface instead
          takes the pane's width less the panel's margins, and the words take the room between
          the buttons. */}
      <div
        ref={surfaceRef}
        className={cn(
          "pointer-events-auto flex max-w-[min(36rem,calc(100vw-2rem),var(--step-player-room,36rem))] items-center gap-1 p-1 @max-2xl:w-[calc(100cqw-2rem)] @max-2xl:max-w-none",
          presenting && "mb-13",
          SURFACE,
        )}
      >
        {current ? (
          <>
            {/* `aria-disabled`, not `disabled`: a disabled button drops the focus it holds. */}
            <IconButton
              label={STEP_LABELS.previous}
              icon={<ChevronLeft />}
              variant="ghost"
              size="icon-sm"
              aria-disabled={first}
              className="aria-disabled:opacity-50"
              onClick={() => move(-1)}
            />
            {/* Review-wave3 (player): the surface shrank to the current caption, so its width
                changed every step and Previous / Next moved under the pointer. Every step's
                words sit in one grid cell, only the current step's shown: the surface takes
                the widest step's width (and the tallest's height, clamped) for the whole walk.
                Its box changes only at walk start and end, which is when the canvas re-fits
                around it (`panes/canvas-pane.tsx`). */}
            <div className="grid min-w-0 px-1 @max-2xl:flex-1">
              {steps.map((entry, at) => (
                <div
                  key={entry.step}
                  className={cn(
                    "col-start-1 row-start-1 flex min-w-0 flex-col",
                    at !== index && "invisible",
                  )}
                >
                  <Text variant="meta" as="span" className="font-medium tabular-nums">
                    {STEP_LABELS.position(at + 1, steps.length)}
                  </Text>
                  <Text
                    variant="meta"
                    tone="muted"
                    as="span"
                    className="line-clamp-2 break-words"
                    title={STEP_LABELS.caption(entry)}
                  >
                    <StepCaption step={entry} />
                  </Text>
                </div>
              ))}
            </div>
            <IconButton
              ref={nextRef}
              label={STEP_LABELS.next}
              icon={<ChevronRight />}
              variant="ghost"
              size="icon-sm"
              aria-disabled={last}
              className="aria-disabled:opacity-50"
              onClick={() => move(1)}
            />
            <IconButton
              label={STEP_LABELS.end}
              icon={<X />}
              variant="ghost"
              size="icon-sm"
              onClick={end}
            />
          </>
        ) : (
          <Button
            ref={startRef}
            variant="ghost"
            size="sm"
            onClick={() => {
              focusNext.current = "next";
              move(1);
            }}
          >
            <ListOrdered aria-hidden="true" />
            {STEP_LABELS.start(steps.length)}
          </Button>
        )}
        {/* Always mounted, so the first step is announced too. */}
        <span className="sr-only" aria-live="polite">
          {current ? (
            <>
              {STEP_LABELS.position(index + 1, steps.length)}: <StepCaption step={current} />
            </>
          ) : null}
        </span>
      </div>
    </Panel>
  );
}
