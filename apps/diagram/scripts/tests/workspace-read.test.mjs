/* global Response */
import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { runnerImport } from "vite";
const root = fileURLToPath(new URL("../../", import.meta.url));
const {
  module: { readFile, WorkspaceApiError },
} = await runnerImport(`${root}/src/workspace/client.ts`, {
  root,
  configFile: false,
  logLevel: "error",
});
test("workspace reads reject successful SPA fallback instead of compiling HTML as YAML", async () => {
  const saved = globalThis.fetch;
  try {
    for (const headers of [
      { "Content-Type": "text/html" },
      { "Content-Type": "text/yaml" },
      { "Content-Type": "text/yaml", "X-Workspace-Mtime": "NaN" },
      { "Content-Type": "text/html", "X-Workspace-Mtime": "123" },
    ]) {
      globalThis.fetch = async () => new Response("<!doctype html><div id=app></div>", { headers });
      await assert.rejects(
        readFile("example.yaml"),
        (error) => error instanceof WorkspaceApiError && error.code === "workspace-unavailable",
      );
    }
    globalThis.fetch = async () =>
      new Response('diagram: "1"\n', {
        headers: { "Content-Type": "text/yaml; charset=utf-8", "X-Workspace-Mtime": "123.5" },
      });
    assert.deepEqual(await readFile("example.yaml"), { text: 'diagram: "1"\n', mtime: 123.5 });
  } finally {
    globalThis.fetch = saved;
  }
});
