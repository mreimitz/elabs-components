// shell-command-parse.mjs — parse a Bash command LINE into simple commands (#78).
//
// Why this exists. The comment-attribution gate (#78) has to decide whether a
// Bash tool call posts text to GitHub. Two earlier rounds tried to answer that
// with string matching and were defeated the same way twice: round 1 recognized
// only `--flag value`, so `--flag=value` walked through; round 2 fixed the flag
// grammar but still required `gh` to be token[0], so all five posting shapes
// walked through behind an ordinary `cd X && ` prefix, a newline, an env-var
// prefix, a subshell, an absolute path, or `gh`'s own `--repo` global flag.
//
// The root cause of BOTH is the same: a shell command line is a small LANGUAGE,
// not a string. So this module parses it — quoting, escapes, line continuations,
// comments, the `&& || ; | & newline` separators, subshells, command
// substitutions and process substitutions — and hands back every SIMPLE COMMAND
// in the line as an argv of words. The caller then walks all of them.
//
// It is deliberately NOT a shell. It resolves nothing that needs a runtime:
// a word that contained `$VAR`, `${…}`, `$(…)` or a backtick is returned with
// `expanded: true`, which the caller treats as "I cannot know what this is"
// (and, for a comment body, refuses rather than passes through). That is the
// safe direction: this parser never claims to know MORE than it does.

