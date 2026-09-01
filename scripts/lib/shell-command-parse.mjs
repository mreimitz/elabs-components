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
// Shell builtins whose OWN operands are themselves assignments, not
// positional arguments — `export CMD=…`/`declare CMD=…`/etc. assign CMD
// exactly as bare `CMD=…` would. Used only to widen the leading-assignment
// scan in `parseShellCommands`'s "assignment carries a whole command" pass
// (#96, fix round 8) so a builtin keyword in front doesn't hide a real
// assignment from it.
const ASSIGNMENT_BUILTINS = new Set(["export", "declare", "typeset", "local", "readonly"]);
const EXPANSION_NAME_RE = /^\$(?:[A-Za-z_][A-Za-z0-9_]*|[0-9@*#?$!-])/;
// Every `$VAR` / `${VAR}` NAME mentioned anywhere in the raw line (#96, fix
// round 11). Deliberately naive and deliberately run over the SOURCE TEXT, not
// over parsed words: it matches inside single quotes, after a backslash, and
// inside a nested quoting level, because none of those tell us the shell will
// not expand the name one level down (`sh -c '$CMD'` is the whole point). The
// safe direction for a guard is to see MORE references than really expand, not
// fewer — a spurious match costs a refusal, a missed one costs a bypass.
const VAR_REFERENCE_RE = /\$\{?([A-Za-z_][A-Za-z0-9_]*)\}?/g;

/**
 * @typedef {{value: string, expanded: boolean, raw: string}} ShellWord
 *   `value` is the literal text with one level of quoting removed and every
 *   expansion's SOURCE TEXT dropped (an expansion contributes nothing to it —
 *   only the `expanded` flag).
 *   `expanded` is true when the word contained an expansion this parser
 *   deliberately refuses to guess at.
 *   `raw` (#96, fix for the fix-round-7 verdict) is built the same way as
 *   `value` — quoting removed, escapes resolved — EXCEPT an expansion
 *   contributes its own verbatim syntax (`$VAR`, `${VAR}`, `$(…)`, a backtick
 *   command) instead of nothing. Re-parsing `raw` with `parseShellCommands()`
 *   therefore reproduces the word as an ordinary, unquoted command line, with
 *   every expansion visible at the position it actually occupies — which is
 *   what lets a NESTED re-read (an operand of a command word this gate does
 *   not recognise, see `nestedOperandCandidates` in
 *   check-comment-attribution.mjs) tell a `$MSG`-shaped body from a literal
 *   one instead of losing it the way re-parsing `value` would. Re-parsing
 *   `value` instead is still correct wherever the caller does not need that
 *   (nothing here does that today).
 * @typedef {{words: ShellWord[], heredoc: boolean, pipedNext?: boolean}} SimpleCommand
 *   `pipedNext` is true when THIS command's stdout is piped into the next one
 *   — `echo "gh …" | bash` hands a shell a script whose bytes are right there
 *   on the line, so the pipeline itself is a script-introducing route.
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
  let raw = "";
  let started = false;
  let expanded = false;

  const endWord = () => {
    if (started) cur.push({ value: chars, expanded, raw });
    chars = "";
    raw = "";
    started = false;
    expanded = false;
  };
  const endCommand = (pipedNext = false) => {
    endWord();
    if (cur.length) commands.push({ words: cur, heredoc: curHeredoc, pipedNext });
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
        raw += src[i + 1];
        started = true;
        i += 2;
        continue;
      }
      i++;
      continue;
    }

    if (ch === "'") {
      const end = src.indexOf("'", i + 1);
      const body = src.slice(i + 1, end === -1 ? src.length : end);
      chars += body;
      raw += body;
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
          const esc = src[j + 1] ?? "";
          chars += esc;
          raw += esc;
          j += 2;
          continue;
        }
        if (c === "`") {
          const k = src.indexOf("`", j + 1);
          const end = k === -1 ? src.length : k + 1;
          nested.push(src.slice(j + 1, k === -1 ? src.length : k));
          raw += src.slice(j, end); // verbatim, backticks included — see ShellWord.raw
          expanded = true;
          j = end;
          continue;
        }
        if (c === "$") {
          if (src[j + 1] === "(") {
            const b = scanBalanced(src, j + 1, "(", ")");
            nested.push(b.inner);
            raw += src.slice(j, b.next); // verbatim `$(...)`
            expanded = true;
            j = b.next;
            continue;
          }
          if (src[j + 1] === "{") {
            const b = scanBalanced(src, j + 1, "{", "}");
            raw += src.slice(j, b.next); // verbatim `${...}`
            expanded = true;
            j = b.next;
            continue;
          }
          const m = EXPANSION_NAME_RE.exec(src.slice(j));
          if (m) {
            raw += m[0]; // verbatim `$name`
            expanded = true;
            j += m[0].length;
            continue;
          }
          chars += "$";
          raw += "$";
          j++;
          continue;
        }
        chars += c;
        raw += c;
        j++;
      }
      i = j < src.length ? j + 1 : src.length;
      continue;
    }

    if (ch === "`") {
      const k = src.indexOf("`", i + 1);
      const end = k === -1 ? src.length : k + 1;
      nested.push(src.slice(i + 1, k === -1 ? src.length : k));
      raw += src.slice(i, end); // verbatim, backticks included — see ShellWord.raw
      expanded = true;
      started = true;
      i = end;
      continue;
    }

    if (ch === "$") {
      if (src[i + 1] === "(") {
        const b = scanBalanced(src, i + 1, "(", ")");
        nested.push(b.inner);
        raw += src.slice(i, b.next); // verbatim `$(...)`
        expanded = true;
        started = true;
        i = b.next;
        continue;
      }
      if (src[i + 1] === "{") {
        const b = scanBalanced(src, i + 1, "{", "}");
        raw += src.slice(i, b.next); // verbatim `${...}`
        expanded = true;
        started = true;
        i = b.next;
        continue;
      }
      const m = EXPANSION_NAME_RE.exec(src.slice(i));
      if (m) {
        raw += m[0]; // verbatim `$name`
        expanded = true;
        started = true;
        i += m[0].length;
        continue;
      }
      chars += "$";
      raw += "$";
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
      // `||` is a logical operator; a single `|` (or `|&`) is a real pipe.
      endCommand(ch === "|" && src[i + 1] !== "|");
      i += src[i + 1] === ch ? 2 : 1;
      continue;
    }
    if (ch === " " || ch === "\t" || ch === "\r") {
      endWord();
      i++;
      continue;
    }

    chars += ch;
    raw += ch;
    started = true;
    i++;
  }
  endCommand();

  // A command line can carry a whole SCRIPT inside one word. Re-parse those,
  // or `eval "gh …"` / `bash -lc 'gh …'` would be a one-word command with no
  // `gh` token in it at all — the same "it's a language, not a string" hole.
  if (depth < MAX_DEPTH) {
    const original = commands.slice();
    // Every variable NAME this line expands, read off the source text (see
    // VAR_REFERENCE_RE). Used by the position-independent assignment re-read
    // below, which is why it is computed once per level rather than per
    // command: `env CMD=… sh -c '$CMD'` assigns in one simple command and
    // expands in another's operand.
    const referencedVars = new Set();
    for (const m of src.matchAll(VAR_REFERENCE_RE)) referencedVars.add(m[1]);
    // `echo 'gh …' | bash` — a literal producer piped into an interpreter. The
    // script's bytes are words on this line, so it is read, not declared away:
    // only a producer whose output the line does NOT contain (a file, another
    // program's output, a `$VAR`) stays outside what this parser can see.
    for (let ci = 1; ci < original.length; ci++) {
      const prev = original[ci - 1];
      const into = original[ci];
      if (!prev.pipedNext || !prev.words.length || !into.words.length) continue;
      if (!LITERAL_PRODUCERS.includes(basename(prev.words[0].value))) continue;
      if (!introducerFor(basename(into.words[0].value))) continue;
      nested.push(joinWords(prev.words, 1));
    }
    for (const cmd of original) {
      const words = cmd.words;
      if (!words.length) continue;
      // An assignment can carry a whole command as its value
      // (`CMD="gh issue comment 26 --body …"` then `$CMD`). The value is one
      // word, so nothing in it is a token until it is re-parsed. Scoped to the
      // LEADING assignment run only (#96, fix round 8) — a `VAR=value` word
      // that is a POSITIONAL ARGUMENT to some other command, not a shell
      // assignment at all, used to be scanned the same way:
      // `make deploy MSG="gh issue comment --body ready"` re-parsed `MSG=`'s
      // value into its own simple command and posted a false positive, even
      // though `MSG=` is never assigned or executed by this shell — it is
      // just an argument make(1) happens to receive. `commandWordIndex` is the
      // same "assignment run before the real command word" boundary the rest
      // of this gate already uses to find argv[0].
      //
      // A leading `export`/`declare`/`typeset`/`local`/`readonly` builtin is a
      // SECOND way a word after it is still a real shell assignment, not a
      // positional argument — `export CMD='gh pr comment 12 --body …'` assigns
      // CMD exactly as `CMD=…` alone would. `commandWordIndex(["export",
      // "CMD=…"])` returns 0 (`export` itself isn't `VAR=value`-shaped), so
      // without this the operand at index 1 would fall outside the leading
      // run and go unscanned — the same false-refusal fix above would have
      // silently reopened this bypass. Scan the run's own command word too
      // when it is one of these builtins; its operands (index run+1 and up
      // while they still look like `VAR=value`) get the same treatment as a
      // leading assignment.
      const assignmentRun = commandWordIndex(words);
      for (let ai = 0; ai < assignmentRun; ai++) {
        const m = ASSIGNMENT_RE.exec(words[ai].value);
        if (m && /(?:^|[\s/])gh\s/.test(m[2])) nested.push(m[2]);
      }
      if (
        assignmentRun < words.length &&
        ASSIGNMENT_BUILTINS.has(basename(words[assignmentRun].value))
      ) {
        for (let ai = assignmentRun + 1; ai < words.length; ai++) {
          const m = ASSIGNMENT_RE.exec(words[ai].value);
          if (!m) break;
          if (/(?:^|[\s/])gh\s/.test(m[2])) nested.push(m[2]);
        }
      }
      // The two scans above are POSITIONAL: they read the leading assignment
      // run, and an assignment builtin's operands until the first word that is
      // not `VAR=value`-shaped. Both windows have an edge, and two ordinary
      // shapes sit just outside it (#96, fix round 11):
      //
      //   env CMD="gh issue comment 26 --body …" sh -c '$CMD'
      //   declare -x CMD="gh issue comment 26 --body …"; $CMD
      //
      // In the first the assignment sits AFTER a command word, so
      // `commandWordIndex` returns 0 and the leading-run loop never executes;
      // in the second the builtin's `-x` operand is not `VAR=value`-shaped, so
      // the operand loop breaks before it reaches `CMD=`. Both really run the
      // post. Merge-base `main` caught them only because it scanned every word
      // of every command unconditionally — which is also why it refused
      // `make deploy MSG="gh issue comment --body ready"`, a positional
      // argument make(1) never assigns or executes (the false refusal fix
      // round 8 removed, locked in the suite).
      //
      // Widening the window by NAMING the commands that consume a following
      // assignment (env/sudo/nohup/…) is the repair this gate must not make:
      // every previous round that reached for a name list closed one hole and
      // opened another, and the missing name is silent. So the rule keys on
      // shell VARIABLE SYNTAX alone and mentions no command at all — re-read a
      // `VAR=value` word wherever it sits, but only when the same line also
      // EXPANDS `$VAR`. An assignment nothing on the line expands cannot make
      // this line post, whoever the command word is; `make deploy MSG=…`,
      // `docker run -e CMD=… alpine true` and `declare -x CMD=…` alone all
      // stay allowed for that reason, not because make/docker are on a list.
      //
      // This is an over-approximation in the safe direction: a line that
      // mentions `$MSG` for an unrelated reason and separately carries a
      // `MSG=` word whose value looks like a `gh` post is refused. It costs
      // one retry and prints its own override. What it still cannot see is an
      // assignment made in an EARLIER Bash call and expanded in a later one —
      // the bytes are not on this line, and merge-base `main` could not see
      // that either.
      if (referencedVars.size) {
        for (const word of words) {
          const m = ASSIGNMENT_RE.exec(word.value);
          if (!m || !referencedVars.has(m[1])) continue;
          if (/(?:^|[\s/])gh\s/.test(m[2])) nested.push(m[2]);
        }
      }
      // Position-independent, because a wrapper can precede the interpreter:
      // `nohup bash -lc …`, `timeout 30 bash -lc …`, `xargs -I{} sh -c …`,
      // `env FOO=1 bash -lc …`, `command bash -lc …`. Testing only words[0]
      // hid every one of those, `-c` or not.
      for (let i = 0; i < words.length; i++) {
        const base = basename(words[i].value);
        if (base === "eval") {
          nested.push(joinWords(words, i + 1));
          continue;
        }
        const spec = introducerFor(base);
        if (spec) nested.push(...scriptOperands(words, i + 1, spec));
      }
    }
    const seen = new Set();
    for (const script of nested) {
      if (!script || seen.has(script)) continue;
      seen.add(script);
      const inner = parseShellCommands(script, depth + 1);
      commands.push(...inner.commands);
      heredoc = heredoc || inner.heredoc;
    }
  }

  return { commands, heredoc };
}

// ── Script-introducing option grammar (#78, fix round 6) ────────────────────
//
// Round 5 was defeated by `bash -lc "gh issue comment …"`. The cause was not a
// missing spelling, it was the wrong KIND of test: the nested-script lookup
// asked `word.value === "-c"`, so any short-flag CLUSTER carrying `c` hid the
// whole script from the parser — and with it all 18 gated posting shapes.
//
// So membership is decided by each tool's own option GRAMMAR, read out of that
// tool's own usage output rather than recalled:
//
//   · POSIX sh(1) mandates `-c command_string`, and POSIX Utility Syntax
//     Guideline 5 permits grouping options behind one `-`. Every shell here
//     accepts `c` ANYWHERE in the cluster, not only last — verified on this
//     machine (bash 3.2.57, zsh 5.9, dash, ksh, and `/bin/sh`, which is bash):
//     `-lc` `-ec` `-xc` `-cx` `-cl` `-euxc` `-ce` all execute the next word.
//   · The script is never ATTACHED for a shell: `bash -c'echo x'`,
//     `zsh -c'…'`, `dash -c'…'` and `ksh -c'…'` are all rejected by the real
//     shells, so the script is the operand that FOLLOWS the cluster.
//   · No shell present spells `-c` as a long option: `bash --help`'s GNU long
//     option list, `zsh --help`, `ksh`'s usage line and dash (which has no long
//     options at all) contain no `--command`.
//   · `bash -o opt`, `bash -O shopt`, `zsh -o opt` and `ksh -R file` consume an
//     argument, so a cluster is walked left to right and stops at the first
//     argument-taking letter instead of guessing past it.
//   · env(1) is the other verified script introducer. BSD/macOS usage is
//     `env [-0iv] [-C workdir] [-P utilpath] [-S string] [-u name]`; `-S str`,
//     the ATTACHED `-S"str"` and the clustered `-iS "str"` all run the string
//     (verified here). GNU coreutils additionally spells it
//     `--split-string=STRING`; that build is not installed on this machine
//     (`env --split-string=…` → `env: illegal option -- s`), so its grammar is
//     taken from the GNU env(1) documentation, not observed.
//   · util-linux `su -c COMMAND` has the same shape. macOS `su` does NOT
//     (`su [-] [-flm] [login [args]]`), so that row is documented grammar, not
//     behaviour observed here. Listing it costs nothing.
//   · ssh(1) needs no flag at all: its synopsis is
//     `ssh [options] destination [command [argument ...]]` and a command given
//     there "is executed on the remote host instead of a login shell", joined
//     with spaces — so the OPERAND LIST is the script. `ssh localhost "gh
//     issue comment …"` really does post, and did pass this gate until this
//     round. Its own `-c cipher_spec` and `-S ctl_path` are not script flags,
//     which is why ssh is its own row rather than a member of the shell one.
//
// WHAT A ROW CANNOT KNOW — an option spelling — is handled by a superset, not
// by more rows: the whole operand list after an interpreter name is ALSO
// offered to the re-parser as one script. That covers a `<<<` herestring
// (`bash <<< "gh …"`), a positional argument a script would `eval`, and any
// option spelling this table has missed. Re-parsing words that are not a
// script is free — they yield commands whose argv[0] is not `gh` — so the
// over-approximation only ever ADDS candidates, which is the fail-closed
// direction.
//
// WHAT THE TABLE ITSELF CANNOT KNOW — *which tools are interpreters* — is NOT
// covered here, and saying otherwise is what let `csh -c "gh issue comment …"`
// through fix round 6: the superset above is keyed on a name already being in
// this table, so an interpreter with no row is simply not an interpreter. That
// half is answered one layer up, by an INVERTED DEFAULT rather than a longer
// table: check-comment-attribution.mjs re-reads any operand of an
// UNRECOGNISED command word as a script (see `TEXT_ONLY_COMMANDS` /
// `nestedOperandCandidates` there). This table stays because a row buys
// PRECISION — the exact operand a known interpreter executes — not safety.
//
// A PIPELINE is the same question asked without a flag, so it gets the same
// answer: `echo "gh …" | bash` has the script's bytes right there as a word and
// is parsed (LITERAL_PRODUCERS below), while `cat body.sh | bash` does not and
// is not.
//
// STILL NOT SEEN, and declared rather than half-closed: a script the command
// line does not CONTAIN as text — `bash deploy.sh` and `cat s.sh | sh` (the
// bytes are in a file), `bash -c "$SCRIPT"` (the bytes are in the
// environment), and an interpreter for another language (`node -e`,
// `python -c`, `perl -e`), whose argument is not shell source and cannot be
// parsed as any. See the declared limits in
// `.claude/rules/issue-workflow.md`.

/** Tools whose option grammar can hand a following word to a shell. */
const SCRIPT_INTRODUCERS = [
  {
    names: [
      "sh",
      "bash",
      "rbash",
      "zsh",
      "dash",
      "ksh",
      "ksh88",
      "ksh93",
      "mksh",
      "pdksh",
      "ash",
      "busybox",
      "yash",
      "su",
    ],
    flag: "c",
    longs: [],
    attachable: false,
    argTaking: "oOR",
  },
  {
    names: ["env"],
    flag: "S",
    longs: ["--split-string"],
    attachable: true,
    argTaking: "uCPL",
  },
  {
    // `ssh [options] destination [command [argument ...]]` — ssh(1) joins the
    // operands with spaces and runs them "on the remote host instead of a
    // login shell", so the operand list IS a shell script and needs no flag of
    // its own. Its own `-c cipher_spec` / `-S ctl_path` are NOT script flags,
    // which is exactly why ssh gets its own row instead of joining the shells.
    names: ["ssh", "slogin", "rsh", "remsh"],
    flag: null,
    longs: [],
    attachable: false,
    argTaking: "",
  },
];

// The leading short-flag cluster of a word. Deliberately not anchored at the
// end: an ATTACHED value (`-S"gh issue comment …"`) is part of the same word
// and may contain anything, spaces included.
// Commands whose stdout is their own operands, verbatim. `cat`/`curl` are
// deliberately absent: their bytes come from a file or a socket, so a shell fed
// by one of those is genuinely outside what a command line can be read to say.
const LITERAL_PRODUCERS = ["echo", "printf"];

const SHORT_CLUSTER_RE = /^-([A-Za-z0-9]+)/;

/**
 * The option grammar for a command word, by basename — `/bin/bash` and `bash`
 * are the same tool.
 * @param {string} base
 */
function introducerFor(base) {
  return SCRIPT_INTRODUCERS.find((spec) => spec.names.includes(base));
}

/**
 * @param {ShellWord[]} words
 * @param {number} from
 */
function joinWords(words, from) {
  return words
    .slice(from)
    .map((w) => w.value)
    .join(" ");
}

/**
 * Every word an interpreter invocation could execute as a script: the operand
 * its own option grammar names (including the attached and long-option
 * spellings), plus the whole remaining operand list as one script — the
 * fail-closed superset described above.
 *
 * @param {ShellWord[]} words all words of the simple command
 * @param {number} start index just past the interpreter's own name
 * @param {{flag: string|null, longs: string[], attachable: boolean,
 *          argTaking: string}} spec `flag: null` = no script FLAG exists; the
 *          operand list alone carries the script (ssh).
 * @returns {string[]}
 */
function scriptOperands(words, start, spec) {
  /** @type {string[]} */
  const scripts = [];
  for (let j = start; j < words.length; j++) {
    const word = words[j].value;
    const long = spec.longs.find((l) => word === l || word.startsWith(`${l}=`));
    if (long) {
      if (word.length > long.length) scripts.push(word.slice(long.length + 1));
      else if (words[j + 1]) scripts.push(words[j + 1].value);
      continue;
    }
    const shorts = SHORT_CLUSTER_RE.exec(word);
    if (!shorts) continue;
    const cluster = shorts[1];
    for (let k = 0; k < cluster.length; k++) {
      const ch = cluster[k];
      if (ch === spec.flag) {
        const rest = word.slice(k + 2);
        if (spec.attachable && rest) scripts.push(rest);
        else if (words[j + 1]) scripts.push(words[j + 1].value);
        break;
      }
      // An argument-taking letter eats the rest of the cluster or the next
      // word, so nothing after it in this token is a flag any more.
      if (spec.argTaking.includes(ch)) break;
    }
  }
  if (words.length > start) scripts.push(joinWords(words, start));
  return scripts;
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

/**
 * Index of the COMMAND WORD — the first word that is not a leading
 * `VAR=value` assignment. `GH_HOST=x gh issue …` has its command word at 1.
 * Used by the fix-round-7 inversion in check-comment-attribution.mjs, which
 * has to tell "this word IS the command" from "this word is an operand of it".
 * @param {ShellWord[]} words
 * @returns {number} `words.length` when the command is assignments only
 */
export function commandWordIndex(words) {
  const list = words || [];
  let i = 0;
  while (i < list.length && ASSIGNMENT_RE.test(list[i].value)) i++;
  return i;
}
