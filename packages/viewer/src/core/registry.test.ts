import type { FileCategory } from "@elabs-ai/components-ui";
import { describe, expect, it, vi } from "vitest";

import { isViewerError, ViewerError } from "./errors";
import { createRegistry, scoreManifest } from "./registry";
import { PROTOCOL_VERSION, type AdapterManifest, type AdapterModule } from "./types";

const manifest = (over: Partial<AdapterManifest> & { id: string }): AdapterManifest => ({
  protocol: PROTOCOL_VERSION,
  ...over,
});

const moduleFor = (m: AdapterManifest): AdapterModule => ({
  manifest: m,
  create: () => ({ load: () => Promise.resolve({ kind: m.id }) }),
  Renderer: () => null,
});

const kind = (extension: string, mediaType: string, category: FileCategory = "text") => ({
  extension,
  mediaType,
  category,
});

describe("scoreManifest", () => {
  it("ranks extension above exact MIME above MIME prefix above category", () => {
    const file = kind("csv", "text/csv", "data");
    expect(scoreManifest(manifest({ id: "a", extensions: ["csv"] }), file)).toBeGreaterThan(
      scoreManifest(manifest({ id: "b", mediaTypes: ["text/csv"] }), file),
    );
    expect(scoreManifest(manifest({ id: "b", mediaTypes: ["text/csv"] }), file)).toBeGreaterThan(
      scoreManifest(manifest({ id: "c", mediaTypes: ["text/"] }), file),
    );
    expect(scoreManifest(manifest({ id: "c", mediaTypes: ["text/"] }), file)).toBeGreaterThan(
      scoreManifest(manifest({ id: "d", categories: ["data"] }), file),
    );
  });

  it("scores zero when nothing matches", () => {
    expect(scoreManifest(manifest({ id: "a", extensions: ["pdf"] }), kind("csv", "text/csv"))).toBe(
      0,
    );
  });

  it("treats a trailing slash as a prefix and nothing else as exact", () => {
    const png = kind("png", "image/png", "image");
    expect(scoreManifest(manifest({ id: "a", mediaTypes: ["image/"] }), png)).toBeGreaterThan(0);
    // "image" without the slash must NOT match "image/png".
    expect(scoreManifest(manifest({ id: "b", mediaTypes: ["image"] }), png)).toBe(0);
  });
});

describe("registry — registration", () => {
  it("rejects an adapter built against another protocol", () => {
    const registry = createRegistry();
    expect(() =>
      registry.register({ id: "old", protocol: PROTOCOL_VERSION + 1 }, () =>
        Promise.resolve(moduleFor(manifest({ id: "old" }))),
      ),
    ).toThrow(ViewerError);
  });

  it("replaces an entry with the same id, and drops its cached module", async () => {
    const registry = createRegistry();
    const first = manifest({ id: "x", extensions: ["x"] });
    registry.register(first, () => Promise.resolve(moduleFor(first)));
    await registry.load("x");

    const second = manifest({ id: "x", extensions: ["x"] });
    const secondLoader = vi.fn().mockResolvedValue(moduleFor(second));
    registry.register(second, secondLoader);

    await registry.load("x");
    expect(secondLoader).toHaveBeenCalledTimes(1);
    expect(registry.manifests()).toHaveLength(1);
  });
});

describe("registry — detect", () => {
  it("picks the most specific claim at equal priority", () => {
    const registry = createRegistry();
    const broad = manifest({ id: "text", categories: ["data"] });
    const exact = manifest({ id: "csv", extensions: ["csv"] });
    registry.register(broad, () => Promise.resolve(moduleFor(broad)));
    registry.register(exact, () => Promise.resolve(moduleFor(exact)));

    expect(registry.detectByName("rows.csv")?.id).toBe("csv");
  });

  it("lets a higher priority beat a more specific claim — that IS the override", () => {
    const registry = createRegistry();
    const builtin = manifest({ id: "csv", extensions: ["csv"] });
    const override = manifest({ id: "mine", categories: ["data"], priority: 10 });
    registry.register(builtin, () => Promise.resolve(moduleFor(builtin)));
    registry.register(override, () => Promise.resolve(moduleFor(override)));

    expect(registry.detectByName("rows.csv")?.id).toBe("mine");
  });

  it("returns undefined when nothing claims the file", () => {
    const registry = createRegistry();
    const only = manifest({ id: "img", categories: ["image"] });
    registry.register(only, () => Promise.resolve(moduleFor(only)));
    expect(registry.detectByName("notes.txt")).toBeUndefined();
  });
});

describe("registry — load", () => {
  it("caches the module, not the instance, so documents cannot share state", async () => {
    const registry = createRegistry();
    const m = manifest({ id: "x" });
    const loader = vi.fn().mockResolvedValue(moduleFor(m));
    registry.register(m, loader);

    const [a, b] = await Promise.all([registry.load("x"), registry.load("x")]);
    expect(loader).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
    expect(a.create()).not.toBe(b.create());
  });

  it("accepts a default export or a namespace export", async () => {
    const registry = createRegistry();
    const named = manifest({ id: "named" });
    const defaulted = manifest({ id: "defaulted" });
    registry.register(named, () => Promise.resolve(moduleFor(named)));
    registry.register(defaulted, () => Promise.resolve({ default: moduleFor(defaulted) }));

    expect((await registry.load("named")).manifest.id).toBe("named");
    expect((await registry.load("defaulted")).manifest.id).toBe("defaulted");
  });

  it("reports an unknown id as unsupported-format", async () => {
    const registry = createRegistry();
    await expect(registry.load("nope")).rejects.toMatchObject({ code: "unsupported-format" });
  });

  it("turns a missing optional peer into parser-missing, naming the packages", async () => {
    const registry = createRegistry();
    const m = manifest({ id: "csv", requires: ["papaparse"] });
    registry.register(m, () => Promise.reject(new Error("Cannot find module 'papaparse'")));

    await expect(registry.load("csv")).rejects.toMatchObject({
      code: "parser-missing",
      packages: ["papaparse"],
    });
  });

  it("does not cache a failed load — installing the peer later must work", async () => {
    const registry = createRegistry();
    const m = manifest({ id: "csv", requires: ["papaparse"] });
    const loader = vi
      .fn()
      .mockRejectedValueOnce(new Error("Cannot find module 'papaparse'"))
      .mockResolvedValueOnce(moduleFor(m));
    registry.register(m, loader);

    await expect(registry.load("csv")).rejects.toBeDefined();
    expect((await registry.load("csv")).manifest.id).toBe("csv");
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("rejects a module whose manifest disagrees with the registered protocol", async () => {
    const registry = createRegistry();
    const m = manifest({ id: "x" });
    registry.register(m, () =>
      Promise.resolve(moduleFor({ ...m, protocol: PROTOCOL_VERSION + 1 })),
    );

    const error = await registry.load("x").catch((e: unknown) => e);
    expect(isViewerError(error) && error.code).toBe("protocol-mismatch");
  });
});
