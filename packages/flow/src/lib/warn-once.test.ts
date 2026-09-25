import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetFlowWarnings, warnFlowOnce } from "./warn-once";

describe("warnFlowOnce", () => {
  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    resetFlowWarnings();
    warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    warn.mockRestore();
    vi.unstubAllEnvs();
  });

  it("warns once per key, prefixed with the package name", () => {
    warnFlowOnce("k", "old name");
    warnFlowOnce("k", "old name");
    warnFlowOnce("other", "another old name");
    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn.mock.calls[0]![0]).toBe("[@elabs-ai/components-flow] old name");
  });

  it("stays silent in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    warnFlowOnce("k", "old name");
    expect(warn).not.toHaveBeenCalled();
  });

  it("guards on the bare NODE_ENV expression, which bundlers replace at build time", () => {
    // A `typeof process` guard survives a bundler's define step and, in a browser with no
    // `process`, lets the warning through in production. Keep the replaceable form.
    const here = dirname(fileURLToPath(import.meta.url));
    const source = readFileSync(join(here, "warn-once.ts"), "utf8");
    expect(source).toContain('process.env.NODE_ENV === "production"');
    expect(source).not.toMatch(/typeof process\s*!==/);
  });
});
