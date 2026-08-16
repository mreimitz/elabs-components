import { afterEach, describe, expect, it, vi } from "vitest";

import { type FileSource, normalizeFileSource } from "./file-source";

const decode = (buffer: ArrayBuffer) => new TextDecoder().decode(buffer);

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("normalizeFileSource — identity", () => {
  it("reads name and MIME off a File", () => {
    const source: FileSource = {
      kind: "file",
      file: new File(["x"], "Report.PDF", { type: "application/pdf" }),
    };
    expect(normalizeFileSource(source)).toMatchObject({
      name: "Report.PDF",
      mediaType: "application/pdf",
      category: "document",
      extension: "pdf",
      size: 1,
    });
  });

  it("infers a File's MIME from its name when the platform reports none", () => {
    const file = new File(["a,b"], "rows.csv", { type: "" });
    expect(normalizeFileSource({ kind: "file", file })).toMatchObject({
      mediaType: "text/csv",
      category: "data",
    });
  });

  it("prefers an explicit mediaType over the Blob's own", () => {
    const blob = new Blob(["x"], { type: "application/octet-stream" });
    const resolved = normalizeFileSource({
      kind: "blob",
      blob,
      name: "page.html",
      mediaType: "text/html",
    });
    expect(resolved).toMatchObject({ mediaType: "text/html", category: "code" });
  });

  it("derives a name from the URL path when the caller gives none", () => {
    expect(
      normalizeFileSource({ kind: "url", url: "https://x.test/a/b/notes%20v2.md" }),
    ).toMatchObject({
      name: "notes v2.md",
      category: "text",
    });
  });

  it("ignores a URL query and hash when deriving the name", () => {
    expect(
      normalizeFileSource({ kind: "url", url: "https://x.test/chart.svg?v=2#top" }),
    ).toMatchObject({
      name: "chart.svg",
      category: "image",
    });
  });

  it("never produces an empty name", () => {
    expect(normalizeFileSource({ kind: "url", url: "https://x.test/" }).name).toBe("file");
  });

  it("carries alt through", () => {
    const file = new File([""], "a.png", { type: "image/png" });
    expect(normalizeFileSource({ kind: "file", file, alt: "A bar chart" }).alt).toBe("A bar chart");
  });

  it("reports size only where the platform already knows it", () => {
    const buffer = new TextEncoder().encode("hello").buffer as ArrayBuffer;
    expect(
      normalizeFileSource({
        kind: "buffer",
        buffer,
        name: "a.bin",
        mediaType: "application/octet-stream",
      }).size,
    ).toBe(5);
    // A text source would need an encode pass and a url source a fetch — neither is free.
    expect(
      normalizeFileSource({ kind: "text", text: "hello", name: "a.txt" }).size,
    ).toBeUndefined();
    expect(normalizeFileSource({ kind: "url", url: "https://x.test/a.txt" }).size).toBeUndefined();
  });

  it("does not read anything until asked", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    normalizeFileSource({ kind: "url", url: "https://x.test/a.txt" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("normalizeFileSource — reading", () => {
  it("reads every variant as bytes and as text", async () => {
    const sources: FileSource[] = [
      { kind: "file", file: new File(["hello"], "a.txt", { type: "text/plain" }) },
      { kind: "blob", blob: new Blob(["hello"]), name: "a.txt" },
      {
        kind: "buffer",
        buffer: new TextEncoder().encode("hello").buffer as ArrayBuffer,
        name: "a.txt",
        mediaType: "text/plain",
      },
      { kind: "text", text: "hello", name: "a.txt" },
    ];
    for (const source of sources) {
      const resolved = normalizeFileSource(source);
      expect(decode(await resolved.bytes()), source.kind).toBe("hello");
      expect(await resolved.text(), source.kind).toBe("hello");
    }
  });

  it("passes init through to fetch, so an authenticated file is reachable", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response("secret", { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);

    const init: RequestInit = { headers: { Authorization: "Bearer t" }, credentials: "include" };
    const resolved = normalizeFileSource({ kind: "url", url: "https://x.test/a.txt", init });
    expect(await resolved.text()).toBe("secret");

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://x.test/a.txt",
      expect.objectContaining({ headers: { Authorization: "Bearer t" }, credentials: "include" }),
    );
  });

  it("names the file in a failed fetch, so the error is actionable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 404 })));
    const resolved = normalizeFileSource({ kind: "url", url: "https://x.test/missing.pdf" });
    await expect(resolved.bytes()).rejects.toThrow(/missing\.pdf.*404/);
  });

  it("fetches once across repeated reads", async () => {
    const fetchSpy = vi.fn().mockImplementation(() => Promise.resolve(new Response("hello")));
    vi.stubGlobal("fetch", fetchSpy);

    const resolved = normalizeFileSource({ kind: "url", url: "https://x.test/a.txt" });
    await Promise.all([resolved.bytes(), resolved.bytes(), resolved.text()]);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("does not cache a failure, so a retry re-runs the read", async () => {
    const fetchSpy = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(new Response("hello"));
    vi.stubGlobal("fetch", fetchSpy);

    const resolved = normalizeFileSource({ kind: "url", url: "https://x.test/a.txt" });
    await expect(resolved.bytes()).rejects.toThrow("offline");
    expect(decode(await resolved.bytes())).toBe("hello");
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("rejects an already-aborted read without touching the network", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const resolved = normalizeFileSource({ kind: "url", url: "https://x.test/a.txt" });
    await expect(resolved.bytes(AbortSignal.abort())).rejects.toBeDefined();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("normalizeFileSource — url()", () => {
  it("returns a public remote URL unchanged, so the element streams it", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const resolved = normalizeFileSource({ kind: "url", url: "https://x.test/a.png" });
    expect(await resolved.url()).toBe("https://x.test/a.png");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("mints an object URL for a url source carrying init — the element cannot replay auth headers", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("bytes")));
    const createObjectURL = vi.fn().mockReturnValue("blob:mock");
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }));

    const resolved = normalizeFileSource({
      kind: "url",
      url: "https://x.test/a.png",
      init: { headers: { Authorization: "Bearer t" } },
    });
    expect(await resolved.url()).toBe("blob:mock");
    expect(createObjectURL).toHaveBeenCalledTimes(1);
  });

  it("mints one object URL per reader and revokes it exactly once", async () => {
    const createObjectURL = vi.fn().mockReturnValue("blob:mock");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL, revokeObjectURL }));

    const file = new File(["x"], "a.png", { type: "image/png" });
    const resolved = normalizeFileSource({ kind: "file", file });

    expect(await resolved.url()).toBe("blob:mock");
    expect(await resolved.url()).toBe("blob:mock");
    expect(createObjectURL).toHaveBeenCalledTimes(1);

    resolved.revoke();
    resolved.revoke();
    expect(revokeObjectURL).toHaveBeenCalledTimes(1);
  });

  it("revoke() is safe before any url() call", () => {
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", Object.assign(URL, { revokeObjectURL }));
    expect(() =>
      normalizeFileSource({ kind: "text", text: "x", name: "a.txt" }).revoke(),
    ).not.toThrow();
    expect(revokeObjectURL).not.toHaveBeenCalled();
  });
});
