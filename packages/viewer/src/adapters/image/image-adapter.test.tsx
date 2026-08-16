import { normalizeFileSource } from "@elabs/components-ui";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import imageModule, { type ImageDocument } from "./image-adapter";

/**
 * jsdom parses `<img>` but never fetches it, so neither `load` nor `error` ever
 * fires — the real browser event this adapter measures with simply does not
 * exist here. The stub reports one fixed size so the load can complete; the
 * decode path itself is exercised in the Storybook stories, in a real browser.
 */
const ORIGINAL_IMAGE = globalThis.Image;

function stubImage(behaviour: "load" | "error") {
  globalThis.Image = class {
    naturalWidth = 800;
    naturalHeight = 600;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    set src(_value: string) {
      queueMicrotask(() => (behaviour === "load" ? this.onload?.() : this.onerror?.()));
    }
  } as unknown as typeof Image;
}

const png = () => new Blob([new Uint8Array([0x89, 0x50])], { type: "image/png" });
const sourceFor = (alt?: string) =>
  normalizeFileSource({ kind: "blob", blob: png(), name: "photo.png", alt });

beforeEach(() => stubImage("load"));
afterEach(() => {
  globalThis.Image = ORIGINAL_IMAGE;
  vi.restoreAllMocks();
});

describe("image adapter — loading", () => {
  it("mints a URL and reports the intrinsic size, so the box can be reserved", async () => {
    const doc = (await imageModule.create().load(sourceFor(), {})) as ImageDocument;
    expect(doc.url).toMatch(/^blob:/);
    expect(doc.width).toBe(800);
    expect(doc.height).toBe(600);
  });

  it("still loads when the size cannot be measured — measuring is not the load", async () => {
    stubImage("error");
    const doc = (await imageModule.create().load(sourceFor(), {})) as ImageDocument;
    expect(doc.url).toMatch(/^blob:/);
    expect(doc.width).toBeUndefined();
  });

  it("revokes the URL it minted when disposed", async () => {
    const revoke = vi.spyOn(URL, "revokeObjectURL");
    const adapter = imageModule.create();
    await adapter.load(sourceFor(), {});
    adapter.dispose?.();
    expect(revoke).toHaveBeenCalledTimes(1);
  });

  it("leaves a public remote URL alone — nothing was minted, nothing to revoke", async () => {
    const revoke = vi.spyOn(URL, "revokeObjectURL");
    const remote = normalizeFileSource({ kind: "url", url: "https://x.test/p.png" });
    const doc = (await imageModule.create().load(remote, {})) as ImageDocument;
    expect(doc.url).toBe("https://x.test/p.png");
    expect(revoke).not.toHaveBeenCalled();
  });
});

describe("image adapter — rendering", () => {
  const doc: ImageDocument = { kind: "image", url: "blob:x", width: 800, height: 600 };

  it("renders a real <img> with its intrinsic dimensions, not a canvas", () => {
    const { container } = render(<imageModule.Renderer document={doc} source={sourceFor()} />);
    const img = container.querySelector("img");
    expect(img).toHaveAttribute("width", "800");
    expect(img).toHaveAttribute("height", "600");
    expect(container.querySelector("canvas")).toBeNull();
  });

  it("is decorative with no description, and named when the source carries one", () => {
    const { container, rerender } = render(
      <imageModule.Renderer document={doc} source={sourceFor()} />,
    );
    expect(container.querySelector("img")).toHaveAttribute("alt", "");

    rerender(<imageModule.Renderer document={doc} source={sourceFor("A red bicycle")} />);
    expect(screen.getByRole("img", { name: "A red bicycle" })).toBeInTheDocument();
  });

  it("reports a broken image as a terminal alert, not a stuck placeholder", () => {
    const { container } = render(<imageModule.Renderer document={doc} source={sourceFor()} />);
    fireEvent.error(container.querySelector("img") as HTMLImageElement);
    expect(screen.getByRole("alert")).toHaveTextContent("photo.png");
  });

  it("honours the zoom and rotation its manifest claims (ADR 0026)", () => {
    // The manifest declared both while the renderer implemented neither, so the
    // shell offered controls that did nothing. These assertions are what stops
    // that claim from going hollow again.
    expect(imageModule.manifest.capabilities).toMatchObject({ zoom: true, rotate: true });

    const { container, rerender } = render(
      <imageModule.Renderer document={doc} source={sourceFor()} zoom={2} rotation={90} />,
    );
    const img = container.querySelector("img") as HTMLImageElement;
    // At a fixed scale the intrinsic cap has to come off, or "200%" silently
    // stops at the pane's width.
    expect(img.style.width).toBe("1600px");
    expect(img.style.height).toBe("1200px");
    // A quarter turn gets a box with the ROTATED bounds (the axes swap) and the
    // image centred inside it. Without the box, a transform overflows the pane
    // on all four sides and scrolling can only ever reach two of them.
    expect(img.style.transform).toBe("translate(-50%, -50%) rotate(90deg)");
    expect((img.parentElement as HTMLElement).style.width).toBe("1200px");
    expect((img.parentElement as HTMLElement).style.height).toBe("1600px");

    rerender(<imageModule.Renderer document={doc} source={sourceFor()} zoom="fit-page" />);
    // Re-queried on purpose: dropping the rotation box changes the tree shape,
    // so React swaps the element rather than patching the old one.
    const fitted = container.querySelector("img") as HTMLImageElement;
    expect(fitted.style.width).toBe("");
    expect(fitted.className).toContain("max-h-full");
  });

  it("fits the ROTATED bounds, so a turned image is never clipped", () => {
    // Fitting and turning at once is the case a transform gets wrong on its
    // own: the image is sized to the pane's width, then rotated into a box
    // taller than the pane. The fit has to read the pane's other axis, which is
    // what the container units do.
    const { container } = render(
      <imageModule.Renderer document={doc} source={sourceFor()} zoom="fit-width" rotation={90} />,
    );
    const img = container.querySelector("img") as HTMLImageElement;
    expect(img.className).toContain("max-h-[100cqw]");
    expect(img.className).toContain("max-w-[100cqh]");
    expect(img.className).not.toContain("max-w-full");
    // Container units answer only inside a size container, and only a definite
    // height makes one.
    expect((img.parentElement as HTMLElement).className).toContain("[container-type:size]");
  });
});
