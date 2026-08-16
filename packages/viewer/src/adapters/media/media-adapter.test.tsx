import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { AdapterRendererProps } from "../../core/types";
import adapterModule, { type MediaDocument } from "./media-adapter";

function source(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    name: "briefing.mp4",
    mediaType: "video/mp4",
    category: "video",
    extension: "mp4",
    bytes: () => Promise.resolve(new ArrayBuffer(0)),
    text: () => Promise.resolve(""),
    url: () => Promise.resolve("blob:media"),
    revoke: vi.fn(),
    ...overrides,
  } as unknown as AdapterRendererProps["source"];
}

function renderMedia(media: "video" | "audio", name: string) {
  const { Renderer } = adapterModule;
  const document: MediaDocument = { kind: "media", url: "blob:media", media };
  return render(<Renderer document={document} source={source({ name, category: media })} />);
}

describe("media adapter — load", () => {
  it("streams from a URL instead of buffering the whole file", async () => {
    const bytes = vi.fn();
    const adapter = adapterModule.create();
    const document = await adapter.load(source({ bytes }), {});

    expect(document).toMatchObject({ kind: "media", media: "video", url: "blob:media" });
    // A 2 GB video read into memory to feed a <video> element is the wrong shape
    // at every size — the element streams and seeks from the URL itself.
    expect(bytes).not.toHaveBeenCalled();
  });

  it("picks the audio element from the source's own category", async () => {
    const adapter = adapterModule.create();
    const document = await adapter.load(source({ category: "audio", name: "call.mp3" }), {});
    expect(document).toMatchObject({ media: "audio" });
  });

  it("revokes the object URL it minted", async () => {
    const revoke = vi.fn();
    const adapter = adapterModule.create();
    await adapter.load(source({ revoke }), {});
    adapter.dispose?.();
    expect(revoke).toHaveBeenCalledTimes(1);
  });
});

describe("media adapter — rendering", () => {
  it("renders a native, controllable video with an accessible name", () => {
    const { container } = renderMedia("video", "briefing.mp4");
    const video = container.querySelector("video");
    expect(video).toHaveAttribute("controls");
    expect(video).toHaveAttribute("aria-label", "briefing.mp4 player");
    // Sound that starts on its own is the reason browsers block autoplay.
    expect(video).not.toHaveAttribute("autoplay");
  });

  it("renders an audio element for audio", () => {
    const { container } = renderMedia("audio", "call.mp3");
    expect(container.querySelector("audio")).toBeInTheDocument();
    expect(container.querySelector("video")).toBeNull();
  });

  it("states an undecodable codec as a settled failure, with no retry", () => {
    const { container } = renderMedia("video", "briefing.mp4");
    fireEvent.error(container.querySelector("video") as HTMLVideoElement);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("This browser can't play briefing.mp4.");
    // Retrying cannot install a codec.
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
