/**
 * The `yaml` parser's error codes as plain sentences (wave-2 review m5). Its own messages
 * are written for YAML implementers ("Nested mappings are not allowed in compact
 * mappings"); these say what to change. Straight-quoted segments are syntax, which the
 * Problems list sets as inline code. React-free.
 *
 * Every code `yaml` 2.9.1 declares in `ErrorCode` and emits from `dist/**` (all 23 appear
 * at an `onError(…)` / `new YAMLParseError(…)` site); `Record<ErrorCode, …>` fails
 * `typecheck:local` when an upgrade adds one.
 */
import type { ErrorCode } from "yaml";

const YAML_CODE_MESSAGE: Record<ErrorCode, string> = {
  ALIAS_PROPS: 'An alias ("*name") cannot also carry an anchor or a tag.',
  BAD_ALIAS: "This anchor or alias name is empty or ends in a colon; give it a plain name.",
  BAD_DIRECTIVE: 'This "%" directive line is not understood; remove it.',
  BAD_DQ_ESCAPE:
    'This double-quoted value has an unknown backslash escape; write "\\\\" for a backslash, or use single quotes.',
  BAD_INDENT:
    "The indentation is off here; line this up with the other keys or items at its level.",
  BAD_PROP_ORDER: 'An anchor or a tag must come after the "-" or "?" in front of it.',
  BAD_SCALAR_START: "A plain value cannot start with this character; put the value in quotes.",
  BLOCK_AS_IMPLICIT_KEY:
    'This line has a second "key: value" inside a value; quote the value, or move the nested part onto its own indented lines.',
  BLOCK_IN_FLOW:
    'A "{ … }" or "[ … ]" value cannot contain indented lines; write it on one line, or use indented lines throughout.',
  DUPLICATE_KEY: "This key appears twice in the same mapping; keys must be unique.",
  IMPOSSIBLE: "The YAML parser could not read this spot; check the lines around it.",
  KEY_OVER_1024_CHARS: "This key is longer than 1024 characters; shorten it.",
  MISSING_CHAR:
    "Something is missing here: a closing quote or bracket, a comma, a space after a colon, or a value after a key.",
  MULTILINE_IMPLICIT_KEY:
    "A key must fit on one line; check this line and the one above for a missing colon or closing quote.",
  MULTIPLE_ANCHORS: 'A value can carry only one anchor ("&name").',
  MULTIPLE_DOCS: 'The file holds more than one YAML document; remove the extra "---" line.',
  MULTIPLE_TAGS: 'A value can carry only one tag ("!name").',
  NON_STRING_KEY: "A key must be plain text, not a mapping or a list.",
  RESOURCE_EXHAUSTION:
    "Aliases expand to too much data here; remove the nested or repeated aliases.",
  TAB_AS_INDENT: "Tabs cannot indent YAML; indent with spaces.",
  TAG_RESOLVE_FAILED: 'This tag ("!name") is unknown here; remove it.',
  UNEXPECTED_TOKEN: "Something unexpected is here; check for a stray bracket, comma or colon.",
  BAD_COLLECTION_TYPE: "This tag does not fit the kind of value it is on; remove it.",
};

/** A finer sentence for the `MISSING_CHAR` case with a single obvious fix (an unknown tag gets its name, below). */
const MISSING_QUOTE = "This quoted value has no closing quote.";

/** "Map keys must be unique at line 4, column 5:\n…" → "Map keys must be unique." (fallback only). */
function firstLine(message: string): string {
  return `${(message.split("\n")[0] ?? message).replace(/ at line \d+, column \d+:?$/, "")}.`;
}

/** One `yaml` parse error or warning → the sentence shown in the Problems list and the marker. */
export function yamlIssueMessage(code: string, message: string): string {
  if (code === "MISSING_CHAR" && /^Missing closing ['"]quote/.test(message)) return MISSING_QUOTE;
  const tag =
    code === "TAG_RESOLVE_FAILED" ? /^Unresolved tag: (\S+)/.exec(message)?.[1] : undefined;
  if (tag !== undefined && !tag.includes('"'))
    return `The tag "${tag}" is unknown here; remove it.`;
  return Object.hasOwn(YAML_CODE_MESSAGE, code)
    ? YAML_CODE_MESSAGE[code as ErrorCode]
    : firstLine(message);
}
