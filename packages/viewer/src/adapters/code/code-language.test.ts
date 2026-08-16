import { describe, expect, it } from "vitest";

import { CODE_EXTENSIONS, languageFor } from "./code-language";

describe("languageFor", () => {
  it("maps an extension to its Shiki grammar", () => {
    expect(languageFor("registry.ts")).toBe("typescript");
    expect(languageFor("Button.tsx")).toBe("tsx");
    expect(languageFor("deploy.yml")).toBe("yaml");
  });

  it("is case-insensitive — a file name is not a grammar", () => {
    expect(languageFor("MAIN.PY")).toBe("python");
  });

  it("reads the WHOLE name when a language carries it there", () => {
    // Dockerfile and Makefile have no extension at all; matching only the last
    // dot-segment would send both to the plain-text backstop.
    expect(languageFor("Dockerfile")).toBe("docker");
    expect(languageFor("Makefile")).toBe("make");
  });

  it("takes the LAST extension of a multi-part name", () => {
    expect(languageFor("vite.config.ts")).toBe("typescript");
  });

  it("returns nothing for a file it has no grammar for", () => {
    expect(languageFor("server.log")).toBeUndefined();
    expect(languageFor("notes")).toBeUndefined();
  });

  it("leaves the formats other adapters own alone", () => {
    // Claiming these would decide the winner by registration order rather than
    // by design: JSON gets a tree, CSV a table, markdown a document.
    for (const extension of ["json", "csv", "md", "markdown", "svg", "pdf"]) {
      expect(CODE_EXTENSIONS).not.toContain(extension);
    }
  });

  it("claims every extension it can actually highlight, and only those", () => {
    for (const extension of CODE_EXTENSIONS) {
      expect(languageFor(`file.${extension}`)).toBeTruthy();
    }
  });
});
