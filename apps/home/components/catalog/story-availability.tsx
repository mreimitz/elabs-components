"use client";
/**
 * story-availability — what a page shows for stories the live Storybook does not have yet.
 *
 * The site embeds Storybook; a working tree (or a site deploy) ahead of the last Storybook
 * release names stories that Storybook cannot serve. Instead of one empty stage per story, the
 * page drops those examples (`LiveExample`) and says so once (`MissingExamples`), naming them
 * and, in development, the command that builds them locally.
 */
import type { ReactNode } from "react";
import { Alert, AlertDescription, AlertTitle } from "@elabs-ai/components-ui";
import { catalogCopy } from "../../content/copy";
import { useMissingStories } from "../../lib/story-alias";

const copy = catalogCopy.frame;

/** Renders its children unless the live Storybook is known not to have the story. */
export function LiveExample({ id, children }: { id: string; children: ReactNode }) {
  const missing = useMissingStories([id]);
  return missing?.length ? null : children;
}

/** Renders its children unless the live Storybook is known to have none of `ids`. */
export function LiveSection({ ids, children }: { ids: string[]; children: ReactNode }) {
  const missing = useMissingStories(ids);
  return missing && missing.length === ids.length ? null : children;
}

/** "12 live examples", counting only the ones the live Storybook can serve. */
export function LiveExamplesCount({ ids }: { ids: string[] }) {
  const missing = useMissingStories(ids);
  return catalogCopy.detail.examplesCount(ids.length - (missing?.length ?? 0));
}

export function MissingExamples({ stories }: { stories: { id: string; name: string }[] }) {
  const missing = useMissingStories(stories.map((story) => story.id));
  if (!missing?.length) return null;
  const names = stories.filter((story) => missing.includes(story.id)).map((story) => story.name);
  return (
    <Alert role="status" data-slot="missing-examples">
      <AlertTitle>{copy.missingTitle(missing.length, stories.length)}</AlertTitle>
      <AlertDescription>
        <p>{copy.missingBody(names.join(", "))}</p>
        {process.env.NODE_ENV === "development" ? (
          <p>
            {copy.missingLocal} <code className="font-mono text-meta">{copy.missingCommand}</code>{" "}
            {copy.missingLocalTail}
          </p>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}
