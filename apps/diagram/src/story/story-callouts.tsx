import { useReactFlow } from "@elabs-ai/components-flow";
// P4: viewport portal is the supported React Flow projection seam, not re-exported by flow.
import { ViewportPortal } from "@xyflow/react";
import { visibleStoryTarget } from "./visible-targets";
import { useStory } from "./story-store";

/** Numbered pins keep lengthy prose in the bounded caption, outside the moving graph. */
export function StoryCallouts() {
  const { getInternalNode, getNodes } = useReactFlow();
  const step = useStory((s) => (s.index === null ? undefined : s.story.steps[s.index]));
  if (!step?.callouts.length) return null;
  return (
    <ViewportPortal>
      <div
        data-diagram-export="exclude"
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
      >
        {step.callouts.map((callout, index) => {
          const visible = visibleStoryTarget(callout.at, getNodes());
          const node = visible ? getInternalNode(visible.id) : undefined;
          if (!node || node.hidden) return null;
          const { x, y } = node.internals.positionAbsolute;
          const width = node.measured.width ?? node.width ?? 0;
          return (
            <div
              key={`${callout.at}:${index}`}
              className="absolute flex flex-col items-center"
              style={{ left: x + width / 2 - 12, top: y - 36 }}
            >
              <span className="flex size-6 items-center justify-center rounded-full border border-primary bg-primary text-meta font-semibold text-primary-foreground">
                {index + 1}
              </span>
              <span className="h-3 border-s border-primary" />
            </div>
          );
        })}
      </div>
    </ViewportPortal>
  );
}
