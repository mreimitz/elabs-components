import { useEffect, useRef } from "react";
import { Panel } from "@elabs-ai/components-flow";
import { Button, IconButton, Slider, Text } from "@elabs-ai/components-ui";
import { StoryMarkdown } from "./story-markdown";
import { useStoryRoom } from "./use-story-room";
import { ChevronLeft, ChevronRight, Maximize2, Pause, Play, X } from "lucide-react";
import { navigate, parseRoute } from "../routes/use-hash";
import { lensActions } from "../shell/lens-store";
import { storyActions, storyStore, useStory } from "./story-store";

const LABELS = {
  region: "Story",
  previous: "Previous step",
  next: "Next step",
  end: "End story",
  play: "Play story",
  pause: "Pause story",
  present: "Present story",
  progress: "Step progress",
  caption: "Step description",
  technical: "Play story in technical view",
};
const KEEP_KEYS =
  '.react-flow__node,.react-flow__edge,input,textarea,select,[contenteditable],[role="slider"],[role="dialog"],[role="menu"],[role="listbox"]';
export function handleStoryKey(event: KeyboardEvent): boolean {
  if (
    event.defaultPrevented ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    (event.target instanceof Element &&
      (event.target.closest(KEEP_KEYS) ||
        (event.key !== "Escape" && event.target.closest('[data-slot="story-caption"]'))))
  )
    return false;
  if (document.querySelector('[role="dialog"][data-state="open"],[role="menu"][data-state="open"]'))
    return false;
  if (event.key === " " && event.target instanceof Element && event.target.closest("button,a"))
    return false;
  const state = storyStore.get();
  if (state.index === null) return false;
  const action =
    event.key === "Escape"
      ? storyActions.end
      : event.key === "ArrowRight" || event.key === "PageDown"
        ? () => storyActions.move(1)
        : event.key === "ArrowLeft" || event.key === "PageUp"
          ? () => storyActions.move(-1)
          : event.key === "Home"
            ? () => storyActions.go(0)
            : event.key === "End"
              ? () => storyActions.go(state.story.steps.length - 1)
              : event.key === " "
                ? state.playing
                  ? storyActions.pause
                  : storyActions.play
                : null;
  if (!action) return false;
  event.preventDefault();
  action();
  return true;
}

export function StoryBar({ visual = false }: { visual?: boolean }) {
  const state = useStory((s) => s);
  const step = state.index === null ? undefined : state.story.steps[state.index];
  const start = useRef<HTMLButtonElement>(null);
  const play = useRef<HTMLButtonElement>(null);
  const focus = useRef(false);
  const surface = useRef<HTMLDivElement>(null);
  const caption = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (caption.current) caption.current.scrollTop = 0;
  }, [step]);
  useStoryRoom(surface, state.story.steps.length > 0);
  useEffect(() => {
    if (!focus.current) return;
    (step ? play : start).current?.focus();
    focus.current = false;
  }, [step]);
  useEffect(() => {
    if (visual) return;
    // Capture precedes the shell/presentation Escape handlers; overlays and fields keep keys.
    const handle = (event: KeyboardEvent) => {
      const ending = event.key === "Escape" && storyStore.get().index !== null;
      if (ending) focus.current = true;
      if (!handleStoryKey(event) && ending) focus.current = false;
    };
    window.addEventListener("keydown", handle, true);
    return () => window.removeEventListener("keydown", handle, true);
  }, [visual]);
  if (!state.story.steps.length) return null;
  return (
    <Panel
      position="bottom-center"
      data-slot="step-player"
      data-diagram-export="exclude"
      className="pointer-events-none"
      role="region"
      aria-label={LABELS.region}
    >
      <div
        ref={surface}
        data-slot="story-bar"
        className="pointer-events-auto mb-[var(--story-bottom,0px)] w-[var(--story-room,min(32rem,calc(100cqw-2rem)))] overflow-hidden rounded-lg bg-surface-elevated text-foreground shadow-ring-sm"
      >
        {visual ? (
          <Button
            className="h-10 w-full"
            variant="ghost"
            size="sm"
            onClick={() => {
              storyActions.requestTechnical();
              lensActions.setLens("technical");
            }}
          >
            {LABELS.technical}
          </Button>
        ) : !step ? (
          <Button
            ref={start}
            variant="ghost"
            size="sm"
            className="h-10 w-full"
            onClick={() => {
              focus.current = true;
              storyActions.go(0);
            }}
          >
            <Play aria-hidden="true" />
            {`Walk through ${state.story.steps.length} ${state.story.steps.length === 1 ? "step" : "steps"}`}
          </Button>
        ) : (
          <>
            <div
              ref={caption}
              data-slot="story-caption"
              role="group"
              aria-label={LABELS.caption}
              tabIndex={0}
              className="h-32 overflow-y-auto overscroll-contain break-words px-4 pt-3 text-meta focus-ring-inset"
              aria-live="polite"
              aria-atomic="true"
            >
              <Text as="p" variant="body" className="mb-2 font-semibold">
                {step.title}
              </Text>
              {step.text ? <StoryMarkdown text={step.text} /> : null}
              {step.callouts.length > 0 ? (
                <ol className="flex list-decimal flex-col gap-1 ps-5">
                  {step.callouts.map((callout, index) => (
                    <li key={`${callout.at}:${index}`}>
                      <StoryMarkdown text={callout.text} />
                    </li>
                  ))}
                </ol>
              ) : null}
            </div>
            <div data-slot="story-progress" className="flex h-8 items-center px-4">
              <Slider
                aria-label={LABELS.progress}
                aria-valuetext={`${Math.round(state.progress * 100)} percent`}
                min={0}
                max={1}
                step={0.01}
                value={[state.progress]}
                onValueChange={([value]) => storyActions.seek(value ?? 0)}
                className="w-full"
              />
            </div>
            <div
              data-slot="story-controls"
              className="flex h-10 items-center gap-1 border-t border-border px-2"
            >
              <IconButton
                label={LABELS.previous}
                icon={<ChevronLeft />}
                variant="ghost"
                size="icon-sm"
                aria-disabled={state.index === 0}
                onClick={() => storyActions.move(-1)}
              />
              <IconButton
                ref={play}
                label={state.playing ? LABELS.pause : LABELS.play}
                icon={state.playing ? <Pause /> : <Play />}
                variant="secondary"
                size="icon-sm"
                onClick={state.playing ? storyActions.pause : storyActions.play}
              />
              <IconButton
                label={LABELS.next}
                icon={<ChevronRight />}
                variant="ghost"
                size="icon-sm"
                aria-disabled={state.index === state.story.steps.length - 1}
                onClick={() => storyActions.move(1)}
              />
              <Text
                as="span"
                variant="meta"
                className="min-w-0 flex-1 text-center tabular-nums"
              >{`Step ${(state.index ?? 0) + 1} of ${state.story.steps.length}`}</Text>
              <IconButton
                label={LABELS.present}
                icon={<Maximize2 />}
                variant="ghost"
                size="icon-sm"
                onClick={() => {
                  const route = parseRoute(location.hash);
                  if (route.kind === "doc")
                    navigate({ ...route, present: true, step: (state.index ?? 0) + 1 });
                }}
              />
              <IconButton
                label={LABELS.end}
                icon={<X />}
                variant="ghost"
                size="icon-sm"
                onClick={() => {
                  focus.current = true;
                  storyActions.end();
                }}
              />
            </div>
          </>
        )}
      </div>
    </Panel>
  );
}
