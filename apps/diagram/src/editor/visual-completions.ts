import { parseDocument } from "yaml";

/** Read identifiers from the live buffer, including an unfinished flow or box. */
export function visualIds(
  text: string,
  collection: "lanes" | "boxes",
): { id: string; title: string }[] {
  try {
    const raw = parseDocument(text).toJS();
    const items = raw?.visual?.[collection];
    if (!Array.isArray(items)) return [];
    const seen = new Set<string>();
    return items.flatMap((item) => {
      if (!item || typeof item.id !== "string" || seen.has(item.id)) return [];
      seen.add(item.id);
      return [{ id: item.id, title: typeof item.title === "string" ? item.title : item.id }];
    });
  } catch {
    return [];
  }
}
