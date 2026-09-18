/**
 * complete-json.ts — close a PARTIAL JSON document so a streaming surface can be
 * parsed and drawn before the model has finished (the A2UI counterpart of
 * `JSXPreview`'s `completeJsxTag`).
 *
 * Strategy: one linear scan tracking the bracket stack, string state and escape
 * state; then (1) close an open string, (2) drop a dangling `,` or supply `null`
 * for a dangling `"key":`, (3) close every open bracket in reverse. The result is
 * always syntactically valid JSON for any prefix of a valid document that has
 * passed its first `{`. Semantic gaps (a half-typed prop value, a node without
 * its `type` yet) are the validator's business — the renderer prunes what does
 * not validate while streaming and keeps the last good tree.
 */
export function completeJson(text: string): string {
  const stack: string[] = [];
  let inString = false;
  let escaped = false;
  // Index just after the last STRUCTURALLY complete token, so a half-typed key
  // (`{"ty`) can be cut rather than closed into `{"ty":null}`.
  let lastGood = 0;
  let lastNonWs = "";

  for (let i = 0; i < text.length; i++) {
    const ch = text[i] as string;
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') {
        inString = false;
        lastNonWs = ch;
        lastGood = i + 1;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{" || ch === "[") stack.push(ch === "{" ? "}" : "]");
    else if (ch === "}" || ch === "]") stack.pop();
    if (!/\s/.test(ch)) {
      lastNonWs = ch;
      lastGood = i + 1;
    }
  }

  let out = text;
  if (inString) {
    // Inside a value string → close it. Inside a KEY (the string follows `{` or
    // `,` inside an object) → cut it: a key without a value is not renderable.
    const top = stack[stack.length - 1];
    if (top === "}" && (lastNonWs === "{" || lastNonWs === ",")) out = text.slice(0, lastGood);
    else out = escaped ? `${text.slice(0, -1)}"` : `${text}"`;
    lastNonWs = out.trimEnd().slice(-1);
  }
  out = out.trimEnd();
  if (lastNonWs === ",") out = out.slice(0, -1);
  else if (lastNonWs === ":") out = `${out}null`;
  // A `"key"` with no colon yet (`{"type"`) is also unfinished — cut it.
  else if (lastNonWs === '"' && stack[stack.length - 1] === "}") {
    const m = /(?:^|[{,])\s*"(?:[^"\\]|\\.)*"$/.exec(out);
    if (m) out = out.slice(0, m.index + (out[m.index] === "{" || out[m.index] === "," ? 1 : 0));
  }
  out = out.replace(/,\s*$/, "");
  return out + stack.reverse().join("");
}

/**
 * Parse `text`, completing it first when `partial`. Returns `null` (never throws)
 * when even the completed text is not JSON — the caller treats that as "no tree
 * yet".
 */
export function parseSurfaceJson(text: string, partial = false): unknown | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(partial ? completeJson(trimmed) : trimmed);
  } catch {
    return null;
  }
}
