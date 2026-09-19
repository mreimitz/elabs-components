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

let live: Promise<Set<string> | null> | null = null;
function liveIds(): Promise<Set<string> | null> {
  live ??= fetch("/storybook/index.json")
    .then((res) => (res.ok ? (res.json() as Promise<{ entries?: Record<string, unknown> }>) : null))
    .then((json) => (json?.entries ? new Set(Object.keys(json.entries)) : null))
    .catch(() => null);
  return live;
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
