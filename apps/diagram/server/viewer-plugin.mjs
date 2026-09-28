/** Build in a production child process so the development server keeps its own environment. */
import process from "node:process";
import { URL } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const run = promisify(execFile);
const script = fileURLToPath(new URL("../scripts/build-viewer.mjs", import.meta.url));
const output = new URL("../.viewer/template.json", import.meta.url);
export function atlasViewer() {
  let cached;
  let generation = 0;
  let builds = Promise.resolve();
  return {
    name: "atlas-offline-viewer",
    configureServer(server) {
      const invalidate = (file) => {
        if (file.includes("/src/") || file.endsWith("/scripts/build-viewer.mjs")) {
          generation++;
          cached = undefined;
        }
      };
      server.watcher.on("change", invalidate);
      server.httpServer?.once("close", () => server.watcher.off("change", invalidate));
      server.middlewares.use(async (req, res, next) => {
        if (req.url?.split("?")[0] !== "/viewer.template.json") return next();
        if (req.method !== "GET") {
          res.statusCode = 405;
          res.end("Method not allowed");
          return;
        }
        try {
          const started = generation;
          if (!cached) {
            cached = builds
              .then(() =>
                run(process.execPath, [script, "--private"], {
                  env: { ...process.env, NODE_ENV: "production" },
                  maxBuffer: 4_000_000,
                }),
              )
              .then(() => readFile(output, "utf8"))
              .catch((error) => {
                if (started === generation) cached = undefined;
                throw error;
              });
            builds = cached.then(
              () => undefined,
              () => undefined,
            );
          }
          const template = await cached;
          if (started !== generation)
            throw new Error("Viewer source changed during its build. Please retry export.");
          res.setHeader("Content-Type", "application/json");
          res.setHeader("Cache-Control", "no-store");
          res.end(template);
        } catch (error) {
          server.config.logger.error(String(error));
          res.statusCode = 500;
          res.end(JSON.stringify({ error: "The offline viewer build failed. Please retry." }));
        }
      });
    },
  };
}
