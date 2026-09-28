import { parseDocument } from "yaml";
import { profileIssues } from "./profile-schema";
import type { StyleIssue, StyleProfile } from "./types";
export const MAX_PROFILE_BYTES = 64_000;
export const MAX_PROFILE_DEPTH = 8;
export const MAX_PROFILES = 32;
const ID = /^[a-z][a-z\d-]{0,63}$/;
function merge(base: unknown, patch: unknown): unknown {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) return structuredClone(patch);
  const result = {
    ...(base && typeof base === "object" && !Array.isArray(base) ? base : {}),
  } as Record<string, unknown>;
  for (const [key, value] of Object.entries(patch)) result[key] = merge(result[key], value);
  return result;
}
export function loadProfiles(sources: ReadonlyMap<string, string>): {
  profiles: ReadonlyMap<string, StyleProfile>;
  issues: StyleIssue[];
} {
  const issues: StyleIssue[] = [];
  const parsed = new Map<string, Record<string, unknown>>();
  const profiles = new Map<string, StyleProfile>();
  const fail = (source: string, message: string, path: (string | number)[] = []) =>
    issues.push({ code: "style-profile", source, path, message });
  if (sources.size > MAX_PROFILES) {
    fail("profiles", `At most ${MAX_PROFILES} profiles are allowed.`);
    return { profiles, issues };
  }
  for (const [id, text] of sources) {
    if (!ID.test(id)) {
      fail(id, "Invalid profile identifier.");
      continue;
    }
    if (text.length > MAX_PROFILE_BYTES) {
      fail(id, "Profile exceeds the size limit.");
      continue;
    }
    try {
      const doc = parseDocument(text, { uniqueKeys: true });
      if (doc.errors.length) {
        fail(id, doc.errors[0]!.message);
        continue;
      }
      const value = doc.toJS({ maxAliasCount: 50 }) as unknown;
      const errors = profileIssues(value, true);
      if (errors.length) {
        issues.push(...errors.map((error) => ({ ...error, source: id })));
        continue;
      }
      const data = value as Record<string, unknown>;
      if (
        data.profile !== id ||
        data.schemaVersion !== 1 ||
        !["technical", "visual"].includes(String(data.lens))
      ) {
        fail(id, "Each profile must declare its matching identifier, schemaVersion: 1 and lens.");
        continue;
      }
      parsed.set(id, data);
    } catch (error) {
      fail(id, error instanceof Error ? error.message : "Invalid profile YAML.");
    }
  }
  function resolve(id: string, chain: string[]): StyleProfile | undefined {
    if (chain.includes(id)) {
      fail(id, `Profile inheritance cycle: ${[...chain, id].join(" → ")}.`, ["extends"]);
      return;
    }
    if (chain.length >= MAX_PROFILE_DEPTH) {
      fail(id, `Profile inheritance exceeds ${MAX_PROFILE_DEPTH} levels.`, ["extends"]);
      return;
    }
    const data = parsed.get(id);
    if (!data) {
      fail(id, "Profile is missing or invalid.");
      return;
    }
    let value: unknown = data;
    if (typeof data.extends === "string") {
      const parent = resolve(data.extends, [...chain, id]);
      if (!parent) return;
      if (parent.lens !== data.lens) {
        fail(id, "A profile can only extend a profile for the same lens.", ["extends"]);
        return;
      }
      value = merge(parent, data);
    }
    const errors = profileIssues(value);
    if (errors.length) {
      issues.push(...errors.map((error) => ({ ...error, source: id })));
      return;
    }
    const profile = structuredClone(value) as StyleProfile;
    profiles.set(id, profile);
    return profile;
  }
  for (const id of parsed.keys()) resolve(id, []);
  return { profiles, issues };
}
