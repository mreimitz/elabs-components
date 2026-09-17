#!/usr/bin/env node
/**
 * brand-ui agent benchmark — RUNNER (2026-09-17 review, item 4).
 *
 * Asks a model to build the same five screens (tasks.json) with brand-ui and
 * with a comparison library, from a fair context pack per library, and writes
 * every answer to `scripts/bench/out/<run>/<library>/<task>/App.tsx` with the
 * token usage the API reported. `score.mjs` then grades the outputs; nothing in
 * this file judges anything.
 *
 *   ANTHROPIC_API_KEY=… node scripts/bench/run.mjs [--model claude-sonnet-4-5] [--libs brand-ui,shadcn]
 *                        [--tasks dashboard,data-app] [--run <name>] [--dry-run]
 *
 * Context packs (what the model sees besides the task prompt):
 *   brand-ui  → apps/docs/public/llms.txt + `brand-ui docs <Component>` for the
 *               components `brand-ui search` finds for the task's nouns — i.e.
 *               exactly what an agent with the hosted MCP would fetch. No hand-
 *               picked hints.
 *   shadcn    → scripts/bench/context/shadcn.md if present (put the shadcn/ui
 *               docs excerpts you consider fair there), else the instruction
 *               "use shadcn/ui + Tailwind as installed by `npx shadcn@latest add`".
 *   <name>    → scripts/bench/context/<name>.md, same rule.
 *
 * `--dry-run` writes the prompts it WOULD send (prompt.txt per cell) and exits
 * without calling the API — the way to inspect fairness before spending money.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const CLI = join(ROOT, "packages/cli/bin/brand-ui.mjs");

const argv = process.argv.slice(2);
const flag = (name, def) => {
  const i = argv.indexOf(name);
  if (i !== -1 && argv[i + 1] && !argv[i + 1].startsWith("--")) return argv[i + 1];
  const inline = argv.find((a) => a.startsWith(`${name}=`));
  return inline ? inline.slice(name.length + 1) : def;
};
const MODEL = flag("--model", "claude-sonnet-4-5");
const LIBS = flag("--libs", "brand-ui,shadcn").split(",");
const RUN = flag("--run", new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-"));
const DRY = argv.includes("--dry-run");
const TASKS = JSON.parse(readFileSync(join(HERE, "tasks.json"), "utf8")).tasks.filter(
  (t) => !flag("--tasks") || flag("--tasks").split(",").includes(t.id),
);

const SYSTEM = `You are a senior React engineer. Produce ONE file, src/App.tsx, for a Vite + React 19 + TypeScript + Tailwind v4 app. Output ONLY a single \`\`\`tsx code block with the complete file — no prose. Use only the component library named in the context; import from its real packages; do not invent props. Prefer the library's components over hand-written markup wherever one exists. The screen must be accessible (labels, roles, keyboard) and must work in light and dark themes.`;

/** The nouns of a task, for `brand-ui search` — crude on purpose (no human curation). */
function nouns(prompt) {
  const stop = new Set(
    "a an the and or of for with to in on that is are be as by vs an each one two three four five six last export default react component named app build page must also work light dark theme screen when while while it its this from".split(
      " ",
    ),
  );
  return [...new Set(prompt.toLowerCase().match(/[a-z][a-z-]{3,}/g) ?? [])].filter(
    (w) => !stop.has(w),
  );
}

function cli(args) {
  const r = spawnSync(process.execPath, [CLI, ...args], { cwd: ROOT, encoding: "utf8" });
  return r.status === 0 ? r.stdout : "";
}

/** brand-ui context = llms.txt + docs for what search finds. Same route as the hosted MCP. */
function brandUiContext(task) {
  const llms = readFileSync(join(ROOT, "apps/docs/public/llms.txt"), "utf8");
  const found = new Set();
  const playbooks = new Set();
  // The agent route: `search` per noun (exact/prefix hits first — the same
  // ranking the MCP returns), at most five components per noun so one noun
  // ("dashboard" → twenty Dashboard* tiles) cannot crowd out the rest; any
  // playbook a search names is included whole, as an agent would fetch it.
  for (const n of nouns(task.prompt)) {
    const out = cli(["search", n]);
    let k = 0;
    for (const m of out.matchAll(
      /^ {2}([A-Z][A-Za-z0-9]+) {2}\(@elabs-ai\/components-\w+ · component\)/gm,
    )) {
      if (k++ >= 5) break;
      found.add(m[1]);
    }
    for (const m of out.matchAll(/^ {4}(docs\/playbooks\/[\w-]+\.md)/gm)) playbooks.add(m[1]);
    if (found.size > 40) break;
  }
  const docs = [...found]
    .slice(0, 40)
    .map((c) => cli(["docs", c]))
    .join("\n\n");
  const books = [...playbooks]
    .filter((f) => existsSync(join(ROOT, f)))
    .map((f) => `## ${f}\n\n${readFileSync(join(ROOT, f), "utf8")}`)
    .join("\n\n");
  return `# Library: brand-ui (@elabs-ai/components-*)\n\n${llms}\n\n# Playbooks (from \`brand-ui search\`)\n\n${books || "(none matched)"}\n\n# Component API (from \`brand-ui docs\`)\n\n${docs}`;
}

function otherContext(lib) {
  const f = join(HERE, "context", `${lib}.md`);
  if (existsSync(f)) return readFileSync(f, "utf8");
  if (lib === "shadcn")
    return "# Library: shadcn/ui\n\nUse shadcn/ui components as installed by `npx shadcn@latest add <component>` (import from `@/components/ui/<name>`), Tailwind v4 utilities, lucide-react icons, and Recharts for charts. Assume every shadcn/ui component is installed.";
  return `# Library: ${lib}\n\nUse ${lib} idiomatically.`;
}

async function callModel(system, user) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key)
    throw new Error(
      "ANTHROPIC_API_KEY is not set (use --dry-run to inspect prompts without calling the API)",
    );
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 8000,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  const j = await res.json();
  const text = j.content.map((c) => c.text ?? "").join("");
  return { text, usage: j.usage };
}

const outRoot = join(HERE, "out", RUN);
for (const lib of LIBS) {
  const context = lib === "brand-ui" ? null : otherContext(lib);
  for (const task of TASKS) {
    const dir = join(outRoot, lib, task.id);
    mkdirSync(dir, { recursive: true });
    const ctx = lib === "brand-ui" ? brandUiContext(task) : context;
    const user = `${ctx}\n\n# Task\n\n${task.prompt}`;
    writeFileSync(join(dir, "prompt.txt"), `--- system ---\n${SYSTEM}\n\n--- user ---\n${user}\n`);
    if (DRY) {
      console.log(`[dry] ${lib}/${task.id}: prompt ${user.length} chars`);
      continue;
    }
    const t0 = Date.now();
    const { text, usage } = await callModel(SYSTEM, user);
    const code = text.match(/```(?:tsx|jsx|typescript)?\n([\s\S]*?)```/)?.[1] ?? text;
    writeFileSync(join(dir, "App.tsx"), code);
    writeFileSync(
      join(dir, "meta.json"),
      JSON.stringify({ model: MODEL, usage, ms: Date.now() - t0 }, null, 2),
    );
    console.log(
      `${lib}/${task.id}: ${usage?.input_tokens ?? "?"} in / ${usage?.output_tokens ?? "?"} out, ${Date.now() - t0} ms`,
    );
  }
}
console.log(`\nrun: ${outRoot}\nnext: node scripts/bench/score.mjs --run ${RUN}`);
