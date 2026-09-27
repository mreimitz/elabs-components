/**
 * DG-35 — MCP prompts: every `apps/diagram/mcp/prompts/<name>.md`, read on each call (an edit
 * applies without a restart). Each file starts with YAML frontmatter:
 *
 *   ---
 *   name: fill-catalog
 *   description: One line for the client's prompt picker.
 *   arguments:
 *     - { name: vendor, description: "…", required: true }
 *   ---
 *   The prompt text; {{vendor}} is replaced by the argument.
 *
 * `prompts/get` answers one user message with the text (MCP `PromptMessage`).
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

export const PROMPTS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../mcp/prompts",
);

const FRONTMATTER = /^---\n([\s\S]*?)\n---\n?/;

async function readPrompts() {
  const names = (await fs.readdir(PROMPTS_DIR).catch(() => [])).filter((f) => f.endsWith(".md"));
  const prompts = [];
  for (const file of names.sort()) {
    const text = await fs.readFile(path.join(PROMPTS_DIR, file), "utf8");
    const match = FRONTMATTER.exec(text);
    const meta = match ? parse(match[1]) : {};
    prompts.push({
      name: meta.name ?? file.replace(/\.md$/, ""),
      description: meta.description ?? "",
      arguments: meta.arguments ?? [],
      body: match ? text.slice(match[0].length) : text,
    });
  }
  return prompts;
}

export function createPrompts() {
  return {
    async list() {
      return (await readPrompts()).map(({ name, description, arguments: args }) => ({
        name,
        description,
        arguments: args,
      }));
    },
    /** null for an unknown prompt; throws for a missing required argument. */
    async get(name, args) {
      const prompt = (await readPrompts()).find((p) => p.name === name);
      if (!prompt) return null;
      for (const a of prompt.arguments) {
        if (a.required && (typeof args[a.name] !== "string" || args[a.name] === "")) {
          throw new Error(`Missing argument: ${a.name}`);
        }
      }
      const text = prompt.body.replace(/\{\{(\w+)\}\}/g, (_, key) => String(args[key] ?? ""));
      return {
        description: prompt.description,
        messages: [{ role: "user", content: { type: "text", text } }],
      };
    },
  };
}
