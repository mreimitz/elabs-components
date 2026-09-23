"use client";
/**
 * story-alias.ts — which story id to embed while a retitle is waiting for a Storybook deploy.
 *
 * A page retitled in the repo gets a new story id the moment it is renamed, but the deployed
 * Storybook keeps serving the old one until its next release. The generator records both
 * (content/generated/story-aliases.json); this asks the live Storybook which of the two it has.
 * Ids with no alias resolve synchronously and never trigger the lookup.
 */
import { useEffect, useState } from "react";
import aliasJson from "../content/generated/story-aliases.json";

const ALIASES = aliasJson as Record<string, string>;

/**
 * Whether the site can reach its Storybook at all: `/storybook/` is a rewrite to another origin
 * (`next.config.ts`), and a site started against a Storybook that is not running answers 500 for
 * every story — in development, most often a `STORYBOOK_ORIGIN` whose server was stopped.
 */
export type StorybookReach = "unknown" | "ok" | "unreachable";

let live: Promise<Set<string> | null> | null = null;
let reach: StorybookReach = "unknown";
function liveIds(): Promise<Set<string> | null> {
  live ??= fetch("/storybook/index.json")
    .then((res) => {
      reach = res.ok ? "ok" : "unreachable";
      return res.ok ? (res.json() as Promise<{ entries?: Record<string, unknown> }>) : null;
    })
    .then((json) => (json?.entries ? new Set(Object.keys(json.entries)) : null))
    .catch(() => {
      reach = "unreachable";
      return null;
    });
  return live;
}

/** `"unknown"` until the index answers; `"unreachable"` when `/storybook/` cannot be served. */
export function useStorybookReach(): StorybookReach {
  const [state, setState] = useState<StorybookReach>(reach);
  useEffect(() => {
    let cancelled = false;
    void liveIds().then(() => {
      if (!cancelled) setState(reach);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return state;
}

function has(ids: Set<string>, id: string): boolean {
  const alias = ALIASES[id];
  return ids.has(id) || (alias !== undefined && ids.has(alias));
}

/**
 * Which of `ids` the live Storybook does not have (a working tree ahead of the last release).
 * `null` until the index answers; an unreachable index reports nothing missing, so each frame
 * decides for itself.
 */
export function useMissingStories(ids: readonly string[]): string[] | null {
  const key = ids.join("\n");
  const [missing, setMissing] = useState<string[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    void liveIds().then((index) => {
      if (cancelled) return;
      setMissing(index ? key.split("\n").filter((id) => id && !has(index, id)) : []);
    });
    return () => {
      cancelled = true;
    };
  }, [key]);
  return missing;
}

/** The id to embed, or `null` for the moment an aliased id is still being resolved. */
export function useStoryId(id: string): string | null {
  const alias = ALIASES[id];
  const [resolved, setResolved] = useState<string | null>(alias ? null : id);
  useEffect(() => {
    if (!alias) return setResolved(id);
    let cancelled = false;
    setResolved(null);
    void liveIds().then((ids) => {
      if (cancelled) return;
      setResolved(ids && !ids.has(id) && ids.has(alias) ? alias : id);
    });
    return () => {
      cancelled = true;
    };
  }, [id, alias]);
  return resolved;
}