const MAX_DEPTH = 5;
const ASSIGNMENT_RE = /^([A-Za-z_][A-Za-z0-9_]*)=([\s\S]*)$/;
const EXPANSION_NAME_RE = /^\$(?:[A-Za-z_][A-Za-z0-9_]*|[0-9@*#?$!-])/;

/**
 * @typedef {{value: string, expanded: boolean}} ShellWord
 *   `value` is the literal text with one level of quoting removed;
 *   `expanded` is true when the word contained an expansion this parser
 *   deliberately refuses to guess at.
 * @typedef {{words: ShellWord[], heredoc: boolean}} SimpleCommand
 *   `heredoc` is true when THIS command feeds a heredoc — its body is not in
 *   argv, so the gate cannot inspect it. Tracked per command, not per line, so
 *   an unrelated `cat > body.md <<EOF` earlier in a script does not make a
 *   later, perfectly readable `--body-file body.md` uninspectable.
 */

/**
 * Read a balanced `open…close` region whose opening char is at `start`,
 * skipping over quoted sections so a paren inside a string doesn't unbalance it.
 * @returns {{inner: string, next: number}}
 */
function scanBalanced(src, start, open, close) {
  let depth = 0;
  let quote = null;
  for (let i = start; i < src.length; i++) {
    const ch = src[i];
    if (quote) {
      if (ch === "\\" && quote === '"') {
        i++;
        continue;
      }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === "\\") {
      i++;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      continue;
    }
    if (ch === open) {
      depth++;
      continue;
    }
    if (ch === close) {
      depth--;
      if (depth === 0) return { inner: src.slice(start + 1, i), next: i + 1 };
    }
  }
  return { inner: src.slice(start + 1), next: src.length };
}

/**
 * Every simple command in a Bash command line, in source order — including the
 * ones inside subshells, command substitutions, process substitutions,
 * `eval "…"` and `sh -c "…"`.
 *
 * @param {string} text
 * @param {number} [depth] recursion guard for nested substitution/eval layers
 * @returns {{commands: SimpleCommand[], heredoc: boolean}}
 *   `heredoc` is true when the line feeds a heredoc anywhere — its content is
 *   not in argv, so a posting call in such a line is uninspectable by
 *   construction.
 */
export function parseShellCommands(text, depth = 0) {
  const src = typeof text === "string" ? text : "";
  /** @type {SimpleCommand[]} */
  const commands = [];
  /** @type {string[]} */
  const nested = [];
  let heredoc = false;

  /** @type {ShellWord[]} */
  let cur = [];
  let curHeredoc = false;
  let chars = "";
  let started = false;
  let expanded = false;

  const endWord = () => {
    if (started) cur.push({ value: chars, expanded });
    chars = "";
    started = false;
    expanded = false;
  };
  const endCommand = () => {
    endWord();
    if (cur.length) commands.push({ words: cur, heredoc: curHeredoc });
    cur = [];
    curHeredoc = false;
  };

  for (let i = 0; i < src.length; ) {
    const ch = src[i];

    if (ch === "\\") {
      if (src[i + 1] === "\n") {
        i += 2; // line continuation — the two chars vanish
        continue;
      }
      if (i + 1 < src.length) {
        chars += src[i + 1];
        started = true;
        i += 2;
        continue;
      }
      i++;
      continue;
    }

    if (ch === "'") {
      const end = src.indexOf("'", i + 1);
      chars += src.slice(i + 1, end === -1 ? src.length : end);
      started = true;
      i = end === -1 ? src.length : end + 1;
      continue;
    }

    if (ch === '"') {
      started = true;
      let j = i + 1;
      while (j < src.length && src[j] !== '"') {
        const c = src[j];
        if (c === "\\") {
          if (src[j + 1] === "\n") {
            j += 2;
            continue;
          }
          chars += src[j + 1] ?? "";
          j += 2;
          continue;
        }
        if (c === "`") {
          const k = src.indexOf("`", j + 1);
          nested.push(src.slice(j + 1, k === -1 ? src.length : k));
          expanded = true;
          j = k === -1 ? src.length : k + 1;
          continue;
        }
        if (c === "$") {
          if (src[j + 1] === "(") {
            const b = scanBalanced(src, j + 1, "(", ")");
            nested.push(b.inner);
            expanded = true;
            j = b.next;
            continue;
          }
          if (src[j + 1] === "{") {
            const b = scanBalanced(src, j + 1, "{", "}");
            expanded = true;
            j = b.next;
            continue;
          }
          const m = EXPANSION_NAME_RE.exec(src.slice(j));
          if (m) {
            expanded = true;
            j += m[0].length;
            continue;
          }
          chars += "$";
          j++;
          continue;
        }
        chars += c;
        j++;
      }
      i = j < src.length ? j + 1 : src.length;
      continue;
    }

    if (ch === "`") {
      const k = src.indexOf("`", i + 1);
      nested.push(src.slice(i + 1, k === -1 ? src.length : k));
      expanded = true;
      started = true;
      i = k === -1 ? src.length : k + 1;
      continue;
    }

    if (ch === "$") {
      if (src[i + 1] === "(") {
        const b = scanBalanced(src, i + 1, "(", ")");
        nested.push(b.inner);
        expanded = true;
        started = true;
        i = b.next;
        continue;
      }
      if (src[i + 1] === "{") {
        const b = scanBalanced(src, i + 1, "{", "}");
        expanded = true;
        started = true;
        i = b.next;
        continue;
      }
      const m = EXPANSION_NAME_RE.exec(src.slice(i));
      if (m) {
        expanded = true;
        started = true;
        i += m[0].length;
        continue;
      }
      chars += "$";
      started = true;
      i++;
      continue;
    }

    // `#` only starts a comment at a word boundary (`a#b` is one word).
    if (ch === "#" && !started) {
      const nl = src.indexOf("\n", i);
      i = nl === -1 ? src.length : nl;
      continue;
    }

    if (ch === "<" || ch === ">") {
      if (src[i + 1] === "(") {
        const b = scanBalanced(src, i + 1, "(", ")");
        nested.push(b.inner);
        expanded = true;
        started = true;
        i = b.next;
        continue;
      }
      if (ch === "<" && src[i + 1] === "<") {
        heredoc = true;
        curHeredoc = true;
      }
      endWord(); // a redirection ends the word; its target becomes its own word
      i++;
      continue;
    }

    if (ch === "(" || ch === ")") {
      endCommand();
      i++;
      continue;
    }
    if (ch === ";" || ch === "\n") {
      endCommand();
      i++;
      continue;
    }
    if (ch === "&" || ch === "|") {
      endCommand();
      i += src[i + 1] === ch ? 2 : 1;
      continue;
    }
    if (ch === " " || ch === "\t" || ch === "\r") {
      endWord();
      i++;
      continue;
    }

    chars += ch;
    started = true;
    i++;
  }
  endCommand();

  // A command line can carry a whole SCRIPT inside one word. Re-parse those,
  // or `eval "gh …"` / `bash -c 'gh …'` would be a one-word command with no
  // `gh` token in it at all — the same "it's a language, not a string" hole.
  if (depth < MAX_DEPTH) {
    for (const cmd of commands.slice()) {
      const words = cmd.words;
      if (!words.length) continue;
      const base = basename(words[0].value);
      // An assignment can carry a whole command as its value
      // (`CMD="gh issue comment 26 --body …"` then `$CMD`). The value is one
      // word, so nothing in it is a token until it is re-parsed.
      for (const word of words) {
        const m = ASSIGNMENT_RE.exec(word.value);
        if (m && /(?:^|[\s/])gh\s/.test(m[2])) nested.push(m[2]);
      }
      if (base === "eval" && words.length > 1) {
        nested.push(
          words
            .slice(1)
            .map((w) => w.value)
            .join(" "),
        );
      } else if (["sh", "bash", "zsh", "dash", "ksh"].includes(base)) {
        const ci = words.findIndex((w) => w.value === "-c");
        if (ci !== -1 && words[ci + 1]) nested.push(words[ci + 1].value);
      }
    }
    for (const script of nested) {
      const inner = parseShellCommands(script, depth + 1);
      commands.push(...inner.commands);
      heredoc = heredoc || inner.heredoc;
    }
  }

  return { commands, heredoc };
}

/**
 * POSIX-ish basename — `/opt/homebrew/bin/gh` and `./gh` both resolve to `gh`,
 * which is what makes an absolute path to the binary a candidate like any other.
 * @param {string} value
 */
export function basename(value) {
  const text = typeof value === "string" ? value : "";
  const parts = text.split("/");
  return parts[parts.length - 1];
}

/**
 * The leading `VAR=value` run of a simple command (`GH_HOST=x gh …`), as a map.
 * @param {ShellWord[]} words
 * @returns {Record<string, string>}
 */
export function leadingAssignments(words) {
  /** @type {Record<string, string>} */
  const env = {};
  for (const word of words || []) {
    const m = ASSIGNMENT_RE.exec(word.value);
    if (!m) break;
    env[m[1]] = m[2];
  }
  return env;
}
