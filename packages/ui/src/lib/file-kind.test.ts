import { describe, expect, it } from "vitest";

import { extensionOf, mediaTypeFromName, resolveFileKind } from "./file-kind";

describe("extensionOf", () => {
  it("lowercases and drops the dot", () => {
    expect(extensionOf("Report.PDF")).toBe("pdf");
  });

  it("uses the last dot", () => {
    expect(extensionOf("archive.tar.gz")).toBe("gz");
  });

  it("strips a path", () => {
    expect(extensionOf("/some/dir/notes.md")).toBe("md");
    expect(extensionOf("C:\\docs\\notes.md")).toBe("md");
  });

  it("strips a query and hash, so a URL-derived name still resolves", () => {
    expect(extensionOf("chart.svg?v=2")).toBe("svg");
    expect(extensionOf("chart.svg#top")).toBe("svg");
  });

  it("is empty for a dotfile, a trailing dot and no extension", () => {
    expect(extensionOf(".gitignore")).toBe("");
    expect(extensionOf("noext.")).toBe("");
    expect(extensionOf("README")).toBe("");
    expect(extensionOf("")).toBe("");
  });
});

describe("mediaTypeFromName", () => {
  it("infers from the extension", () => {
    expect(mediaTypeFromName("a.pdf")).toBe("application/pdf");
    expect(mediaTypeFromName("a.tsx")).toBe("text/x-typescript");
  });

  it("is undefined for an unknown extension, so callers own the fallback", () => {
    expect(mediaTypeFromName("a.wat")).toBeUndefined();
  });
});

describe("resolveFileKind", () => {
  it("resolves the common categories", () => {
    expect(resolveFileKind("photo.png").category).toBe("image");
    expect(resolveFileKind("clip.mp4", "video/mp4").category).toBe("video");
    expect(resolveFileKind("song.mp3", "audio/mpeg").category).toBe("audio");
    expect(resolveFileKind("report.pdf").category).toBe("document");
    expect(resolveFileKind("book.xlsx").category).toBe("spreadsheet");
    expect(resolveFileKind("deck.pptx").category).toBe("presentation");
    expect(resolveFileKind("main.rs").category).toBe("code");
    expect(resolveFileKind("notes.md").category).toBe("text");
    expect(resolveFileKind("rows.csv").category).toBe("data");
    expect(resolveFileKind("bundle.zip").category).toBe("archive");
  });

  it("returns the extension and resolved MIME alongside the category", () => {
    expect(resolveFileKind("Report.PDF")).toEqual({
      category: "document",
      mediaType: "application/pdf",
      extension: "pdf",
    });
  });

  it("prefers a meaningful declared MIME over the extension", () => {
    // The name says nothing; the server does.
    expect(resolveFileKind("download", "image/webp")).toMatchObject({
      category: "image",
      mediaType: "image/webp",
    });
  });

  it("ignores the placeholder MIMEs a source uses to mean 'unknown'", () => {
    expect(resolveFileKind("a.pdf", "application/octet-stream").mediaType).toBe("application/pdf");
    expect(resolveFileKind("a.pdf", "binary/octet-stream").mediaType).toBe("application/pdf");
    expect(resolveFileKind("a.pdf", "").mediaType).toBe("application/pdf");
  });

  it("strips MIME parameters and casing", () => {
    expect(resolveFileKind("rows.csv", "TEXT/CSV; charset=utf-8").mediaType).toBe("text/csv");
  });

  it("lets the extension win where it is strictly more specific than a text/* MIME", () => {
    // Servers routinely send text/plain for these; "text" would be the wrong surface.
    expect(resolveFileKind("rows.csv", "text/plain").category).toBe("data");
    expect(resolveFileKind("app.ts", "text/plain").category).toBe("code");
    expect(resolveFileKind("page.html", "text/html").category).toBe("code");
  });

  it("falls back to unknown without throwing", () => {
    expect(resolveFileKind("mystery.wat")).toEqual({
      category: "unknown",
      mediaType: "application/octet-stream",
      extension: "wat",
    });
    expect(resolveFileKind("")).toMatchObject({ category: "unknown", extension: "" });
  });
});
