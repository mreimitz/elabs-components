/**
 * The one initials rule for an `AvatarFallback`: the first character of the
 * first two whitespace-separated words, upper-cased — “Mara Osei” → “MO”,
 * “priya” → “P”, an e-mail → its first character. Empty input gives an empty
 * string (render a glyph instead). Lives in ui so no block or package keeps
 * its own copy of the split/map/slice chain.
 */
export function initialsOf(name: string, max = 2): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, max)
    .map((part) => Array.from(part)[0] ?? "")
    .join("")
    .toUpperCase();
}
