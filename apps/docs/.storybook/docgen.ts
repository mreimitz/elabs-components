/**
 * Docgen hygiene — what react-docgen hands Storybook is a raw JSDoc block, and
 * two things in it reach the page as noise (2026-09-17 review §A7).
 *
 * 1. Custom block tags. `@dataShape` / `@avoidWhen` are the manifest's own
 *    vocabulary: `brand-ui docs BarChart` reads them, and the Intent block on
 *    the page renders them as "Best for" / "Avoid when". react-docgen does not
 *    know them, so it also left them in the component description, and
 *    `Charts/BarChart` opened with the literal text
 *    "@dataShape categorical comparison … @avoidWhen a time axis …".
 *    They are stripped here, once, for every component.
 *
 * 2. Bare HTML tags in prop docs. A description is rendered as Markdown, so
 *    `instead of a <button>` reaches the props table as "instead of a ." — the
 *    tag is parsed as an element and thrown away. Button's `asChild` row said
 *    exactly that. Wrapping the tag in backticks makes it literal; authors who
 *    already wrote backticks are left alone.
 */

/** Block tags this repo defines itself — meaningful to the manifest, noise on the page. */
const CUSTOM_TAGS = ["dataShape", "avoidWhen"];

const CUSTOM_TAG_RE = new RegExp(
  String.raw`^[ \t]*@(?:${CUSTOM_TAGS.join("|")})\b[^\n]*(?:\n(?![ \t]*@|\s*$)[^\n]*)*\n?`,
  "gm",
);

/** The description without this repo's own block tags (and their wrapped continuation lines). */
export function stripCustomTags(description: string): string {
  return String(description ?? "")
    .replace(CUSTOM_TAG_RE, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** `<button>`, `</form>`, `<br />` — an HTML-ish tag, lowercase first letter (never a component). */
const HTML_TAG_RE = /<\/?[a-z][a-z0-9]*(?:\s[^<>`]*?)?\/?>/g;

/**
 * Backticks every bare HTML tag, leaving existing code spans untouched — the
 * split on ` keeps odd-indexed chunks (the insides of code spans) as they are.
 */
export function backtickHtmlTags(description: string): string {
  const parts = String(description ?? "").split("`");
  for (let i = 0; i < parts.length; i += 2)
    parts[i] = (parts[i] as string).replace(HTML_TAG_RE, "`$&`");
  return parts.join("`");
}

/**
 * A color control only makes sense when the value IS a color string. The
 * matcher keys on the prop NAME, so a `color` that takes a function
 * (`(d: Datum) => string`) or a token union (`"primary" | "accent"`) used to
 * get a color picker that writes an unusable `#rrggbb` into the arg. Those
 * keep their inferred control instead (select for a union, none for a
 * function) — 2026-09-17 review §A5.
 */
export function isColorLikeType(summary: string): boolean {
  const type = String(summary ?? "").trim();
  if (!type) return true; // unknown: leave the matcher's decision alone
  if (/=>|\bfunction\b/.test(type)) return false;
  if (type.includes("|")) return false;
  return /^(string|any|unknown)$/.test(type) || /\bstring\b/.test(type);
}

type ArgType = {
  control?: { type?: string } | false;
  description?: string;
  type?: { summary?: string };
  table?: { type?: { summary?: string } };
};

/**
 * Project-level argTypes enhancer. `secondPass` puts it AFTER the framework has
 * inferred controls, so it can see (and veto) a colour control the matcher
 * produced. Storybook reads that flag off the function itself.
 */
export const enhanceArgTypes = Object.assign(
  ({ argTypes }: { argTypes: Record<string, ArgType> }) => {
    for (const argType of Object.values(argTypes ?? {})) {
      if (!argType || typeof argType !== "object") continue;
      if (typeof argType.description === "string")
        argType.description = backtickHtmlTags(argType.description);
      const control = argType.control;
      if (control && typeof control === "object" && control.type === "color") {
        const summary = argType.table?.type?.summary ?? argType.type?.summary ?? "";
        if (!isColorLikeType(summary)) argType.control = false;
      }
    }
    return argTypes;
  },
  { secondPass: true },
);
